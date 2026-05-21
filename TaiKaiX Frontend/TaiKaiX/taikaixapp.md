# TaiKaiX App — Technical + UX Overview (Backend Handover)

TaiKaiX is a tournament operations console for karate events. It covers setup, live mat operations, tiesheets/brackets, athlete attendance, staff coverage, medal distribution, scheduling, and archival reporting. The UI is built as a multi-screen admin suite with competition-specific sub-navigation and a few broadcast/display surfaces.

## Navigation & screen map

### Global navigation
**Dashboard → Competitions → Users** (plus quick access to Live Bracket and Mat Display on some screens).  
Competition detail screens add a **sub-nav**: **Overview, Categories, Tiesheet, Mats, Staff, Athletes, Medals, Schedule**.

### Screen inventory (files)

| File | Screen | Purpose | Key interactions / notes |
|---|---|---|---|
| `index.html` | Operations Hub | Global admin dashboard with live competition stream | Export report, create new competition, live list w/ status chips |
| `taikaix-operations-hub.html` | Operations Hub (alt) | Polished variant of the dashboard | Same intent as `index.html` |
| `competitions.html` | Competition Management | Competition list w/ Live/Upcoming/Archives filters | Search, filter, create competition modal, archive/delete actions |
| `taikaix-tournament-setup.html` | Tournament Setup Wizard | Guided setup (5 phases) | Categories + mats, pool size + import, tiesheet preview, staff + security, review |
| `competition-detail.html` | Competition Overview | Live competition status + quick actions | Start next match, public link, recent results table |
| `categories.html` | Category Management | Edit category status, mat, and time window | Live/Upcoming/Done status, assign mat, start/end time, localStorage |
| `schedule.html` | Read‑only Schedule | Chronological list derived from Categories | Filters/search, mat filter, listens to localStorage updates |
| `taikaix-schedule.html` | Editable Schedule | Directly edit category schedule rows | Save per row / Save all |
| `bracket.html` | Tiesheet Management | Zoomable tiesheet / bracket canvas | Scroll‑wheel zoom, focus live match, fit all, mat assignment per match |
| `taikaix-bracket-*.html` | Tiesheet variants | Iteration copies of bracket layout | Same feature set as `bracket.html` |
| `mats-grid.html` | Mat Management | Live/standby mats grid | Per‑mat live scores, assign event, navigate to mat detail |
| `mat-detail.html` | Mat Operations | Live scoring + match control hub | Start/pause/finish rounds, points/penalties/senshu, fullscreen overlays |
| `live-mat.html` | Mat Display | Public/broadcast mat scoreboard | Timer countdown, names, penalties |
| `taikaix-karate-scoreboard.html` | Live Scoreboard (broadcast) | Full‑screen broadcast scoreboard | Large format scores, timer, penalties |
| `athletes.html` | Athlete Attendance | Attendance + readiness per category | Present/absent, ready/not ready, disqualify, search |
| `taikaix-live-staff.html` | Live Staff Coverage | Staff assignment by mat/category/medals | Reassign modal, status chips, check‑in counts |
| `medals.html` | Medal Tracking | Medalists per category | Add/remove medalists, received/not received toggle |
| `taikaix-medals-panel.html` | Medals (simple) | Lightweight medal receipt tracking | Toggle received/not received |
| `users.html` | Users & Roles | Role/academy assignment | Search + filters, editable role/academy, role descriptions |
| `taikaix-users-management.html` | Users (simple) | Alternate user assignment table | Role/academy edits + “Saved” indicator |
| `taikaix-profile.html` | User Profile | Profile + competition history | Edit profile CTA |
| `taikaix-edit-profile.html` | Edit Profile | Profile form | Save feedback + redirect |
| `taikaix-archive-detail.html` | Archive Detail | Historical tournament analytics | Charts, tiesheets, leaderboard, medalists tabs |

## Core data entities & relationships

**Competition**
- Fields: id, name, dates, location/venue, type (national/international), rule set (WKF/custom), status (live/upcoming/done).
- Relationships: has many **Categories**, **Mats**, **Schedule rows**, **Staff assignments**, **Athletes**, **Medalists**.

**Category**
- Fields: id, name, age group, weight range, type (standard/special), rules (e.g., “Gold only”), status (live/upcoming/done), assigned mat, start/end time.
- Relationships: has many **Matches**, **Athletes**, **Medalists**.

**Match**
- Fields: id, round, status (upcoming/ongoing/paused/finished), aka/ao competitors, score, point breakdown (yuko/waza/ippon), penalties (C1/C2/C3/HC/H), senshu, timer.
- Relationships: belongs to **Category**, assigned to **Mat**.

**Mat**
- Fields: id/number, status (live/standby), assigned category, operator, next match.
- Relationships: runs many **Matches** over time.

**Athlete**
- Fields: id, name, academy, attendance (present/absent), readiness (ready/not‑ready), disqualified.
- Relationships: belongs to **Category**, may appear as **Medalist**.

**Medalist**
- Fields: athlete, medal type (Gold/Silver/Bronze), received flag.
- Relationships: tied to **Category** and **Athlete**.

**Staff / User**
- Fields: id, name, email, role, academy, assignment scope.
- Roles seen in UI: Admin, Scoreboard Controller, Attendance Volunteer, Medal Distributor, Viewer (plus alt set: Tournament Director, Referee, Mat Operator, Coach).
- Relationships: assigned to **Mats**, **Categories**, or medal distribution scopes.

**Schedule Row**
- Fields: category, mat, start/end time, phase (Quarter‑Finals, Finals, etc.).
- Relationships: derived from Categories or edited directly.

## Status & state model

| Domain | States |
|---|---|
| Competition | `live`, `upcoming`, `done` |
| Category | `live`, `upcoming`, `done` |
| Match | `upcoming`, `ongoing`, `paused`, `finished` |
| Mat | `live`, `standby` |
| Attendance | `present`, `absent` |
| Readiness | `ready`, `not-ready` |
| Medal receipt | `received`, `not-received` |
| Staff assignment | `assigned`, `unassigned` (plus On‑Shift/Standby/Needs‑Assignment labels) |

## Key workflows & how screens connect

### 1. Competition lifecycle
1. **Dashboard (`index.html`)** → **Competitions (`competitions.html`)**.
2. **Create New** competition modal sets basic profile (dates, venue, type, rules, mats).
3. **Setup Tournament (`taikaix-tournament-setup.html`)**:
   - Phase 1: categories + mats (standard & special categories, merge rules).
   - Phase 2: pool size + CSV/XLS import.
   - Phase 3: tiesheet preview (links to `bracket.html`).
   - Phase 4: staff assignment + mat security passwords.
   - Phase 5: review & edit.
4. **Competition Overview (`competition-detail.html`)** for live ops.
5. **Archive (`taikaix-archive-detail.html`)** once completed.

### 2. Category scheduling (two paths)
- **Categories (`categories.html`)** → assigns status + mat + time; saved to `localStorage` key **`taikaixCategorySchedule`**.
  - **Schedule (`schedule.html`)** reads the same localStorage and renders a read‑only, filterable timeline.
- **Editable Schedule (`taikaix-schedule.html`)** is a separate manual scheduler with per‑row save.

### 3. Bracket / tiesheet operations
**Tiesheet (`bracket.html`)** provides:
- Category sidebar with per‑category status and mat.
- Zoom/pan canvas, **scroll‑wheel zooming**, “Focus Live”, “Fit All”.
- Match cards with aka/ao details, scoring metrics, penalties, mat assignment.
- Intended to link from setup preview and competition detail.

### 4. Mat operations & broadcast
**Mat Management (`mats-grid.html`)** → select a mat → **Mat Operations (`mat-detail.html`)**:
- Start, pause, finish rounds; open “New Round”.
- Score controls: add/remove points, penalties, senshu.
- Status pill updates: `ongoing`, `paused`, `finished`.
- Fullscreen overlays for **Scoreboard** and **Leaderboard**.
**Public displays**:
- `live-mat.html` and `taikaix-karate-scoreboard.html` for broadcast‑style views.

### 5. Athlete attendance & medals
**Athletes (`athletes.html`)**:
- Per‑category roster, attendance toggle, readiness toggle, disqualify.
**Medals (`medals.html`)**:
- Add medalist, select medal type, mark received, remove medalist.
**Medals Panel (`taikaix-medals-panel.html`)**:
- Simplified receipt toggles per category.

### 6. Staff coverage
**Live Staff (`taikaix-live-staff.html`)**:
- Assign/reassign score operators by mat.
- Assign attendance volunteers by category.
- Assign medal distributors by scope.
- Reassign modal updates status chips.

### 7. Users & profile
**Users (`users.html`)**:
- Filter/search users, edit role + academy, role descriptions.
**Users (simple)**: `taikaix-users-management.html` with lightweight assignment.
**Profile**: `taikaix-profile.html` → `taikaix-edit-profile.html`.

## Integrations / API surfaces (implied by UI)

These are the backend integrations the UI expects, inferred from the screens:

1. **Competition API**
   - List, create, update, archive competitions.
   - Fields: name, dates, location, type, rule set, mats count, status.

2. **Category & Rules API**
   - CRUD categories, apply rule constraints (age/weight/medal‑based).
   - Status changes (live/upcoming/done).
   - Mat assignment + time windows.

3. **Tiesheet / Bracket API**
   - Generate bracket from CSV/XLS import + pool size.
   - Fetch bracket per category; update match state.

4. **Mat Operations API (real‑time)**
   - Live score updates, penalties, senshu.
   - Match timer status + round state transitions.
   - WebSocket/event stream recommended for live displays.

5. **Athlete & Attendance API**
   - Roster by category, attendance/readiness/disqualify states.

6. **Medals API**
   - Winners list per category, medal assignment, receipt tracking.

7. **Staff & Roles API**
   - User role assignment, staff scheduling, mat security (passwords).

8. **Analytics / Archive API**
   - Aggregates for charts (athletes per category, medals by academy/country).

**External libraries used in UI:** Lucide icons, GSAP animations, Chart.js (archives).

## Notes for backend handover

- **LocalStorage coupling**: `categories.html` → `schedule.html` via `taikaixCategorySchedule`.
- **Status fidelity**: “ongoing / paused / finished” is explicitly modeled in `mat-detail.html` and should map to backend state.
- **Scroll wheel zoom**: bracket zoom is first‑class UX, keep server data compatible with large, pan‑able canvases.
- **Role sets differ across user screens**: normalize roles or keep UI‑specific role catalogs.

