# TaikaiX — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL (CI/CD)                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js 14 App (client/)                │   │
│  │                                                      │   │
│  │  ┌──────────────────┐  ┌──────────────────────────┐  │   │
│  │  │   React Pages    │  │    API Routes (/api/)    │  │   │
│  │  │  (App Router)    │  │  (Firebase Admin SDK)    │  │   │
│  │  └────────┬─────────┘  └────────────┬─────────────┘  │   │
│  │           │                         │                 │   │
│  └───────────┼─────────────────────────┼─────────────────┘   │
│              │                         │                      │
└──────────────┼─────────────────────────┼──────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│                        FIREBASE                               │
│                                                              │
│  ┌──────────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │  Firestore       │  │   RTDB      │  │ Firebase Auth  │  │
│  │  (Persistent)    │  │ (Live only) │  │  + Storage     │  │
│  └──────────────────┘  └─────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Request Flow Patterns

### Pattern 1: Standard CRUD (most API routes)
```
Browser → Next.js API Route → Firebase Admin SDK → Firestore → Response
```

### Pattern 2: Live Scoring (mat-detail.html)
```
Browser → Firebase Client SDK → RTDB (direct write, <100ms)
           ↑
           (live-mat.html subscribes via onValue listener)
```

### Pattern 3: Match Finish
```
Browser → POST /api/matches/[id]/finish
        → Firebase Admin SDK reads RTDB final state
        → Writes canonical result to Firestore
        → Advances bracket (updates next-round match)
        → Clears RTDB entry
```

### Pattern 4: Excel Import
```
Browser → POST /api/competitions/[id]/athletes/import (multipart)
        → API reads file buffer
        → lib/excel-parser.ts parses xlsx/csv
        → Batch writes athletes to Firestore
        → Triggers bracket generation for category
```

## Component Architecture

```
client/
├── app/api/          → Server-side, Firebase Admin SDK, auth verification
├── components/
│   ├── ui/           → Primitives (Button, Chip, Card, Modal)
│   ├── nav/          → GlobalNav, CompetitionSubNav
│   ├── bracket/      → BracketCanvas (zoom/pan, scroll-wheel zoom)
│   ├── mat/          → ScoreControls, MatchTimer, PenaltyPanel
│   └── charts/       → ArchiveCharts (Chart.js wrappers)
├── hooks/
│   ├── useAuth.ts    → Firebase Auth state + role resolver
│   ├── useMatchLive  → RTDB subscription for live match score
│   └── useCompetition→ Firestore real-time listener
└── lib/
    ├── firebase.ts   → Client SDK (NEXT_PUBLIC_ vars only)
    ├── firebase-admin→ Admin SDK (server-only, private keys)
    ├── firestore.ts  → Typed collection helpers + queries
    ├── realtime.ts   → RTDB read/write helpers
    └── excel-parser  → xlsx → athlete[] transformer
```

## Auth Architecture

```
User logs in (Firebase Auth Email/Password or Google)
          ↓
Firebase issues ID Token
          ↓
Client includes token in API requests (Authorization: Bearer <token>)
          ↓
API routes verify token via Firebase Admin SDK
          ↓
Middleware reads user role from Firestore /users/{uid}
          ↓
RBAC check: does this role have permission for this action?
```

### Role Matrix

| Resource | Admin | Scoreboard Controller | Attendance Volunteer | Medal Distributor | Viewer |
|---|---|---|---|---|---|
| Competitions (read) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Competitions (write) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Athletes (read) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Athletes (attendance) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Matches (score update) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Medals (received toggle) | ✅ | ❌ | ❌ | ✅ | ❌ |
| Users (manage) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Bracket (generate) | ✅ | ❌ | ❌ | ❌ | ❌ |

## Realtime Architecture — RTDB Structure

```json
{
  "liveMatches": {
    "{matchId}": {
      "status": "ongoing | paused | finished",
      "timerSeconds": 120,
      "timerRunning": true,
      "aka": { "score": 4, "yuko": 2, "wazaAri": 1, "ippon": 0, "senshu": false, "penalties": {} },
      "ao":  { "score": 2, "yuko": 1, "wazaAri": 0, "ippon": 0, "senshu": true,  "penalties": {} },
      "updatedAt": 1716300000000
    }
  },
  "matStatus": {
    "{matId}": { "status": "live | standby", "currentMatchId": "...", "updatedAt": 0 }
  }
}
```

## Deployment Architecture

```
GitHub main branch push
         ↓
Vercel detects push (webhook)
         ↓
Vercel builds Next.js (npm run build)
         ↓
Deployed to Vercel edge network
         ↓
Environment variables injected from Vercel dashboard
```

**Environment variables to set in Vercel dashboard:**
- All `NEXT_PUBLIC_FIREBASE_*` (client SDK)
- All `FIREBASE_ADMIN_*` (Admin SDK - marked as "sensitive")

## Bracket Algorithm

```
function generateBracket(athletes: Athlete[], poolSize: number): Match[] {
  1. Filter to ready, non-disqualified athletes
  2. Shuffle or seed by import order
  3. rounds = Math.ceil(Math.log2(athletes.length))
  4. For R1: pair athletes sequentially (M1: [0] vs [1], M2: [2] vs [3], ...)
  5. Handle byes: odd number → last athlete gets auto-advance
  6. For R2..Rfinal: create empty match slots (winnerId fields null)
  7. Set bracketPosition for each: "R{round}-M{matchNum}"
  8. Write all matches to Firestore in batch
  9. Return complete Match[] array for canvas rendering
}
```
