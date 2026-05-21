# TaikaiX Monorepo

> Karate tournament operations console — live scoring, brackets, athlete management, and archival analytics.

## Project Structure

```
TaikaiX/
├── TaiKaiX Frontend/     # Original HTML/CSS design reference
├── client/               # Next.js 14 App Router (frontend + API routes)
├── backend/              # Shared Firebase logic, utilities, types
├── database/             # Firestore schemas, RTDB structure, security rules, indexes
└── agent-related/        # Docs, specs, handover notes for AI agents
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| API | Next.js API Routes (`/app/api/`) |
| Realtime | Firebase Realtime Database |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Email/Password + Google) |
| Storage | Firebase Storage (Excel imports) |
| Deployment | Vercel (CI/CD from GitHub) |

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase project (Firestore, RTDB, Auth, Storage enabled)
- Vercel account (for deployment)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>

# 2. Set up client
cd client
npm install
cp .env.local.example .env.local
# Fill in Firebase credentials in .env.local

# 3. Run development server
npm run dev
```

### Environment Variables

See `client/.env.local.example` for required variables.

## Design Reference

All original HTML/CSS screens are in `TaiKaiX Frontend/TaiKaiX/`.
- `taikaixapp.md` — Full app overview, data entities, API surfaces
- `TaiKaiX-BuildGuide.md` — Detailed implementation guide
- `brand-spec.md` — Color tokens, typography, spacing

**Design rule: Never deviate from the HTML/CSS design. Wire data only.**

## Agent Documentation

See `agent-related/` for:
- `handover.md` — Current state, completed work, next steps
- `architecture.md` — System architecture overview
- `brainstorm.md` — Brainstorming notes and design decisions
- `graph-analysis.md` — Graphify knowledge graph insights

## Deployment

This project deploys to Vercel automatically on push to `main`:

```bash
git push origin main  # triggers Vercel build
```

Add all environment variables from `.env.local` to Vercel dashboard before first deploy.
