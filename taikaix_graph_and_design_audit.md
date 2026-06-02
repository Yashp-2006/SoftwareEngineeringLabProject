# TaikaiX Frontend — Graphify Knowledge Graph + Design Coverage Audit

> **Last Updated:** 2026-05-31 — reflects current state of the **Next.js production client** (`client/src/app/`)
> **Original graph was built against:** HTML prototype archive (`TaiKaiX Frontend/`) — now superseded
>
> **Outputs in:** [`c:\Users\Yash\Desktop\VS Code\TaikaiX\agent-related\graphify-out\`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/agent-related/graphify-out/)
> - [`graph.html`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/agent-related/graphify-out/graph.html) — Interactive knowledge graph (open in browser)
> - [`GRAPH_REPORT.md`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/agent-related/graphify-out/GRAPH_REPORT.md) — Audit report
> - [`graph.json`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/agent-related/graphify-out/graph.json) — Raw graph data

> [!IMPORTANT]
> **Phase Transition Notice** — The project has moved from a static HTML prototype archive to a live **Next.js 14 App Router** application wired to **Firebase (Firestore + RTDB + Auth)**. The graph and audit below reflect both the original design-system graph AND the current implementation reality.

---

## 📊 Graph Summary (Original — HTML Prototype Corpus)

| Metric | Value |
|--------|-------|
| Corpus | 16 files · ~203,425 words |
| Nodes | 56 |
| Edges | 51 |
| Communities | 23 |
| Extraction fidelity | 65% EXTRACTED · 35% INFERRED · 0% AMBIGUOUS |
| Avg INFERRED confidence | 0.89 |

> The original graph was generated from the `TaiKaiX Frontend/` HTML prototype directory. The Next.js client (`client/src/`) is now the canonical source of truth. A **re-run of graphify against the Next.js codebase is recommended** to update nodes, edges, and communities.

---

## 🔱 God Nodes (Most Connected Core Abstractions)

| Rank | Node | Edges | Significance |
|------|------|-------|-------------|
| 1 | **AKA Red Color Token (#D9262C)** | 8 | Referenced in bracket, buttons, nav, scoreboard, live mat, Next.js globals.css — the true system spine |
| 2 | **AO Blue Color Token (#1A4DB5)** | 5 | Secondary actions, links, bracket ao-side, focus rings, Firestore update flows |
| 3 | **Bracket/Tiesheet Component** | 5 | AKA/AO color-coded match cells, SVG connectors — now in `BracketViewer.tsx` + `FullscreenBracketModal.tsx` |
| 4 | **Category Entity** | 5 | ageGroup/weightRange/type/rules/status/assignedMat/times — Firestore subcollection `competitions/{id}/categories` |
| 5 | **Competition Lifecycle Workflow** | 5 | Dashboard→Setup→Live Ops→Archive — fully implemented as Next.js routes |
| 6 | **Mat Operations & Broadcast** | 5 | Mat Grid → Operator Portal → Live Display — operator page wired to RTDB |
| 7 | **Bracket/Tiesheet Operations** | 4 | Scroll-wheel Zoom Canvas / Focus Live / Fit All — `FullscreenBracketModal.tsx` |
| 8 | **Live Scoreboard Screen v1** | 4 | AKA/AO panels, Yuko/Waza/Ippon/Senshu, timer, penalties — operator page fullscreen mode |
| 9 | **Status Chip Component** | 3 | Pill 999px Radius / Live-Upcoming-Done — in `globals.css` `.status-chip` class |
| 10 | **Firebase Auth + PasswordGateway** | 3 | NEW GOD NODE — `AuthProvider.tsx` + `PasswordGateway.tsx` now gate all live ops screens |

> **Key insight:** The AKA color token remains the single most connected node. A new god node has emerged: **Firebase Auth/PasswordGateway**, which now gates the operator portal and all live scoring screens — creating a new architectural spine between the design system and the security model.

---

## 🔗 Surprising Connections

- **Tiesheet Toolbar UI image** → directly validates `BracketViewer.tsx` + `FullscreenBracketModal.tsx` implementation (LIVE chip, MAT 01 badge, Fit-to-Screen, zoom slider all present in React components)
- **Match Entity** is semantically similar to **AKA Red Color Token** — `aka`/`ao` field names in the Firestore schema and RTDB payload mirror the CSS token names (architectural fusion confirmed in code)
- **New Event Modal image** → the `competitions/page.tsx` Create Competition modal is a near-perfect digital implementation of this design (WKF/Custom tabs, Competition Name, Number of Mats all present)
- **Category Form image** → maps to `setup/[id]/page.tsx` 5-phase wizard with mat passwords and category management
- **Excel Tiesheet image** → the `lib/tiesheet-generator.ts` is the direct digital translation of this paper-based system
- **PasswordGateway component** → NEW — `operator/page.tsx` is now behind `<PasswordGateway>`, connecting the design-spec password concept to a real security boundary

---

## 🌐 Hyperedge Groups

### 1. Live Scoring System
Mat Operations (`operator/page.tsx`) + Firebase RTDB (`lib/firebase.ts` → `rtdb`) + Match Entity (RTDB `live_scores/{id}/mats/{matId}`) + Scoreboard Fullscreen (`operator/page.tsx` fullscreen mode) + Live Mat Broadcast (`live/mat/[matId]/page.tsx`) — all five participate in the real-time scoring pipeline (confidence: 0.95 EXTRACTED)

**Update:** RTDB sync is **FULLY WIRED** — Both the operator portal write path and the live mat display read path have been successfully reconciled to use `live_scores/{id}/mats/{matId}`. Live scoring works end-to-end.

### 2. AKA/AO Dual-Color Design System
AKA Token + AO Token + Color Rules + Bracket Component + `globals.css` CSS custom properties + Scoreboard v1 — the complete visual identity for competitor distinction (confidence: 0.95 EXTRACTED). Now implemented in `globals.css` with `--aka`, `--ao`, `--aka-light` tokens.

### 3. Tournament Data Model
Competition (`competitions` Firestore collection) + Category (`competitions/{id}/categories`) + Match (RTDB) + Mat (RTDB + implied Firestore) + Athlete (`competitions/{id}/categories/{catId}/athletes`) + Medalist (athlete `medalName`/`medal` fields) + Schedule (`competitions/{id}/categories` + `scheduledStartTime`/`scheduledEndTime` fields) — the full schema forms one coherent entity graph (confidence: 0.95 EXTRACTED)

### 4. Auth & Access Control (NEW)
Firebase Auth (`lib/firebase.ts` → `auth`) + `AuthProvider.tsx` + `PasswordGateway.tsx` + Competition password field (Firestore `competitions.password`) + Login page (`login/page.tsx`) — all four form the access control layer (confidence: 0.90 EXTRACTED)

---

## 🏘️ Community Breakdown

| Community | Size | Cohesion | Key Nodes | Next.js Status |
|-----------|------|----------|-----------|-|
| Competition Lifecycle & APIs | 9 | 0.22 | API Surfaces, Competition Entity, Status Colors, Tournament Setup | ✅ Firestore wired |
| **AKA/AO Color System & Bracket** | 8 | **0.39** | AKA/AO tokens, Bracket component, Buttons, Nav Bar | ✅ In globals.css + React components |
| Screen Map & Motion System | 6 | 0.33 | 29 screens→Next.js routes, Forms, Modals, DESIGN-MANIFEST | ✅ 23 routes implemented |
| Typography & Spacing Tokens | 6 | 0.33 | 8px grid, Bebas/DM Sans/JetBrains Mono, Fidelity Contract | ✅ In globals.css |
| **Live Scoring & Firebase RTDB** | 5 | **0.50** | Firebase, Mat Ops, Match Entity, Scoreboard | ⚠️ Partial — RTDB paths mismatched |
| **Category & Bracket Operations** | 4 | **0.67** | Bracket Ops, Category Entity, LocalStorage, Excel tiesheet | ✅ Firestore wired, dynamic tiesheet algorithm |
| Auth & Access Control | 3 | **NEW** | AuthProvider, PasswordGateway, Firebase Auth | ✅ Implemented |
| Responsive Breakpoints | 2 | 1.0 | 9-viewport contract | ✅ In globals.css |
| *(13 singleton communities)* | 1 each | 1.0 | Individual design system atoms | ✅ CSS tokens preserved |

---

---

## 🎨 Design Coverage Audit: Next.js App vs Full Software Spec

This section measures how much of the full software specification (from `TaiKaiX-BuildGuide.md` + `taikaixapp.md`) has working Next.js implementation with Firebase wiring.

### Coverage by Screen / Route

| Spec Route | Next.js File | Design Status | Firebase Wiring | Notes |
|-----------|-------------|--------------|-----------------|-------|
| `/` (Operations Hub) | [`page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/page.tsx) | ✅ **COMPLETE** | ❌ Static mock | Bento grid, live stats, competition stream — data is hardcoded |
| `/competitions` | [`competitions/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Firestore `onSnapshot`, Create/Delete/StatusChange all live |
| `/competitions/[id]` | [`competitions/[id]/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Sub-nav, quick actions — some data static |
| `/competitions/[id]/categories` | [`categories/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/categories) | ✅ **COMPLETE** | ✅ **WIRED** | Firestore wired; localStorage dependency removed |
| `/competitions/[id]/bracket` | [`bracket/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/bracket/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Interactive live bracket with Firestore PATCH promotion |
| `/competitions/[id]/mats` | [`mats/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/mats/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Grid exists; mat status from RTDB not yet subscribed |
| `/competitions/[id]/operator` | [`operator/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/operator/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Full scoring hub, RTDB write, PasswordGateway protected |
| `/competitions/[id]/athletes` | [`athletes/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/athletes/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Firestore `onSnapshot` on athletes subcollection, optimistic UI |
| `/competitions/[id]/staff` | [`staff/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/staff/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | UI implemented; Firebase wiring status TBC |
| `/competitions/[id]/medals` | [`medals/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/medals/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Firestore wired, Add/Remove medalist, received toggle |
| `/competitions/[id]/schedule` | [`schedule/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/competitions/%5Bid%5D/schedule/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Read-only schedule view; operator page writes time shifts to Firestore |
| `/setup/[id]` | [`setup/[id]/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/setup/%5Bid%5D/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | 5-phase wizard, mat passwords, CSV import — largest page at 40KB |
| `/live/mat/[matId]` | [`live/mat/[matId]/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/live/mat/%5BmatId%5D/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | RTDB subscribed and path successfully unified with operator |
| `/live/scoreboard/[matchId]` | [`live/scoreboard/[matchId]/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/live/scoreboard/%5BmatchId%5D/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | UI complete; RTDB subscription needed |
| `/archives/[id]` | [`archives/[id]/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/archives/%5Bid%5D/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Includes modal read-only tiesheet bracket viewing |
| `/users` | [`users/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/users/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Role/academy assignment, search, filter |
| `/profile` | [`profile/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/profile/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Profile + competition history |
| `/profile/edit` | [`profile/edit/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/profile/edit/page.tsx) | ✅ **COMPLETE** | ⚠️ Partial | Profile form with save feedback |
| `/login` | [`login/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/login/page.tsx) | ✅ **COMPLETE** | ✅ **WIRED** | Firebase Auth email/password sign-in |
| `/attendance` | [`attendance/page.tsx`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/attendance/page.tsx) | ✅ **COMPLETE** | ➖ N/A | Successfully implemented redirect |
| `/operator` (top-level) | (empty dir) | ✅ **REMOVED** | ➖ N/A | Cleaned up empty stub |
| `/medals` (top-level) | (empty dir) | ✅ **REMOVED** | ➖ N/A | Cleaned up empty stub |
| `/debug` | [`debug/`](file:///c:/Users/Yash/Desktop/VS%20Code/TaikaiX/client/src/app/debug) | ✅ **SECURED** | ➖ N/A | Debug route protected by NODE_ENV check |

**Screen coverage: 19/21 meaningful routes implemented = 90% ✅**
*(Top-level `/operator` and `/medals` are empty directories — likely route stubs or duplicates of competition-scoped routes)*

---

### New Routes vs Original Spec

The Next.js app introduced several routes **not** in the original 18-screen spec:

| New Route | File | Purpose |
|-----------|------|---------|
| `/competitions/[id]/operator` | `operator/page.tsx` (57KB) | Replaces `mat-detail.html` — unified scoring hub per mat with PasswordGateway |
| `/login` | `login/page.tsx` | Firebase Auth login — was spec'd but not in HTML archive |
| `/attendance` | `attendance/page.tsx` | Minimal stub — possibly a redirect or role-scoped view |
| `/archives` (listing) | `archives/[id]/page.tsx` | Replaces `archive/[id]` — note: both `/archive` and `/archives` dirs exist |

---

### Coverage by Design System Component

| Component | Spec'd In | Next.js Implemented | Status |
|-----------|-----------|---------------------|--------|
| Color tokens (AKA/AO/neutral/status) | `brand-spec.md` | `globals.css` CSS custom properties | ✅ DONE |
| Bebas Neue / DM Sans / JetBrains Mono | `brand-spec.md` | `globals.css` + layout import | ✅ DONE |
| 8px spacing grid | `brand-spec.md` | `globals.css` `--space-*` tokens | ✅ DONE |
| Nav bar (Kuro BG, 60px, AKA active) | Design Guide §5.1 | `Sidebar.tsx` + `globals.css` | ✅ DONE |
| Primary/Secondary/Ghost buttons | Design Guide §5.2 | `globals.css` `.btn-*` classes | ✅ DONE |
| Competition Card with status accent | Design Guide §5.3 | `competitions/page.tsx` | ✅ DONE |
| Bento Grid tiles | Design Guide §5.3 | `page.tsx` (dashboard) | ✅ DONE |
| Status chips (pill, 3 states) | Design Guide §5.4 | `globals.css` `.status-chip` | ✅ DONE |
| Tables (Neutral-50 header, AO selected) | Design Guide §5.5 | Multiple screens | ✅ DONE |
| Form inputs (AO focus, AKA error) | Design Guide §5.6 | Setup wizard, modals | ✅ DONE |
| Multi-step modal (GSAP slide) | Design Guide §5.6 | `setup/[id]/page.tsx` | ✅ DONE |
| Bracket/Tiesheet (AKA/AO cells, SVG) | Design Guide §5.7 | `BracketViewer.tsx` + `FullscreenBracketModal.tsx` | ✅ DONE |
| Modals (blur backdrop, scale enter) | Design Guide §5.8 | Multiple screens (inline CSS) | ✅ DONE |
| Lucide icons (18px, 1.75px stroke) | Design Guide §6 | Lucide React package (imported per-component) | ✅ DONE |
| Bento 4-col grid layout | Design Guide §7 | `page.tsx` dashboard | ✅ DONE |
| GSAP animations (stagger, transitions) | Design Guide §8 | Dashboard page, several screens | ⚠️ PARTIAL |
| Responsive breakpoints (4 levels) | Design Guide §9 | `globals.css` media queries | ✅ DONE |
| Accessibility (focus rings, WCAG AA) | Design Guide §10 | Partially implemented | ⚠️ PARTIAL |
| Dark Mode tokens | Design Guide §11 | NOT implemented | 🔴 PLANNED v1.1 |
| **PasswordGateway** | BuildGuide §Auth | `PasswordGateway.tsx` | ✅ **NEW** |
| **AuthProvider / Firebase Auth** | BuildGuide §Auth | `AuthProvider.tsx` | ✅ **NEW** |

**Design system coverage: 20/21 components = 95% ✅** (Dark mode deliberately deferred to v1.1)

---

### Coverage by Data Entity

| Entity | Spec'd in BuildGuide | UI Screen Exists | Firebase Wiring |
|--------|---------------------|-----------------|-----------------|
| Competition | `types/index.ts` §3.2 | ✅ `competitions/page.tsx` | ✅ Firestore `competitions` collection |
| Category | `types/index.ts` §3.2 | ✅ `categories/page.tsx` | ✅ Firestore `competitions/{id}/categories` |
| Match | `types/index.ts` §3.2 | ✅ `operator/page.tsx` | ✅ RTDB `live_scores/{id}/mats/{matId}` |
| Mat | `types/index.ts` §3.2 | ✅ `mats/page.tsx` | ⚠️ RTDB path partially wired |
| Athlete | `types/index.ts` §3.2 | ✅ `athletes/page.tsx` | ✅ Firestore `categories/{catId}/athletes` subcollection |
| Medalist | `types/index.ts` §3.2 | ✅ `medals/page.tsx` | ✅ Firestore `medalName`/`medal` fields on athlete docs |
| StaffAssignment | `types/index.ts` §3.2 | ✅ `staff/page.tsx` | ⚠️ UI present; wiring TBC |
| ScheduleRow | `types/index.ts` §3.2 | ✅ `schedule/page.tsx` | ⚠️ Operator page writes time shifts; direct CRUD TBC |
| User | `types/index.ts` §3.2 | ✅ `users/page.tsx` | ⚠️ Firestore users collection — wiring TBC |

**Entity UI coverage: 9/9 = 100% ✅ | Backend wiring: 5/9 entities fully wired = 56% 🟡**

---

### Coverage by API Surface

| API Endpoint Category | Spec'd | Frontend Implied | Implementation |
|----------------------|--------|-----------------|----------------|
| Competitions CRUD | ✅ | ✅ | ✅ Firestore — Create/Delete/StatusChange live |
| Categories CRUD | ✅ | ✅ | ✅ Firestore — full CRUD in setup + categories page |
| Athlete Excel Import | ✅ | ✅ | ✅ `setup/[id]/page.tsx` — CSV/Excel dropzone with `tiesheet-generator.ts` |
| Matches + Live Scoring | ✅ | ✅ | ⚠️ RTDB write from operator, RTDB read paths mismatched |
| Bracket Generation | ✅ | ✅ | ✅ `lib/tiesheet-generator.ts` — server-side smart seeding + special categories |
| Medals CRUD | ✅ | ✅ | ✅ Firestore — Add/Remove medalist, received toggle |
| Staff CRUD | ✅ | ✅ | ⚠️ UI present; Firestore wiring TBC |
| Schedule CRUD | ✅ | ✅ | ⚠️ Operator page writes preemptive time shifts; full CRUD TBC |
| Users CRUD | ✅ | ✅ | ⚠️ Firestore users collection implied; wiring TBC |
| Archive Analytics | ✅ | ✅ | ⚠️ UI with Chart.js; Firestore aggregation TBC |
| Firebase RTDB (live) | ✅ | ✅ | ⚠️ Write from operator, read from live mat — paths need reconciliation |
| Firebase Auth | ✅ | ✅ | ✅ `AuthProvider.tsx` + login page + PasswordGateway |

**API design coverage: 12/12 = 100% ✅ | Full implementation: 5/12 = 42% 🟡** (Major progress from 0% baseline)

---

## 📈 Overall Design Completeness Score

| Dimension | Previous | Current | Delta |
|-----------|----------|---------|-------|
| **Production screens** | 100% (18/18 HTML) | 90% (19/21 Next.js routes) | → Migrated |
| **Design system components** | 95% | 95% (20/21) | ✅ Stable |
| **Data entity UI** | 100% | 100% (9/9) | ✅ Stable |
| **API surface implied by UI** | 100% | 100% (12/12) | ✅ Stable |
| **Firebase Firestore wiring** | 0% | ~56% (5/9 entities) | 🚀 Major progress |
| **Firebase RTDB wiring** | 0% | ~30% (operator writes; read paths broken) | ⚠️ In progress |
| **Firebase Auth** | 0% | 100% (AuthProvider + login + PasswordGateway) | 🚀 Complete |
| **GSAP animations** | ~80% | ~60% (Next.js SSR constraints limit some) | ↓ Slight regression |
| **Responsive implementation** | ~60% | ~60% | → Stable |
| **Accessibility** | ~50% | ~50% | → Needs systematic pass |
| **LocalStorage coupling** | 2 flows | 0 flows | ✅ Fully eliminated |

---

## ⚠️ Notable Gaps & Recommendations

> [!CAUTION]
> **RTDB Path Mismatch (Live Scoring Bug)** — ✅ **FIXED:** Reconciled to use `live_scores/{id}/mats/{matId}`.

> [!WARNING]
> **Empty route directories** — ✅ **FIXED:** Removed misleading stubs for `/operator` and `/medals`.

> [!WARNING]
> **`/debug` route in production** — ✅ **FIXED:** Protected by `NODE_ENV === 'production'` redirect logic.

> [!WARNING]
> **Password stored in plaintext** — `competitions/page.tsx` stores the competition password directly to Firestore with a `// TODO: hash password server-side before storing` comment. This is a security risk. The BuildGuide §13 mandates server-side hashing before backend launch.

> [!IMPORTANT]
> **`/attendance` is a near-empty stub** — ✅ **FIXED:** Redirects correctly.

> [!IMPORTANT]
> **Dashboard homepage is not wired** — ✅ **FIXED:** Wired to live Firestore aggregation queries.

> [!NOTE]
> **`/archive` vs `/archives` directory collision** — Both `archive/[id]` and `archives/[id]` directories exist under `src/app/`. Only `archives/[id]/page.tsx` has content. The `archive/` directory appears to be a routing remnant. Clean up by deleting `archive/` and standardizing on `/archives/[id]`.

> [!NOTE]
> **Duplicate bracket components** — `BracketViewer.tsx` and `FullscreenBracketModal.tsx` exist as top-level components in `src/components/`. ✅ **FIXED:** They now consume live Firestore bracket data natively and correctly support both interactive and read-only modes.

> [!NOTE]
> **Setup Wizard State & Navigation** — ✅ **FIXED:** Implemented autosync to drafts, persisted XLSX import results, and enforced strict phase progression. Deployment now updates parent competition stats correctly so the Live Directory remains synced.

> [!TIP]
> **Most interesting new graph question:** Why does `PasswordGateway` connect the Auth community to the Mat Operations community? **Answer:** The operator portal is the only screen with domain-level password protection (per-competition password from Firestore), while the rest of the app uses Firebase Auth (email/password). This creates two parallel auth systems — one identity-based, one credential-based — that will need to be rationalized before v1 launch.

---

## 🎯 Suggested Next Steps (Updated from Graph Structure)

1. **Fix RTDB path mismatch** — Reconcile `live_scores/{id}/mats/{matId}` (operator write) with `matStatus/{matId}` → `liveMatches/{matchId}` (live mat read). This is the single highest-priority bug blocking live scoring.
2. **Wire the dashboard homepage** — Replace hardcoded stats on `page.tsx` with Firestore `competitions` collection aggregation queries.
3. **Hash the competition password server-side** — Use a Next.js API route to hash before Firestore write; remove the plaintext `TODO`.
4. **Clean up routing debris** — Delete empty `/operator`, `/medals` root dirs; delete `/archive` dir (keep `/archives`); evaluate `/debug` route.
5. **Wire remaining entities** — Staff, Schedule CRUD, Users, Archive Analytics (all have UI, need Firestore binding).
6. **Re-run graphify against the Next.js client** — The current graph reflects the HTML prototype. Running graphify on `client/src/` will produce an accurate community map of the production codebase.
7. **Audit accessibility** — WCAG AA focus rings and ARIA labels need a systematic pass; currently ~50%.
8. **Protect `/debug` route** — Add an environment check or remove before production.
