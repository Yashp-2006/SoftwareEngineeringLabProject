# Backend — Shared Firebase Logic & Utilities

Server-side utilities, typed helpers, and shared logic used by the Next.js API routes.

## What Lives Here

```
backend/
├── lib/
│   ├── firebase-admin.ts     # Firebase Admin SDK init (used in all API routes)
│   ├── firestore.ts          # Typed Firestore collection helpers
│   ├── realtime.ts           # RTDB helpers for live scoring
│   └── excel-parser.ts       # xlsx-based athlete roster parser
├── middleware/
│   ├── auth.ts               # Verify Firebase ID token, extract role
│   └── rbac.ts               # Role-based access control checks
├── services/
│   ├── bracket-generator.ts  # Single-elimination bracket algorithm
│   ├── match-finisher.ts     # Promote RTDB score → Firestore, advance bracket
│   └── archive-aggregator.ts # Compute archive stats from Firestore
└── types/
    └── index.ts              # All shared TypeScript types (Competition, Match, etc.)
```

## Design Principles

1. **Server-only**: Nothing in this folder runs in the browser
2. **Typed**: Every entity has a TypeScript interface in `types/index.ts`
3. **Stateless**: All functions are pure transformations or Firebase calls
4. **Shared**: Imported by `client/app/api/` routes — not duplicated

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

## Bracket Generator Logic

```
Input: athlete[] + poolSize
Output: Match[] with bracketPosition (R1-M1, R1-M2, etc.)

Algorithm:
1. Seed athletes (random or ranked)
2. Calculate rounds = ceil(log2(athletes.length))
3. Generate R1 matches with seeded pairings
4. Create empty slots for R2..Rfinal (filled as matches finish)
5. Store as flat Match[] array in Firestore
```
