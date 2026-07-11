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

See root directory for:
- `handover.md` — Current state, completed work, next steps
- `taikaix_graph_and_design_audit.md` — System architecture overview, design audit, and knowledge graph insights

See `agent-related/` for:
- Agent scripts and prompts

## Deployment

This project deploys to Vercel automatically on push to `main`:

```bash
git push origin main  # triggers Vercel build
```

Add all environment variables from `.env.local` to Vercel dashboard before first deploy.

## Security

### Environment Variables
- `.env` and `.env.local` are in `.gitignore` and must **never** be committed.
- Use `.env.example` as a template — it contains no real secrets.
- **Firebase Client SDK** (`NEXT_PUBLIC_FIREBASE_*`): safe for browser exposure. Firebase security rules and Auth control access.
- **Firebase Admin SDK** (`FIREBASE_ADMIN_*`): server-only. The private key grants full database admin access. Never prefix with `NEXT_PUBLIC_`.
- **Upstash Redis** (`UPSTASH_REDIS_*`): server-only. Provides rate limiting.
- **Algolia Admin Key** (`ALGOLIA_ADMIN_KEY`): server-only. The search key (`NEXT_PUBLIC_ALGOLIA_SEARCH_KEY`) is search-only and safe client-side.

### ⚠️ If Any Secret Was Ever Exposed
If a credential was ever committed to git history or logged anywhere, **rotate it immediately**:
1. Firebase Admin key → Firebase Console → Service Accounts → Generate new key → revoke old
2. Upstash Redis token → Upstash Console → Reset token
3. Algolia keys → Algolia Dashboard → API Keys → Regenerate

### Vercel Deployment
Set all env vars in Vercel Dashboard → Project Settings → Environment Variables.
Never put secrets in `vercel.json` or any committed config file.
