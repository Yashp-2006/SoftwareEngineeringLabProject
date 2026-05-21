# TaikaiX — Agent Handover Document

**Last Updated:** 2026-05-21  
**Session:** Project initialization & structure setup  
**Status:** 🟡 Foundation laid — ready for Next.js scaffold

---

## ✅ Completed This Session

### 1. Project Structure Created
The TaikaiX monorepo is now organized at `C:\Users\Yash\Desktop\VS Code\TaikaiX\`:

```
TaikaiX/
├── TaiKaiX Frontend/       ← Original HTML/CSS design (READ ONLY — do not modify)
├── client/                 ← Next.js 14 app (to be scaffolded)
│   └── README.md           ✅ Created
│   └── .env.local.example  ✅ Created
├── backend/                ← Shared logic, types, Firebase utilities
│   └── README.md           ✅ Created
├── database/               ← Schemas, security rules, index definitions
│   ├── README.md           ✅ Created (full Firestore + RTDB schema)
│   ├── firestore.rules     ✅ Created (role-based security rules)
│   └── database.rules.json ✅ Created (RTDB security rules)
├── agent-related/          ← All AI agent docs go here
│   ├── brainstorm.md       ✅ Created (architecture decisions, API routes)
│   ├── architecture.md     ✅ Created (request flows, component map)
│   ├── graph-analysis.md   ✅ Created (graphify insights)
│   └── handover.md         ← This file
├── README.md               ✅ Created (monorepo overview)
├── .gitignore              ✅ Created
└── (git initialized)       ✅ git init done
```

### 2. Graphify Knowledge Graph
- Ran graphify on TaiKaiX Frontend/TaiKaiX/ (15 files)
- **30 nodes, 25 edges, 8 communities**
- Key finding: **Competition Lifecycle Workflow** is the architectural keystone (6 edges, highest betweenness centrality 0.404)
- Interactive HTML graph: TaiKaiX Frontend/TaiKaiX/graphify-out/graph.html
- Full analysis in agent-related/graph-analysis.md

### 3. Brainstorm & Architecture
- Analyzed all 29 design screens
- Mapped screens to 14 production Next.js routes
- Designed dual-database architecture (Firestore + RTDB)
- Defined full API route surface (23 endpoints)
- Documented all key design decisions
- Identified critical migration task: localStorage to API for schedule data

### 4. Design Reading
- Read all 5 design documents thoroughly:
  - taikaixapp.md — entity model, workflows, API surfaces
  - TaiKaiX-BuildGuide.md — implementation guide
  - DESIGN-HANDOFF.md — responsive contract, screen inventory
  - brand-spec.md — color tokens, typography
  - mp6paub1-TaiKaiX_DesignGuide.md — extended design guide

---

## 🚧 Not Yet Done (Next Steps)

### Immediate Priority: Await Backend Logic from User
The user said: "first do this then ill tell you the backend logics for the filtering etc"
Action: Wait for the user to specify filtering logic before scaffolding the API routes.

### Step 1: Scaffold Next.js Client (after user confirms backend logic)
```bash
cd client
npx -y create-next-app@latest ./ --typescript --app --no-tailwind --no-eslint --import-alias "@/*"
```
Then:
- Copy style.css from TaiKaiX Frontend/TaiKaiX/ to client/public/
- Copy all HTML files to client/design-reference/ (reference only, not served)
- Update layout.tsx with font imports (Bebas Neue, DM Sans, JetBrains Mono from Google Fonts)
- Update next.config.js (minimal config needed)

### Step 2: Firebase Configuration
- User needs to create Firebase project (or share existing one)
- Enable: Firestore, Realtime Database, Auth (Email/Password + Google), Storage
- Copy credentials to client/.env.local
- Deploy Firestore rules from database/firestore.rules
- Deploy RTDB rules from database/database.rules.json
- Create composite indexes (listed in database/README.md)

### Step 3: Core Files (lib/, types/, hooks/)
Create in order:
1. client/types/index.ts — All TypeScript types
2. client/lib/firebase.ts — Client SDK initialization
3. client/lib/firebase-admin.ts — Admin SDK initialization
4. client/lib/firestore.ts — Typed Firestore helpers
5. client/lib/realtime.ts — RTDB helpers
6. client/lib/excel-parser.ts — xlsx parser
7. client/hooks/useAuth.ts — Auth state hook
8. client/hooks/useMatchLive.ts — RTDB subscription hook
9. client/hooks/useCompetition.ts — Firestore listener hook

### Step 4: Auth + AuthGuard Component
- Login page
- AuthGuard component for protected routes
- useAuth hook

### Step 5: API Routes (implementation sequence)
1. Competitions API (GET/POST/PATCH) — filtering logic TBD by user
2. Categories API
3. Athletes import (Excel/CSV) + list
4. Bracket generation
5. Live scoring (RTDB writes + match finish)
6. Medals + Staff + Schedule
7. Users management
8. Archive analytics

### Step 6: Page Conversion (HTML to Next.js TSX)
Convert in this order:
1. index.html → app/page.tsx (Operations Hub)
2. competitions.html → app/competitions/page.tsx
3. competition-detail.html → app/competitions/[id]/page.tsx
4. categories.html → app/competitions/[id]/categories/page.tsx
5. taikaix-bracket-final-2-2-2-2.html → app/competitions/[id]/bracket/page.tsx
6. mats-grid.html → app/competitions/[id]/mats/page.tsx
7. mat-detail.html → app/competitions/[id]/mats/[matId]/page.tsx — CRITICAL (live scoring)
8. live-mat.html → app/live/mat/[matId]/page.tsx (public, no auth)
9. taikaix-karate-scoreboard.html → app/live/scoreboard/[matchId]/page.tsx (public, no auth)
10. athletes.html → app/competitions/[id]/athletes/page.tsx
11. taikaix-live-staff.html → app/competitions/[id]/staff/page.tsx
12. medals.html → app/competitions/[id]/medals/page.tsx
13. schedule.html → app/competitions/[id]/schedule/page.tsx
14. taikaix-tournament-setup.html → app/competitions/setup/page.tsx
15. taikaix-archive-detail.html → app/archive/[id]/page.tsx
16. users.html → app/users/page.tsx
17. taikaix-profile.html → app/profile/page.tsx
18. taikaix-edit-profile.html → app/profile/edit/page.tsx

### Step 7: Vercel Deployment
- Push to GitHub
- Connect to Vercel
- Add environment variables to Vercel dashboard
- First deploy + smoke test

---

## 🚨 Critical Rules for All Agents

1. NEVER modify TaiKaiX Frontend/ — It is the design source. Read-only.
2. NEVER import Tailwind or CSS modules — Use only style.css and its CSS variables
3. NEVER hardcode colors — Always use CSS variables (var(--aka), var(--status-live), etc.)
4. NEVER merge localStorage with Firestore — Replace all localStorage usage with API calls
5. ALWAYS use taikaix-bracket-final-2-2-2-2.html as bracket source (not other bracket variants)
6. ALWAYS run /live/mat/ and /live/scoreboard/ without auth (public broadcast screens)
7. ALWAYS hash mat passwords (bcrypt, server-side) — never store plaintext
8. ALWAYS write score updates to RTDB directly (not through API route) for lowest latency
9. ALWAYS promote RTDB to Firestore when match finishes (call /api/matches/[id]/finish)
10. localStorage taikaixCategorySchedule must be replaced with GET/PATCH /api/competitions/[id]/schedule

---

## 🗂️ Key Files for Any New Agent

| File | Why You Need It |
|---|---|
| TaiKaiX Frontend/TaiKaiX-BuildGuide.md | Complete implementation guide |
| TaiKaiX Frontend/TaiKaiX/taikaixapp.md | Entity model + workflow + API surface |
| TaiKaiX Frontend/TaiKaiX/brand-spec.md | Color tokens, typography (don't deviate) |
| TaiKaiX Frontend/TaiKaiX/style.css | The complete design system CSS |
| agent-related/brainstorm.md | Architecture decisions + API route map |
| agent-related/architecture.md | Request flows + component map |
| agent-related/graph-analysis.md | Graphify insights, critical dependencies |
| database/README.md | Full Firestore + RTDB schema |
| database/firestore.rules | Security rules (deploy to Firebase) |

---

## 🎯 End Goal

A fully deployed TaikaiX application at a Vercel URL:
- All 14 production routes live and wired to Firebase
- Live scoring working in real-time (RTDB, <100ms)
- Brackets generated from Excel imports
- Auth working with 5 roles
- Public broadcast screens accessible without login
- Deployed via GitHub CI/CD through Vercel

---

## 📌 Waiting On User

Before scaffolding the Next.js app and API routes:
1. Filtering logic: What filters apply to competition list? (status, date range, type, location?)
2. Any other backend logic the user wants to specify before implementation starts
