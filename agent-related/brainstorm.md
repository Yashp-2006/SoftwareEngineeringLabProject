# TaikaiX — Brainstorm Notes

**Date:** 2026-05-21  
**Session:** Initial project setup and architecture planning

---

## What We're Building

TaikaiX is a **karate tournament operations console**. The full UI is already designed — 29 screens in HTML/CSS. The job now is to wire it to a real backend and deploy it.

### Core Problem
A live karate tournament has:
- Multiple mats running simultaneously (each with its own match)
- Score updates happening every few seconds per mat
- Officials watching on broadcast screens
- Organizers managing athlete rosters, brackets, staff, medals
- All of this happening in real-time, simultaneously

### Why Firebase Dual-Database?

**Firestore** is great for structured, persistent data — but it's not designed for sub-100ms updates. Constant score increments would be expensive and slow.

**RTDB** (Realtime Database) is a simple JSON tree optimized for low-latency pub/sub. It's perfect for live scores where you only need the *current* state.

**Decision**: Use RTDB exclusively for live match data (scores, timer, status). Use Firestore for everything else. When a match finishes, promote RTDB state → Firestore and clear the RTDB entry.

---

## Architecture Options Considered

### Option A: Next.js API Routes Only (chosen)
- Frontend + API in one Next.js project
- Firebase Admin SDK runs server-side in API routes
- Deployed as single Vercel project
- ✅ Simple deployment, no separate server
- ✅ Vercel-native, auto CI/CD from GitHub
- ✅ API routes give server-side security (Admin SDK, token verification)

### Option B: Separate Express Backend
- Express.js server for API
- Next.js for frontend only
- Two separate deployments
- ❌ More complex, two Vercel projects
- ❌ CORS configuration needed
- ❌ More DevOps overhead

### Option C: Firebase Functions
- Firebase Cloud Functions for API
- Next.js for frontend
- ❌ Cold start latency
- ❌ More complex local dev
- ❌ Billing surprises

**Winner: Option A** — Next.js API Routes give everything we need with zero extra infrastructure.

---

## Key Design Decisions

### 1. localStorage → API Migration
The existing design uses `localStorage` for category schedule data (`taikaixCategorySchedule`). This is a **bug** in the current design — it means data is lost on browser refresh/different device.

**Plan**: Replace all localStorage usage with API calls during migration:
- `localStorage.getItem('taikaixCategorySchedule')` → `GET /api/competitions/[id]/schedule`
- `localStorage.setItem('taikaixCategorySchedule', ...)` → `PATCH /api/competitions/[id]/schedule/[id]`

### 2. Design Preservation Non-Negotiable
The visual system is already complete. No Tailwind, no CSS modules, no rewrites. Import `style.css` verbatim. Use the exact CSS variable names. Preserve all class names.

### 3. Role Normalization
Two different role sets appear across the UI:
- Set A: Admin, Scoreboard Controller, Attendance Volunteer, Medal Distributor, Viewer
- Set B: Tournament Director, Referee, Mat Operator, Coach

**Normalization map**: Tournament Director → Admin, Mat Operator → Scoreboard Controller, Referee → Viewer, Coach → Viewer

### 4. Bracket Deduplication
The design archive has 6 bracket HTML files. Only `taikaix-bracket-final-2-2-2-2.html` is canonical. Others are iteration copies and should NOT become separate routes.

### 5. Public Broadcast Screens
`/live/mat/[matId]` and `/live/scoreboard/[matchId]` require NO auth. These are meant for venue displays. They subscribe to RTDB only and use `export const dynamic = 'force-dynamic'`.

### 6. Mat Password Security
Each mat has a password set during Tournament Setup Phase 4. This gates access to the mat scoring screen. Hash the password in Firestore; verify server-side. Non-Admin users must enter the password to access mat operations.

---

## Data Flow — Live Scoring (Critical Path)

```
Score button clicked (mat-detail page)
         ↓
write to RTDB liveMatches/{matchId}     ← <100ms latency
         ↓
live-mat.html + scoreboard subscribe    ← displays live
         ↓
"Finish Match" clicked
         ↓
POST /api/matches/{matchId}/finish
         ↓
write final result → Firestore
         ↓
clear RTDB entry
         ↓
advance bracket in Firestore (next round)
```

---

## API Route Map

| Method | Route | Purpose | Auth Required |
|---|---|---|---|
| GET | `/api/competitions` | List all (filterable by status) | Any role |
| POST | `/api/competitions` | Create | Admin |
| GET | `/api/competitions/[id]` | Single with counts | Any role |
| PATCH | `/api/competitions/[id]` | Update | Admin |
| GET | `/api/competitions/[id]/categories` | List categories | Any role |
| POST | `/api/competitions/[id]/categories` | Create | Admin |
| PATCH | `/api/competitions/[id]/categories/[catId]` | Update status/mat/time | Admin |
| POST | `/api/competitions/[id]/athletes/import` | Excel/CSV upload | Admin |
| GET | `/api/competitions/[id]/athletes` | List athletes | Any role |
| PATCH | `/api/athletes/[athleteId]` | Toggle attendance/readiness | Volunteer/Admin |
| POST | `/api/competitions/[id]/brackets/generate` | Generate bracket | Admin |
| GET | `/api/competitions/[id]/brackets/[catId]` | Fetch bracket | Any role |
| PATCH | `/api/matches/[matchId]` | Update score/status | Scoreboard Controller |
| POST | `/api/matches/[matchId]/finish` | Finish match | Scoreboard Controller |
| GET | `/api/competitions/[id]/medals` | List medals | Any role |
| POST | `/api/competitions/[id]/medals` | Assign medal | Admin |
| PATCH | `/api/competitions/[id]/medals/[id]` | Toggle received | Distributor/Admin |
| GET | `/api/competitions/[id]/staff` | List staff | Any role |
| POST | `/api/competitions/[id]/staff` | Assign | Admin |
| GET | `/api/competitions/[id]/schedule` | Get schedule | Any role |
| GET | `/api/users` | List users | Admin |
| PATCH | `/api/users/[uid]` | Update role | Admin |
| GET | `/api/competitions/[id]/archive` | Archive stats | Any role |

---

## Screen-to-Route Mapping (14 Production Routes)

| HTML Source | Next.js Route |
|---|---|
| `index.html` | `/` (Operations Hub) |
| `competitions.html` | `/competitions` |
| `taikaix-tournament-setup.html` | `/competitions/setup` |
| `competition-detail.html` | `/competitions/[id]` |
| `categories.html` | `/competitions/[id]/categories` |
| `taikaix-bracket-final-2-2-2-2.html` | `/competitions/[id]/bracket` |
| `mats-grid.html` | `/competitions/[id]/mats` |
| `mat-detail.html` | `/competitions/[id]/mats/[matId]` |
| `athletes.html` | `/competitions/[id]/athletes` |
| `taikaix-live-staff.html` | `/competitions/[id]/staff` |
| `medals.html` | `/competitions/[id]/medals` |
| `schedule.html` | `/competitions/[id]/schedule` |
| `live-mat.html` | `/live/mat/[matId]` |
| `taikaix-karate-scoreboard.html` | `/live/scoreboard/[matchId]` |
| `taikaix-archive-detail.html` | `/archive/[id]` |
| `users.html` | `/users` |
| `taikaix-profile.html` | `/profile` |
| `taikaix-edit-profile.html` | `/profile/edit` |

---

## Open Questions (for next session)

1. **Filtering logic for competitions** — What fields should the filter apply to? Status only, or also date range, location, type?
2. **Bracket generation seeding** — Random seed or by import order? Any ranking system?
3. **Mat password hashing** — bcrypt or Firebase's built-in hashing? (bcrypt recommended)
4. **Archive retention** — How long do completed competition records persist? Forever?
5. **Multi-day competition** — Can a competition span multiple days with different categories on different days?
6. **Excel column flexibility** — The parser handles `Name/Academy/Club/Country`. Any other column names in use?
