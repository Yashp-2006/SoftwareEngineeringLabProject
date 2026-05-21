# TaikaiX — API Design

**Stack context:** Next.js 14 API Routes on Vercel (serverless). No persistent in-process state between requests.

---

## 1. Response Envelope

Every API response uses the same shape — no exceptions.

### Success

```typescript
// 200, 201
{
  "success": true,
  "data": { ... },       // the actual payload
  "meta": {              // optional, for lists
    "total": 47,
    "page": 1,
    "pageSize": 20
  }
}
```

### Error

```typescript
// 4xx, 5xx
{
  "success": false,
  "error": {
    "code": "COMPETITION_NOT_FOUND",    // machine-readable constant
    "message": "Competition not found", // human-readable
    "field": "competitionId"            // optional, for validation errors
  }
}
```

### TypeScript helper (used in every API route)

```typescript
// lib/api-response.ts

import { NextResponse } from 'next/server';

export function ok<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...(meta && { meta }) }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function err(code: string, message: string, status: number, field?: string) {
  return NextResponse.json(
    { success: false, error: { code, message, ...(field && { field }) } },
    { status }
  );
}

// Pre-built common errors
export const Errors = {
  unauthorized:     () => err('UNAUTHORIZED',      'Authentication required', 401),
  forbidden:        () => err('FORBIDDEN',         'Insufficient permissions', 403),
  notFound:         (res: string) => err(`${res}_NOT_FOUND`, `${res} not found`, 404),
  validationError:  (msg: string, field?: string) => err('VALIDATION_ERROR', msg, 422, field),
  rateLimited:      () => err('RATE_LIMITED',      'Too many requests. Slow down.', 429),
  serverError:      () => err('INTERNAL_ERROR',    'Something went wrong', 500),
};
```

---

## 2. Error Code Registry

| Code | HTTP | When |
|---|---|---|
| `UNAUTHORIZED` | 401 | No or invalid Firebase token |
| `FORBIDDEN` | 403 | Valid token but wrong role |
| `COMPETITION_NOT_FOUND` | 404 | Competition ID doesn't exist |
| `CATEGORY_NOT_FOUND` | 404 | Category ID doesn't exist |
| `MATCH_NOT_FOUND` | 404 | Match ID doesn't exist |
| `ATHLETE_NOT_FOUND` | 404 | Athlete ID doesn't exist |
| `USER_NOT_FOUND` | 404 | User UID doesn't exist |
| `MAT_NOT_FOUND` | 404 | Mat ID doesn't exist |
| `VALIDATION_ERROR` | 422 | Input schema fails Zod parse |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `IMPORT_PARSE_ERROR` | 422 | Excel/CSV file can't be parsed |
| `IMPORT_NO_ATHLETES` | 422 | File parsed but 0 valid athletes found |
| `BRACKET_ALREADY_EXISTS` | 409 | Bracket for category already generated |
| `MATCH_ALREADY_FINISHED` | 409 | Can't score a finished match |
| `COMPETITION_DONE` | 409 | Can't modify a completed competition |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 3. Rate Limiting

### Why In-Memory Won't Work

Vercel is serverless — each request may land on a different function instance. An in-memory counter resets per instance. We need a shared store.

**Solution: [Upstash Redis](https://upstash.com/) + sliding window algorithm**

- Upstash is serverless-native Redis (REST API, no persistent connections)
- Free tier: 10,000 commands/day — enough for a tournament app
- `@upstash/ratelimit` is the official package

### Installation

```bash
npm install @upstash/ratelimit @upstash/redis
```

Add to `.env.local`:
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Rate Limiter Setup

```typescript
// lib/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Different limiters for different endpoint sensitivity
export const limiters = {
  // General API calls — 60 requests per minute per IP
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:default',
    analytics: true,
  }),

  // Mutating operations — 30 per minute (create, update, delete)
  mutations: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:mutations',
    analytics: true,
  }),

  // Excel import — 5 per minute (heavy server operation)
  import: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:import',
    analytics: true,
  }),

  // Live scoring writes — 120 per minute (1 per 500ms per mat, headroom for 10 mats)
  scoring: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '1 m'),
    prefix: 'rl:scoring',
    analytics: true,
  }),

  // Auth-related (login, token refresh) — 10 per minute
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:auth',
    analytics: true,
  }),
};

// Helper: extract identifier (UID if authenticated, else IP)
export function getRateLimitId(req: Request, uid?: string): string {
  if (uid) return `uid:${uid}`;
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] ?? '127.0.0.1';
  return `ip:${ip}`;
}
```

### Using the Rate Limiter in an API Route

```typescript
// app/api/competitions/route.ts

import { limiters, getRateLimitId } from '@/lib/rate-limit';
import { Errors } from '@/lib/api-response';

export async function POST(req: Request) {
  // 1. Auth first (get UID before rate limit ID)
  const { user, error } = await verifyAuth(req);
  if (error) return Errors.unauthorized();

  // 2. Rate limit (keyed by UID for authenticated users)
  const id = getRateLimitId(req, user.uid);
  const { success, limit, remaining, reset } = await limiters.mutations.limit(id);

  if (!success) {
    return new Response(
      JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' } }),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // 3. Continue with request...
}
```

### Rate Limit Headers (always include on success too)

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1716300060000   (Unix ms timestamp)
```

---

## 4. Auth Middleware

Every protected route runs this before anything else:

```typescript
// middleware/auth.ts

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { UserRole } from '@/types';

export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
}

export async function verifyAuth(req: Request): Promise<
  { user: AuthContext; error: null } | { user: null; error: string }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'No token' };
  }

  const token = authHeader.slice(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return { user: null, error: 'User not found' };
    }

    const userData = userDoc.data()!;
    return {
      user: {
        uid: decoded.uid,
        email: decoded.email ?? '',
        role: userData.role as UserRole,
      },
      error: null,
    };
  } catch {
    return { user: null, error: 'Invalid token' };
  }
}
```

### RBAC Check

```typescript
// middleware/rbac.ts

import type { UserRole } from '@/types';

type Permission =
  | 'competitions:write'
  | 'categories:write'
  | 'athletes:write'        // Admin create/delete
  | 'athletes:attendance'   // Volunteer update
  | 'matches:score'         // Scoreboard Controller
  | 'medals:write'          // Admin create/delete
  | 'medals:receive'        // Medal Distributor toggle
  | 'staff:write'
  | 'users:manage'
  | 'brackets:generate';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  'Admin': [
    'competitions:write', 'categories:write', 'athletes:write',
    'athletes:attendance', 'matches:score', 'medals:write',
    'medals:receive', 'staff:write', 'users:manage', 'brackets:generate',
  ],
  'Scoreboard Controller': ['matches:score'],
  'Attendance Volunteer':  ['athletes:attendance'],
  'Medal Distributor':     ['medals:receive'],
  'Viewer':                [],
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(role: UserRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error('FORBIDDEN');
  }
}
```

---

## 5. Input Validation (Zod)

Install:
```bash
npm install zod
```

Schema definitions live in `lib/schemas.ts`:

```typescript
// lib/schemas.ts

import { z } from 'zod';

export const CompetitionCreateSchema = z.object({
  name: z.string().min(3).max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().min(2).max(100),
  venue: z.string().min(2).max(100),
  type: z.enum(['national', 'international']),
  ruleSet: z.enum(['WKF', 'custom']),
  matsCount: z.number().int().min(1).max(20),
});

export const CompetitionUpdateSchema = CompetitionCreateSchema.partial().extend({
  status: z.enum(['live', 'upcoming', 'done']).optional(),
});

export const CategoryCreateSchema = z.object({
  name: z.string().min(2).max(80),
  ageGroup: z.string().min(1).max(50),
  weightRange: z.string().min(1).max(50),
  type: z.enum(['standard', 'special']),
  rules: z.string().max(200).optional().default(''),
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial().extend({
  status: z.enum(['live', 'upcoming', 'done']).optional(),
  assignedMat: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
});

export const AthleteAttendanceSchema = z.object({
  attendance: z.enum(['present', 'absent']).optional(),
  readiness: z.enum(['ready', 'not-ready']).optional(),
  disqualified: z.boolean().optional(),
}).refine(
  (d) => d.attendance !== undefined || d.readiness !== undefined || d.disqualified !== undefined,
  'At least one field required'
);

export const ScoreUpdateSchema = z.object({
  field: z.enum(['yuko', 'wazaAri', 'ippon', 'senshu', 'C1', 'C2', 'C3', 'HC', 'H', 'status', 'timer']),
  side: z.enum(['aka', 'ao']).optional(),
  value: z.union([z.number(), z.boolean(), z.string()]),
});

export const MatchFinishSchema = z.object({
  winnerId: z.string().min(1),
  winMethod: z.enum(['score', 'ippon', 'hansoku', 'disqualification']),
});

export const BracketGenerateSchema = z.object({
  categoryId: z.string().min(1),
  poolSize: z.number().int().min(2).max(8),
  seedMethod: z.enum(['random', 'import-order']).default('random'),
});

export const MedalAssignSchema = z.object({
  categoryId: z.string().min(1),
  athleteId: z.string().min(1),
  athleteName: z.string().min(1),
  academy: z.string().min(1),
  medalType: z.enum(['Gold', 'Silver', 'Bronze']),
});

export const StaffAssignSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1),
  role: z.enum(['Admin', 'Scoreboard Controller', 'Attendance Volunteer', 'Medal Distributor', 'Viewer']),
  scope: z.enum(['mat', 'category', 'medals', 'global']),
  scopeId: z.string().nullable().optional(),
});

export const ScheduleRowSchema = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
  matId: z.string().min(1),
  matNumber: z.number().int().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  phase: z.string().min(1),
});

export const UserUpdateSchema = z.object({
  role: z.enum(['Admin', 'Scoreboard Controller', 'Attendance Volunteer', 'Medal Distributor', 'Viewer']).optional(),
  academy: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
});

// Validation helper — use in every API route
export function validate<T>(schema: z.ZodType<T>, data: unknown):
  { data: T; error: null } | { data: null; error: { message: string; field?: string } } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, error: null };
  const issue = result.error.issues[0];
  return {
    data: null,
    error: {
      message: issue.message,
      field: issue.path.join('.'),
    },
  };
}
```

---

## 6. Standard API Route Template

Every API route follows this exact pattern:

```typescript
// app/api/competitions/route.ts

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/middleware/auth';
import { can } from '@/middleware/rbac';
import { limiters, getRateLimitId } from '@/lib/rate-limit';
import { validate, CompetitionCreateSchema } from '@/lib/schemas';
import { ok, created, Errors } from '@/lib/api-response';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  // 1. Verify auth
  const { user, error } = await verifyAuth(req);
  if (error) return Errors.unauthorized();

  // 2. Rate limit
  const { success } = await limiters.default.limit(getRateLimitId(req, user.uid));
  if (!success) return Errors.rateLimited();

  // 3. Parse query params
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'live' | 'upcoming' | 'done' | null;

  // 4. Query Firestore
  let query = adminDb.collection('competitions').orderBy('createdAt', 'desc');
  if (status) query = query.where('status', '==', status) as typeof query;

  const snapshot = await query.get();
  const competitions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // 5. Return
  return ok(competitions, 200, { total: competitions.length });
}

export async function POST(req: NextRequest) {
  // 1. Auth
  const { user, error } = await verifyAuth(req);
  if (error) return Errors.unauthorized();

  // 2. RBAC
  if (!can(user.role, 'competitions:write')) return Errors.forbidden();

  // 3. Rate limit (mutation tier)
  const { success } = await limiters.mutations.limit(getRateLimitId(req, user.uid));
  if (!success) return Errors.rateLimited();

  // 4. Validate body
  const body = await req.json();
  const { data, error: valError } = validate(CompetitionCreateSchema, body);
  if (valError) return Errors.validationError(valError.message, valError.field);

  // 5. Write to Firestore
  const now = new Date().toISOString();
  const docRef = await adminDb.collection('competitions').add({
    ...data,
    status: 'upcoming',
    createdAt: now,
    createdBy: user.uid,
  });

  // 6. Return created resource
  return created({ id: docRef.id, ...data, status: 'upcoming', createdAt: now });
}
```

---

## 7. Query Filtering Design

### Competition List Filters

`GET /api/competitions?status=live&type=national&search=tokyo`

| Param | Type | Firestore Strategy |
|---|---|---|
| `status` | `live \| upcoming \| done` | `.where('status', '==', status)` |
| `type` | `national \| international` | `.where('type', '==', type)` |
| `search` | string | Client-side filter on `name` (Firestore has no full-text) |
| `from` | ISO date | `.where('startDate', '>=', from)` |
| `to` | ISO date | `.where('endDate', '<=', to)` |

> **Note:** Combining `where` clauses requires composite indexes. See `database/README.md`.
> Full-text search on name is done client-side — Firestore doesn't support `LIKE`. For production scale, add Algolia. For tournament use (< 500 competitions), client-side filter is fine.

### Category List Filters

`GET /api/competitions/[id]/categories?status=live&mat=mat_1`

| Param | Type | Strategy |
|---|---|---|
| `status` | `live \| upcoming \| done` | Firestore where |
| `mat` | matId string | Firestore where `assignedMat == mat` |

### Athlete List Filters

`GET /api/competitions/[id]/athletes?categoryId=cat_1&attendance=present`

| Param | Type | Strategy |
|---|---|---|
| `categoryId` | string | Firestore where |
| `attendance` | `present \| absent` | Firestore where |
| `readiness` | `ready \| not-ready` | Firestore where |
| `search` | string | Client-side on name/academy |

### Schedule Filters

`GET /api/competitions/[id]/schedule?mat=mat_1&from=2026-05-01T09:00:00Z`

| Param | Type | Strategy |
|---|---|---|
| `mat` | matId string | Firestore where `matId == mat` |
| `from` | ISO datetime | Firestore where `startTime >= from` |

---

## 8. Pagination

List endpoints support cursor-based pagination (Firestore-native):

```
GET /api/competitions?pageSize=20&cursor=<last-doc-id>
```

```typescript
// In the API route:
const pageSize = parseInt(searchParams.get('pageSize') ?? '20');
const cursor = searchParams.get('cursor');

let query = adminDb.collection('competitions').orderBy('createdAt', 'desc').limit(pageSize);

if (cursor) {
  const cursorDoc = await adminDb.collection('competitions').doc(cursor).get();
  query = query.startAfter(cursorDoc) as typeof query;
}

const snapshot = await query.get();
const lastDoc = snapshot.docs[snapshot.docs.length - 1];

return ok(data, 200, {
  total: snapshot.size,
  pageSize,
  nextCursor: snapshot.size === pageSize ? lastDoc?.id : null,
});
```

---

## 9. File Upload (Excel Import)

```typescript
// app/api/competitions/[id]/athletes/import/route.ts

import { limiters } from '@/lib/rate-limit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Auth + RBAC
  const { user, error } = await verifyAuth(req);
  if (error) return Errors.unauthorized();
  if (!can(user.role, 'athletes:write')) return Errors.forbidden();

  // Strict rate limit for imports (heavy CPU operation)
  const { success } = await limiters.import.limit(getRateLimitId(req, user.uid));
  if (!success) return Errors.rateLimited();

  // Parse multipart form
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const categoryId = formData.get('categoryId') as string | null;

  if (!file) return Errors.validationError('No file uploaded', 'file');
  if (!categoryId) return Errors.validationError('categoryId required', 'categoryId');

  // Size check — max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return Errors.validationError('File too large. Max 5MB.', 'file');
  }

  // Parse
  const buffer = Buffer.from(await file.arrayBuffer());
  const { athletes, error: parseError } = parseAthleteFile(buffer);

  if (parseError) return err('IMPORT_PARSE_ERROR', parseError, 422);
  if (athletes.length === 0) return err('IMPORT_NO_ATHLETES', 'No valid athletes found in file', 422);

  // Batch write to Firestore (max 500 per batch)
  const batches = chunk(athletes, 499);
  for (const batch of batches) {
    const writeBatch = adminDb.batch();
    for (const athlete of batch) {
      const ref = adminDb
        .collection('competitions').doc(params.id)
        .collection('athletes').doc();
      writeBatch.set(ref, {
        ...athlete,
        competitionId: params.id,
        categoryId,
        attendance: 'absent',
        readiness: 'not-ready',
        disqualified: false,
        importedAt: new Date().toISOString(),
      });
    }
    await writeBatch.commit();
  }

  return ok({ imported: athletes.length, categoryId });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
```

---

## 10. Error Boundary (Global 500 Catch)

Wrap every API route body:

```typescript
// lib/with-error-handler.ts

import { Errors } from './api-response';

type RouteHandler = (req: Request, ctx: unknown) => Promise<Response>;

export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';

      if (msg === 'FORBIDDEN') return Errors.forbidden();
      if (msg === 'UNAUTHORIZED') return Errors.unauthorized();

      console.error('[API Error]', msg, e);
      return Errors.serverError();
    }
  };
}

// Usage:
export const GET = withErrorHandler(async (req) => {
  // ...your code, throw freely
});
```

---

## 11. Rate Limit Tiers by Endpoint

| Endpoint | Limiter | Limit |
|---|---|---|
| `GET /api/competitions` | `default` | 60/min |
| `POST /api/competitions` | `mutations` | 30/min |
| `PATCH /api/competitions/[id]` | `mutations` | 30/min |
| `GET /api/competitions/[id]/categories` | `default` | 60/min |
| `POST /api/competitions/[id]/categories` | `mutations` | 30/min |
| `POST /api/competitions/[id]/athletes/import` | `import` | 5/min |
| `GET /api/competitions/[id]/athletes` | `default` | 60/min |
| `PATCH /api/athletes/[athleteId]` | `mutations` | 30/min |
| `POST /api/competitions/[id]/brackets/generate` | `mutations` | 10/min |
| `GET /api/competitions/[id]/brackets/[catId]` | `default` | 60/min |
| `PATCH /api/matches/[matchId]` | `scoring` | 120/min |
| `POST /api/matches/[matchId]/finish` | `mutations` | 30/min |
| `GET /api/competitions/[id]/medals` | `default` | 60/min |
| `POST /api/competitions/[id]/medals` | `mutations` | 30/min |
| `PATCH /api/competitions/[id]/medals/[id]` | `mutations` | 30/min |
| `GET /api/competitions/[id]/staff` | `default` | 60/min |
| `POST /api/competitions/[id]/staff` | `mutations` | 30/min |
| `GET /api/competitions/[id]/schedule` | `default` | 60/min |
| `PATCH /api/competitions/[id]/schedule/[id]` | `mutations` | 30/min |
| `GET /api/users` | `default` | 60/min |
| `PATCH /api/users/[uid]` | `mutations` | 30/min |
| `GET /api/competitions/[id]/archive` | `default` | 60/min |

---

## 12. npm Dependencies to Add

```bash
# Validation
npm install zod

# Rate limiting (serverless Redis)
npm install @upstash/ratelimit @upstash/redis

# Excel parsing (server-side only, API routes)
npm install xlsx
```

Add to `.env.local`:
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```
