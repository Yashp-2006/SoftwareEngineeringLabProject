# TaiKaiX — Full-Stack Build Guide
### For AI Coding Tools (Cursor, Windsurf, GitHub Copilot Workspace, etc.)

> **What you're building:** TaiKaiX is a karate tournament operations console — covering competition setup, live mat scoring, brackets/tiesheets, athlete attendance, staff management, medal tracking, scheduling, and archive analytics. The complete UI design (29 screens) is already built in HTML/CSS. Your job is to wire it to a real backend, database, and deploy it to production.

---

## 0. Reference Files in This Archive

| File | What it is |
|---|---|
| `taikaixapp.md` | Full screen map, all data entities, all implied API surfaces — **read this first** |
| `brand-spec.md` | Color tokens, typography, spacing system — **never deviate from these** |
| `DESIGN-HANDOFF.md` | Responsive contract, fidelity rules, implementation sequence |
| `DESIGN-MANIFEST.json` | Machine-readable screen/asset inventory |
| `style.css` | Global design token stylesheet — import this everywhere |
| `index.html` + all `.html` files | Production UI screens — convert to React routes, preserve pixel-perfect |
| `mp6paub1-TaiKaiX_DesignGuide.md` | Extended design guide |

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | SSR + API routes, Vercel-native |
| **Backend API** | Node.js via Next.js API Routes (`/app/api/`) | No separate server needed for Vercel |
| **Realtime** | Firebase Realtime Database | Live mat scores, match state, presence |
| **Primary Database** | Firebase Firestore | All persistent data (competitions, categories, athletes, brackets, medals) |
| **Auth** | Firebase Auth | Role-based (Admin, Scoreboard Controller, Attendance Volunteer, Medal Distributor, Viewer) |
| **File Uploads** | Firebase Storage | Excel/CSV athlete imports |
| **Deployment** | Vercel | Auto CI/CD from GitHub |
| **Excel Parsing** | `xlsx` npm package (server-side in API route) | Parses .xls/.xlsx athlete rosters |

---

## 2. Project Structure

```
taikaix/
├── app/
│   ├── layout.tsx                  # Root layout — imports style.css, fonts
│   ├── page.tsx                    # → index.html (Operations Hub)
│   ├── competitions/
│   │   ├── page.tsx                # → competitions.html
│   │   ├── [id]/
│   │   │   ├── page.tsx            # → competition-detail.html
│   │   │   ├── categories/page.tsx # → categories.html
│   │   │   ├── bracket/page.tsx    # → bracket.html (use taikaix-bracket-final-2-2-2-2.html as source)
│   │   │   ├── mats/
│   │   │   │   ├── page.tsx        # → mats-grid.html
│   │   │   │   └── [matId]/page.tsx # → mat-detail.html
│   │   │   ├── athletes/page.tsx   # → athletes.html
│   │   │   ├── staff/page.tsx      # → taikaix-live-staff.html
│   │   │   ├── medals/page.tsx     # → medals.html
│   │   │   └── schedule/page.tsx   # → schedule.html
│   │   └── setup/page.tsx          # → taikaix-tournament-setup.html
│   ├── live/
│   │   ├── mat/[matId]/page.tsx    # → live-mat.html (public broadcast, no auth)
│   │   └── scoreboard/[matchId]/page.tsx  # → taikaix-karate-scoreboard.html
│   ├── archive/
│   │   └── [id]/page.tsx           # → taikaix-archive-detail.html
│   ├── users/page.tsx              # → users.html
│   ├── profile/
│   │   ├── page.tsx                # → taikaix-profile.html
│   │   └── edit/page.tsx          # → taikaix-edit-profile.html
│   └── api/
│       ├── competitions/           # CRUD
│       ├── categories/             # CRUD
│       ├── athletes/
│       │   └── import/route.ts     # Excel upload handler
│       ├── matches/                # Score + state updates
│       ├── brackets/               # Generate + fetch tiesheets
│       ├── medals/                 # Medal assignment
│       ├── staff/                  # Staff assignment
│       └── schedule/               # Schedule read/write
├── components/
│   ├── ui/                         # Reusable primitives (Button, Chip, Card, Modal)
│   ├── nav/                        # GlobalNav, CompetitionSubNav
│   ├── bracket/                    # BracketCanvas (zoom/pan)
│   ├── mat/                        # ScoreControls, MatchTimer, PenaltyPanel
│   └── charts/                     # ArchiveCharts (Chart.js wrappers)
├── lib/
│   ├── firebase.ts                 # Firebase client init
│   ├── firebase-admin.ts           # Firebase Admin SDK (server-side)
│   ├── firestore.ts                # Typed collection helpers
│   ├── realtime.ts                 # Firebase RTDB helpers
│   └── excel-parser.ts             # xlsx parse → athlete array
├── hooks/
│   ├── useMatchLive.ts             # RTDB subscription for live score
│   ├── useCompetition.ts           # Firestore competition listener
│   └── useAuth.ts                  # Firebase Auth + role resolver
├── types/
│   └── index.ts                    # All entity TypeScript types
├── public/
│   └── style.css                   # Copy from design archive verbatim
├── .env.local                      # Firebase keys (never commit)
├── vercel.json                     # Vercel config
└── next.config.js
```

---

## 3. Firebase Setup

### 3.1 Firestore Collections

```
/competitions/{competitionId}
/competitions/{competitionId}/categories/{categoryId}
/competitions/{competitionId}/categories/{categoryId}/matches/{matchId}
/competitions/{competitionId}/athletes/{athleteId}
/competitions/{competitionId}/mats/{matId}
/competitions/{competitionId}/staff/{assignmentId}
/competitions/{competitionId}/medals/{medalistId}
/competitions/{competitionId}/schedule/{rowId}
/users/{uid}
```

### 3.2 Firestore Document Schemas (TypeScript types)

```typescript
// types/index.ts

export type CompetitionStatus = 'live' | 'upcoming' | 'done';
export type CategoryStatus = 'live' | 'upcoming' | 'done';
export type MatchStatus = 'upcoming' | 'ongoing' | 'paused' | 'finished';
export type MatStatus = 'live' | 'standby';
export type MedalType = 'Gold' | 'Silver' | 'Bronze';
export type UserRole = 'Admin' | 'Scoreboard Controller' | 'Attendance Volunteer' | 'Medal Distributor' | 'Viewer';

export interface Competition {
  id: string;
  name: string;
  startDate: string;          // ISO date
  endDate: string;
  location: string;
  venue: string;
  type: 'national' | 'international';
  ruleSet: 'WKF' | 'custom';
  status: CompetitionStatus;
  matsCount: number;
  createdAt: string;
  createdBy: string;          // uid
}

export interface Category {
  id: string;
  competitionId: string;
  name: string;
  ageGroup: string;
  weightRange: string;
  type: 'standard' | 'special';
  rules: string;              // e.g. "Gold only"
  status: CategoryStatus;
  assignedMat: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface Match {
  id: string;
  competitionId: string;
  categoryId: string;
  matId: string;
  round: string;              // e.g. "Quarter-Finals"
  status: MatchStatus;
  aka: {
    athleteId: string;
    name: string;
    academy: string;
    score: number;            // total composite
    yuko: number;
    wazaAri: number;
    ippon: number;
    penalties: { C1: number; C2: number; C3: number; HC: number; H: number };
    senshu: boolean;
  };
  ao: {                       // same shape as aka
    athleteId: string;
    name: string;
    academy: string;
    score: number;
    yuko: number;
    wazaAri: number;
    ippon: number;
    penalties: { C1: number; C2: number; C3: number; HC: number; H: number };
    senshu: boolean;
  };
  timerSeconds: number;       // remaining time
  winnerId: string | null;
  bracketPosition: string | null; // e.g. "R1-M3"
}

export interface Athlete {
  id: string;
  competitionId: string;
  categoryId: string;
  name: string;
  academy: string;
  country: string;
  attendance: 'present' | 'absent';
  readiness: 'ready' | 'not-ready';
  disqualified: boolean;
  importedAt: string;
}

export interface Mat {
  id: string;
  competitionId: string;
  number: number;
  status: MatStatus;
  assignedCategoryId: string | null;
  currentMatchId: string | null;
  operatorId: string | null;
  password: string;           // set during setup
}

export interface Medalist {
  id: string;
  competitionId: string;
  categoryId: string;
  athleteId: string;
  athleteName: string;
  academy: string;
  medalType: MedalType;
  received: boolean;
  awardedAt: string;
}

export interface StaffAssignment {
  id: string;
  competitionId: string;
  userId: string;
  userName: string;
  role: UserRole;
  scope: 'mat' | 'category' | 'medals' | 'global';
  scopeId: string | null;     // matId or categoryId
  status: 'assigned' | 'unassigned';
}

export interface ScheduleRow {
  id: string;
  competitionId: string;
  categoryId: string;
  categoryName: string;
  matId: string;
  matNumber: number;
  startTime: string;
  endTime: string;
  phase: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  academy: string;
  photoURL: string | null;
  createdAt: string;
}
```

### 3.3 Firebase Realtime Database (RTDB) — Live Scoring Only

RTDB is used exclusively for sub-second live score updates. Structure:

```json
{
  "liveMatches": {
    "{matchId}": {
      "status": "ongoing",
      "timerSeconds": 120,
      "timerRunning": true,
      "aka": { "score": 4, "yuko": 2, "wazaAri": 1, "ippon": 0, "senshu": false, "penalties": {} },
      "ao":  { "score": 2, "yuko": 1, "wazaAri": 0, "ippon": 0, "senshu": true,  "penalties": {} },
      "updatedAt": 1716300000000
    }
  },
  "matStatus": {
    "{matId}": {
      "status": "live",
      "currentMatchId": "{matchId}",
      "updatedAt": 1716300000000
    }
  }
}
```

When a match finishes, write final results back to Firestore and clear the RTDB entry.

### 3.4 Firebase Security Rules

Firestore rules (simplified):
```
// competitions — all roles can read; only Admin can write
// athletes, categories, schedule — Admin read/write; Volunteers read
// matches — Scoreboard Controller can update score fields only
// medals — Medal Distributor can update `received` field only
// users — Admin read/write; own document read/write
```

RTDB rules:
```
// liveMatches/{matchId} — Scoreboard Controller for that mat can write; all authenticated users can read
// matStatus — same
```

---

## 4. API Routes (Next.js App Router)

All routes live under `app/api/`. Use Firebase Admin SDK server-side. Return JSON.

### 4.1 Competitions

```
GET    /api/competitions                    → list all, filterable by status
POST   /api/competitions                    → create (Admin only)
GET    /api/competitions/[id]               → single competition with counts
PATCH  /api/competitions/[id]               → update name/dates/status
DELETE /api/competitions/[id]               → soft-delete (set status 'done')
```

### 4.2 Categories

```
GET    /api/competitions/[id]/categories    → list categories
POST   /api/competitions/[id]/categories    → create category
PATCH  /api/competitions/[id]/categories/[catId]  → update status/mat/time
DELETE /api/competitions/[id]/categories/[catId]
```

### 4.3 Athlete Import (Excel/CSV) — Key Endpoint

```
POST   /api/competitions/[id]/athletes/import
```

**Request:** `multipart/form-data` with field `file` (.xlsx, .xls, or .csv) and `categoryId`.

**Server logic (`lib/excel-parser.ts`):**
```typescript
import * as XLSX from 'xlsx';

export function parseAthleteFile(buffer: Buffer): RawAthlete[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(ws);
  return rows.map(r => ({
    name: r['Name'] || r['name'] || r['Athlete Name'] || '',
    academy: r['Academy'] || r['Club'] || r['club'] || '',
    country: r['Country'] || r['country'] || '',
  })).filter(r => r.name);
}
```

Expected Excel columns (case-insensitive, flexible): `Name`, `Academy` (or `Club`), `Country`.

**Response:** `{ imported: number, athletes: Athlete[] }`

After import, also trigger bracket generation (see §4.5).

### 4.4 Matches + Live Scoring

```
GET    /api/competitions/[id]/matches       → all matches (for bracket build)
POST   /api/competitions/[id]/matches       → create match
PATCH  /api/matches/[matchId]               → update score/status (Scoreboard Controller)
  body: { field: 'aka.yuko' | 'ao.penalty.C1' | 'status' | 'timer' | 'senshu', value, side }
POST   /api/matches/[matchId]/finish        → record winner → Firestore, clear RTDB
```

For live scoring, the frontend should **write directly to RTDB** for lowest latency:
```typescript
// In mat-detail page
import { ref, update } from 'firebase/database';
const matchRef = ref(rtdb, `liveMatches/${matchId}`);
await update(matchRef, { 'aka/score': newScore, updatedAt: Date.now() });
```

The API route `/api/matches/[matchId]/finish` then promotes final state to Firestore.

### 4.5 Bracket Generation

```
POST   /api/competitions/[id]/brackets/generate
  body: { categoryId, poolSize }
```

Server logic: takes athlete list for the category, applies pool size, generates a standard single-elimination bracket tree, stores matches in Firestore with `bracketPosition` (e.g., "R1-M1"). Returns full bracket structure.

```
GET    /api/competitions/[id]/brackets/[categoryId]  → fetch bracket with live match states
```

### 4.6 Medals

```
GET    /api/competitions/[id]/medals
POST   /api/competitions/[id]/medals       → assign medalist
PATCH  /api/competitions/[id]/medals/[id]  → toggle `received`
DELETE /api/competitions/[id]/medals/[id]
```

### 4.7 Staff

```
GET    /api/competitions/[id]/staff
POST   /api/competitions/[id]/staff        → assign
PATCH  /api/competitions/[id]/staff/[id]   → reassign / status change
DELETE /api/competitions/[id]/staff/[id]
```

### 4.8 Schedule

```
GET    /api/competitions/[id]/schedule
POST   /api/competitions/[id]/schedule     → create row
PATCH  /api/competitions/[id]/schedule/[id]
DELETE /api/competitions/[id]/schedule/[id]
```

### 4.9 Users

```
GET    /api/users                          → list (Admin only)
PATCH  /api/users/[uid]                    → update role/academy
GET    /api/users/me                       → own profile
PATCH  /api/users/me                       → update own profile
```

### 4.10 Archive / Analytics

```
GET    /api/competitions/[id]/archive      → aggregated stats:
  { athletesByCategory, medalsByAcademy, matchesPlayed, avgMatchDuration }
```

---

## 5. Converting HTML Screens to Next.js Pages

### 5.1 General Pattern

Each HTML file becomes a Next.js page. The rule: **preserve the HTML/CSS exactly, replace static mock data with real API calls.**

```tsx
// app/competitions/page.tsx
'use client';
import { useEffect, useState } from 'react';
import type { Competition } from '@/types';

export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [filter, setFilter] = useState<'all'|'live'|'upcoming'|'done'>('all');

  useEffect(() => {
    fetch(`/api/competitions?status=${filter === 'all' ? '' : filter}`)
      .then(r => r.json())
      .then(d => setCompetitions(d.competitions));
  }, [filter]);

  // Paste the HTML structure from competitions.html here verbatim
  // Replace the hardcoded competition cards with competitions.map(...)
  return ( /* ... exact HTML structure from competitions.html ... */ );
}
```

### 5.2 localStorage Removal

The existing design uses `localStorage` for category schedule state. Replace all `localStorage` usage with API calls:

- `localStorage.getItem('taikaixCategorySchedule')` → `GET /api/competitions/[id]/schedule`
- `localStorage.setItem('taikaixCategorySchedule', ...)` → `PATCH /api/competitions/[id]/schedule/[id]`

Search for `localStorage` across all HTML files and replace every instance.

### 5.3 Screen-by-Screen Conversion Notes

| Screen | Key data wiring |
|---|---|
| `index.html` (Operations Hub) | Fetch live competition stats: active mats count, athletes count, live competitions list |
| `competitions.html` | `GET /api/competitions` with status filter; create modal → `POST /api/competitions` |
| `taikaix-tournament-setup.html` | Phase 2 file dropzone → `POST /api/competitions/[id]/athletes/import`; Phase 3 bracket preview → bracket API |
| `categories.html` | Firestore real-time listener on categories collection for live status chips |
| `bracket.html` | Fetch bracket from API; subscribe to RTDB for live match state on canvas cards |
| `mat-detail.html` | Write score changes directly to RTDB `liveMatches/{matchId}`; timer runs client-side |
| `live-mat.html` | `onValue(ref(rtdb, 'liveMatches/{matchId}'), ...)` — pure RTDB subscription, no auth required |
| `taikaix-karate-scoreboard.html` | Same as live-mat — RTDB subscription, broadcast display |
| `athletes.html` | Firestore collection, toggle attendance/readiness → PATCH endpoint |
| `medals.html` | Fetch + update medals; `received` toggle → PATCH endpoint |
| `taikaix-archive-detail.html` | `GET /api/competitions/[id]/archive`; feed numbers into existing Chart.js instances |
| `users.html` | Admin-only: fetch all users, role/academy edit → PATCH |

### 5.4 Auth Guard Pattern

```tsx
// components/AuthGuard.tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children, requiredRole }: { children: React.ReactNode, requiredRole?: UserRole }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && requiredRole && role !== requiredRole && role !== 'Admin') router.push('/');
  }, [user, role, loading]);
  if (loading) return <div className="loading-state">Loading…</div>;
  return <>{children}</>;
}
```

Public routes (no auth): `/live/mat/[matId]`, `/live/scoreboard/[matchId]`

---

## 6. Real-time Live Scoring — Critical Detail

The mat scoring screen (`mat-detail.html`) is the heart of the live operation. Implement it as follows:

```
Score button clicked
       ↓
Write immediately to RTDB liveMatches/{matchId}   ← latency: <100ms
       ↓
live-mat.html and scoreboard subscribe to RTDB     ← display updates live
       ↓
On "Finish Match" click
       ↓
POST /api/matches/{matchId}/finish                 ← write canonical result to Firestore
       ↓
Clear RTDB entry for that matchId
       ↓
Advance bracket in Firestore (update next-round match with winner)
```

**Timer logic:** Run the countdown timer purely client-side in `mat-detail`. Store `timerSeconds` in RTDB so `live-mat.html` can display it. Use `setInterval` + RTDB updates every second (throttle to avoid write limits — update RTDB every 1s, not on every millisecond).

---

## 7. Excel Import Flow — End to End

This is the core data entry mechanism. The competition organizer uploads an Excel sheet with the athlete roster during Tournament Setup Phase 2.

**Accepted Excel format (communicate to organizers):**

| Name | Academy | Country |
|---|---|---|
| Yamada Kenji | Osaka Dojo | Japan |
| … | … | … |

**Frontend (taikaix-tournament-setup.html Phase 2 dropzone):**
```typescript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('categoryId', selectedCategoryId);
const res = await fetch(`/api/competitions/${competitionId}/athletes/import`, {
  method: 'POST',
  body: formData,
});
const { imported, athletes } = await res.json();
// Show success: "47 athletes imported" status card
// Automatically trigger bracket generation for this category
await fetch(`/api/competitions/${competitionId}/brackets/generate`, {
  method: 'POST',
  body: JSON.stringify({ categoryId: selectedCategoryId, poolSize }),
});
```

**Data lifecycle:** Athletes exist only for the duration of the competition. When a competition is archived (status → `done`), the athlete documents remain under that competition's Firestore subcollection but are not shown in active UIs. There is no global athlete registry — each competition imports fresh.

---

## 8. Firebase Environment Variables

```bash
# .env.local (never commit — add to Vercel dashboard)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=     # RTDB URL

# Server-only (Admin SDK)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=            # paste with \n escaped
```

`lib/firebase.ts` — client SDK (use `NEXT_PUBLIC_` vars, safe in browser):
```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
```

`lib/firebase-admin.ts` — server only (in API routes):
```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
export const adminDb = getFirestore();
export const adminAuth = getAuth();
```

---

## 9. Design Preservation Rules

**These are non-negotiable — the visual system is already done.**

1. **Copy `style.css` verbatim** into `/public/style.css`. Import it in `app/layout.tsx`. Do not rewrite it in Tailwind or CSS modules.
2. **Use the exact CSS variable names** from `brand-spec.md` everywhere: `var(--aka)`, `var(--ao)`, `var(--status-live)`, etc.
3. **Fonts:** Load `Bebas Neue` (display), `DM Sans` (body), `JetBrains Mono` (mono) from Google Fonts in `layout.tsx`.
4. **Preserve all class names** from the HTML files — `bento-card`, `btn`, `chip`, `stat-value`, `ops-score-num`, etc.
5. **Do not introduce Tailwind** — the design uses its own utility system. Mixing them will break things.
6. **Bracket canvas zoom/pan** (scroll-wheel zoom) — preserve the existing canvas interaction exactly as implemented in `bracket.html`.
7. **GSAP animations** — already loaded from CDN in the HTML. Keep the `gsap.min.js` CDN import in the component that needs it.
8. **Status chips** — the Live/Upcoming/Done colors come from CSS vars. Never hardcode colors.

---

## 10. Vercel Deployment

### 10.1 `vercel.json`

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "FIREBASE_ADMIN_PRIVATE_KEY": "@firebase_admin_private_key"
  }
}
```

### 10.2 Vercel Environment Variables

In the Vercel dashboard → Project Settings → Environment Variables, add all variables from `.env.local`. For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the full private key string (the Vercel UI handles newlines correctly).

### 10.3 Build Notes

- `next.config.js` — no special config needed
- `package.json` scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`
- `xlsx` package is server-side only — import it only in API route files, not in client components (to avoid bundling issues)

---

## 11. npm Dependencies

```bash
# Core
npm install next react react-dom typescript

# Firebase
npm install firebase firebase-admin

# Excel parsing (server-side only)
npm install xlsx

# Icons (already used in design via CDN — keep CDN, or install locally)
npm install lucide-react   # optional: use CDN version already in HTML

# Animation (already loaded via CDN in HTML — keep it)
# No npm install needed for GSAP unless you want to remove CDN

# Type utilities
npm install -D @types/node @types/react @types/react-dom
```

---

## 12. Implementation Sequence

Follow this exact order to avoid getting stuck:

1. **Project scaffold** — `npx create-next-app@latest taikaix --typescript --app`
2. **Copy design files** — paste `style.css` into `/public/`, copy all HTML files into a `/design-reference/` folder (for reference only, not served)
3. **Firebase setup** — create project, enable Firestore, RTDB, Auth (Email/Password + Google), Storage; copy config into `.env.local`
4. **Types** — write `types/index.ts` from §3.2
5. **Firebase lib files** — write `lib/firebase.ts` and `lib/firebase-admin.ts`
6. **Auth flow** — login page + `useAuth` hook + `AuthGuard` component
7. **Competitions API + page** — `GET/POST /api/competitions` + `app/competitions/page.tsx`
8. **Tournament setup + Excel import** — Phase 2 of setup wizard + `/api/athletes/import`
9. **Categories + Schedule APIs** — replace all localStorage with API calls
10. **Bracket generation** — `/api/brackets/generate` + `app/competitions/[id]/bracket/page.tsx`
11. **Live mat scoring** — RTDB writes in `mat-detail`, RTDB subscriptions in `live-mat` and scoreboard
12. **Athletes attendance, Medals, Staff** — straightforward CRUD
13. **Users management** — Admin-only
14. **Archive analytics** — aggregate query + Chart.js display
15. **Vercel deployment** — push to GitHub, connect to Vercel, add env vars

---

## 13. Key Decisions & Edge Cases

**Competition data lifecycle:**
Each competition is fully self-contained in Firestore. When a competition ends, set status to `done`. The archive detail page reads from the same Firestore data — no migration needed. Athlete documents are never deleted, just become read-only once the competition is done.

**Bracket variants:**
The design has several `taikaix-bracket-final-*.html` files (iteration copies). Use `taikaix-bracket-final-2-2-2-2.html` as the canonical source — it's the most complete version. Discard the others.

**Multiple mat passwords:**
Each mat has a password set during Tournament Setup Phase 4. This password gates access to `mat-detail.html` for that mat. Implement as: on navigating to `mat-detail`, prompt for mat password if user role is not Admin. Store hashed password in the Mat Firestore document; verify server-side.

**Role normalization:**
The UI shows two different role sets across screens. Normalize to: `Admin`, `Scoreboard Controller`, `Attendance Volunteer`, `Medal Distributor`, `Viewer`. Map the alternate labels (`Tournament Director` → `Admin`, `Mat Operator` → `Scoreboard Controller`, `Referee` → `Viewer`) on import.

**Public broadcast pages:**
`/live/mat/[matId]` and `/live/scoreboard/[matchId]` require no authentication. These are meant to be displayed on large screens at the venue. They subscribe to RTDB only. Mark them with `export const dynamic = 'force-dynamic'` and ensure Firebase RTDB rules allow unauthenticated reads for `liveMatches/` and `matStatus/`.

**Schedule ↔ Categories sync:**
When a category's mat or time is updated in `categories.html`, also update the corresponding schedule row. Do this in the PATCH `/api/competitions/[id]/categories/[catId]` handler — after updating the category, find and update its schedule row.

---

## 14. Firestore Indexes Needed

Create these composite indexes in Firebase Console → Firestore → Indexes:

```
competitions: (status ASC, createdAt DESC)
categories: (competitionId ASC, status ASC)
matches: (competitionId ASC, categoryId ASC, status ASC)
athletes: (competitionId ASC, categoryId ASC)
staff: (competitionId ASC, userId ASC)
medals: (competitionId ASC, categoryId ASC)
schedule: (competitionId ASC, startTime ASC)
```

---

## 15. What NOT to Build

The following screens are design iterations/duplicates — **do not create separate routes for them:**

- `taikaix-bracket-final.html`, `taikaix-bracket-final-2.html`, `taikaix-bracket-final-2-2.html`, `taikaix-bracket-final-2-2-2.html` — use only `-2-2-2-2.html`
- `taikaix-bracket-fix.html` — discard
- `taikaix-prototype.html` — discard
- `taikaix-operations-hub.html` — duplicate of `index.html`; use `index.html`
- `taikaix-medals-panel.html` — simplified version; use `medals.html`
- `taikaix-users-management.html` — simplified version; use `users.html`
- `taikaix-schedule.html` — merge into `schedule.html` (add edit mode toggle to the single schedule page)

**Final production route count: 14 routes** (see project structure in §2).

---

*Stack: Next.js 14 · Firebase Firestore + RTDB + Auth + Storage · Node.js API Routes · Vercel*
*Design source: TaiKaiX HTML/CSS archive — preserve pixel-perfect, replace data only*
