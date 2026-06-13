# Kata Scoreboard — Feature Prompt

## Context & Constraints

The scoreboard lives at `src/app/live/scoreboard/[matchId]/page.tsx`.
It currently renders a kumite-only layout:
- AKA (red) / AO (blue) fighter cards with large score numbers
- YUKO / WAZA / IPPON point columns on each side
- SENSHU indicator
- Penalty row (C1 C2 C3 HC H)
- Countdown timer (starts from match duration, counts down)
- `initialFighterState()`, `handleKeyDown()`, `closeConfirm()`, `formatTime()`

The live mat page at `src/app/live/mat/[matId]/page.tsx` uses
`setupListeners()`, `formatTime()`, `calculatePenalties()` — do not touch those.

### Files you must NOT break
- `scoreboard/[matchId]/page.tsx` — all existing kumite state and rendering must
  remain behind an `isKata` gate; kumite scoreboard users see zero change.
- `live/mat/[matId]/page.tsx` — untouched entirely.
- `ConfirmModal.tsx` — prop contract unchanged.

---

## What to Change

Add an `isKata` boolean derived from the match/category document (same field used
by the operator panel). Gate all rendering changes on it.

### 1. Timer — ascending instead of countdown

For kata, replace the **countdown** timer with an **ascending** timer:
- Starts at `00:00` when the match begins.
- Counts upward each second.
- No end-time enforcement (kata performances have no fixed duration limit).
- The `formatTime()` helper is already in scope — it may need a `direction` param or
  you can add a separate `formatAscendingTime(elapsed: number): string` helper.

For kumite, the existing countdown is untouched.

### 2. Remove kumite scoring columns

For kata matches, do **not** render:
- YUKO column (left and right)
- WAZA column (left and right)
- IPPON column (left and right)
- SENSHU indicator
- Penalty row (C1 C2 C3 HC H) for both sides

These DOM elements should simply not be present when `isKata === true`.

### 3. Replace scoring area with judge flag display

For each judge (1…N, where N comes from `match.judgeCount` or
`category.judgeCount` — see setup wizard prompt for how this is stored), show a
flag indicator:

```
JUDGE 1    JUDGE 2    JUDGE 3   …
  [AKA]      [AO]     [AKA]    ← coloured flag pill per judge vote
```

Layout:
- Each judge gets a labelled slot: "JUDGE 1", "JUDGE 2", etc.
- The slot shows a coloured pill: red "AKA" if that judge voted AKA, blue "AO" if
  voted AO, or empty/grey if the judge has not yet voted.
- AKA-side judges (votes for AKA) appear in the AKA column / left area.
- AO-side judges appear in the AO column / right area.
- If you want a centred layout, show all judges in a horizontal row in the centre
  panel, each clearly colour-coded.

Data source: the match document should have `judgeVotes: Record<judgeId, 'aka' | 'ao'>`.
Subscribe to the same Firestore realtime listener that drives the rest of the scoreboard.

### 4. Kata name display (bottom section)

Replace the penalty row area with two fields per athlete:

```
┌──────────────────────┐   ┌──────────────────────┐
│  KATA NAME           │   │  KATA NAME           │
│  Heian Shodan        │   │  Bassai Dai          │
└──────────────────────┘   └──────────────────────┘
```

- **KATA NAME label** (small caps, muted)
- **Kata name value** — read from `match.akaKata` / `match.aoKata` (set by operator)
- If not yet set: show `"Kata not selected"` in italic/muted style
- This section updates in real-time via the existing Firestore listener.

---

## Data Fields Required on Match Document

```ts
isKata?: boolean;          // or derive from category.type === 'kata'
judgeCount?: number;       // 3, 5, or 7
judgeVotes?: Record<string, 'aka' | 'ao'>;  // keyed by judge index or judge id
akaKata?: string;
aoKata?: string;
```

---

## Acceptance Criteria
- [ ] Kumite scoreboard is visually identical to before.
- [ ] Kata scoreboard shows no YUKO/WAZA/IPPON/SENSHU/PENALTY elements.
- [ ] Kata scoreboard timer counts up from 00:00.
- [ ] Judge vote flags render correctly for 3, 5, and 7 judges.
- [ ] Judge slots update in real-time as votes are cast.
- [ ] Kata name area shows `match.akaKata` / `match.aoKata` or "Kata not selected".
- [ ] No TypeScript errors. Kumite path untouched.
