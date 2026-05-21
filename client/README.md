# Client — Next.js 14 App

TaikaiX frontend and API layer, built with Next.js 14 App Router.

## Structure

```
client/
├── app/
│   ├── layout.tsx              # Root layout - imports style.css, fonts
│   ├── page.tsx                # Operations Hub (index.html)
│   ├── login/page.tsx          # Login page
│   ├── competitions/
│   │   ├── page.tsx            # Competition list
│   │   ├── setup/page.tsx      # Tournament Setup Wizard
│   │   └── [id]/
│   │       ├── page.tsx        # Competition Overview
│   │       ├── categories/page.tsx
│   │       ├── bracket/page.tsx
│   │       ├── mats/
│   │       │   ├── page.tsx    # Mats grid
│   │       │   └── [matId]/page.tsx  # Mat detail
│   │       ├── athletes/page.tsx
│   │       ├── staff/page.tsx
│   │       ├── medals/page.tsx
│   │       └── schedule/page.tsx
│   ├── live/
│   │   ├── mat/[matId]/page.tsx       # Public broadcast
│   │   └── scoreboard/[matchId]/page.tsx  # Public scoreboard
│   ├── archive/[id]/page.tsx
│   ├── users/page.tsx
│   ├── profile/
│   │   ├── page.tsx
│   │   └── edit/page.tsx
│   └── api/                    # Next.js API Routes
│       ├── competitions/
│       ├── categories/
│       ├── athletes/
│       ├── matches/
│       ├── brackets/
│       ├── medals/
│       ├── staff/
│       ├── schedule/
│       └── users/
├── components/
│   ├── ui/                     # Button, Chip, Card, Modal
│   ├── nav/                    # GlobalNav, CompetitionSubNav
│   ├── bracket/                # BracketCanvas
│   ├── mat/                    # ScoreControls, MatchTimer
│   └── charts/                 # ArchiveCharts (Chart.js)
├── lib/
│   ├── firebase.ts             # Client SDK init
│   ├── firebase-admin.ts       # Admin SDK (server-side)
│   ├── firestore.ts            # Typed helpers
│   ├── realtime.ts             # RTDB helpers
│   └── excel-parser.ts         # xlsx parse
├── hooks/
│   ├── useMatchLive.ts
│   ├── useCompetition.ts
│   └── useAuth.ts
├── types/
│   └── index.ts                # All TypeScript types
└── public/
    └── style.css               # Design system (copy verbatim)
```

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # lint check
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
# Firebase Client SDK (public - safe in browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=

# Firebase Admin SDK (server-only - never expose to client)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```
