# Backend — Shared Firebase Logic & Utilities

Server-side utilities, typed helpers, middleware, and shared logic used by the Next.js API routes.

> **Full API design** (response format, rate limiting, auth, validation, error codes): see `../agent-related/api-design.md`

---

## What Lives Here

```
backend/
├── lib/
│   ├── firebase-admin.ts     # Firebase Admin SDK init (used in all API routes)
│   ├── firestore.ts          # Typed Firestore collection helpers
│   ├── realtime.ts           # RTDB helpers for live scoring
│   ├── excel-parser.ts       # xlsx-based athlete roster parser
│   ├── api-response.ts       # ok(), created(), err(), Errors.* helpers
│   ├── schemas.ts            # Zod validation schemas for all endpoints
│   ├── rate-limit.ts         # Upstash Redis rate limiters (5 tiers)
│   └── with-error-handler.ts # Global error boundary wrapper
├── middleware/
│   ├── auth.ts               # Verify Firebase ID token, extract role
│   └── rbac.ts               # Role-based access control (can(), requirePermission())
├── services/
│   ├── bracket-generator.ts  # Single-elimination bracket algorithm
│   ├── match-finisher.ts     # Promote RTDB score → Firestore, advance bracket
│   └── archive-aggregator.ts # Compute archive stats from Firestore
└── types/
    └── index.ts              # All shared TypeScript types (Competition, Match, etc.)
```

These files are **copied/imported into `client/`** — Next.js API routes import from here via path aliases.

---

## Design Principles

1. **Server-only**: Nothing in this folder runs in the browser
2. **Typed**: Every entity has a TypeScript interface in `types/index.ts`
3. **Stateless**: All functions are pure transformations or Firebase calls
4. **Shared**: Imported by `client/app/api/` routes — not duplicated
5. **Validated**: Every API input goes through Zod schema before touching Firestore
6. **Rate-limited**: Every route runs through Upstash Redis before processing

---

## Key Types (from `types/index.ts`)

| Type | Description |
|---|---|
| `Competition` | id, name, dates, location, type, ruleSet, status, matsCount |
| `Category` | id, competitionId, name, ageGroup, weightRange, type, rules, status |
| `Match` | id, competitionId, categoryId, matId, aka, ao, timer, status |
| `Athlete` | id, competitionId, categoryId, name, academy, attendance, readiness |
| `Mat` | id, competitionId, number, status, password, currentMatchId |
| `Medalist` | id, competitionId, categoryId, athleteId, medalType, received |
| `StaffAssignment` | id, competitionId, userId, role, scope, scopeId |
| `ScheduleRow` | id, competitionId, categoryId, matId, startTime, endTime, phase |
| `User` | uid, name, email, role, academy, photoURL |

---

## Rate Limit Tiers

| Limiter | Limit | Used For |
|---|---|---|
| `default` | 60 req/min | All GET endpoints |
| `mutations` | 30 req/min | POST, PATCH, DELETE |
| `import` | 5 req/min | Excel/CSV athlete import |
| `scoring` | 120 req/min | Match score updates |
| `auth` | 10 req/min | Login / token refresh |

Uses **Upstash Redis** (serverless-native, sliding window algorithm).
Key format: `uid:<firebase-uid>` for authenticated users, `ip:<ip-address>` for anonymous.

---

## API Route Pattern

Every route follows: **Auth → Rate Limit → RBAC → Validate → Query → Respond**

```
verifyAuth()          ← check Firebase ID token
↓
limiters.X.limit()    ← Upstash Redis sliding window
↓
can(role, permission) ← RBAC check
↓
validate(Schema, body)← Zod schema parse
↓
adminDb query/write   ← Firebase Admin SDK
↓
ok(data) / err(...)   ← standard response envelope
```

---

## Bracket Generator Logic

```
Input: athlete[] + poolSize + seedMethod
Output: Match[] with bracketPosition (R1-M1, R1-M2, etc.)

Algorithm:
1. Filter: present + non-disqualified athletes only
2. Seed: random shuffle OR import order
3. rounds = ceil(log2(athletes.length))
4. R1 pairings: [0]vs[1], [2]vs[3], ... (last gets bye if odd count)
5. R2..Rfinal: empty match slots (winnerId = null, filled as matches finish)
6. bracketPosition format: "R{round}-M{matchIndex}"
7. Batch write all matches to Firestore (max 499 per batch)
8. Return Match[] for canvas rendering
```

---

## Dependencies

```bash
npm install zod                    # Input validation
npm install @upstash/ratelimit     # Rate limiting
npm install @upstash/redis         # Upstash Redis client
npm install xlsx                   # Excel/CSV parsing (server-side only)
npm install firebase-admin         # Admin SDK
```

Required env vars:
```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```
