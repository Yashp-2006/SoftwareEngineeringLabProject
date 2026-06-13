# Kata Operator Panel — Feature Prompt

## Context & Constraints

The operator page is `src/app/competitions/[id]/operator/page.tsx`. It already
conditionally renders `KataOperatorPanel` (imported from
`src/components/kata/KataOperatorPanel.tsx`) when the active category/match is kata.
`KataOperatorPanel` already handles judge scores, DQ, fouls, kata selection, and bunkai
via its sub-components:
- `KataSelectionRow.tsx`
- `JudgeScoreGrid.tsx`
- `FoulPanel.tsx`
- `DQPanel.tsx`
- `TieResolutionModal.tsx`

This feature changes **what the operator panel shows** for a kata match, keeping all
existing kumite operator logic (`addPoint`, `togglePenalty`, `toggleSenshu`,
`handleDisqualify`, etc.) completely intact.

### Files you must NOT break
- `operator/page.tsx` — all kumite handlers (`addPoint`, `togglePenalty`, `toggleSenshu`,
  `handleNextMatch`, `handleFinishCategory`, etc.)
- `KataOperatorPanel.tsx` — `initJudgeScores`, `computeVotes`, `handleScoreChange`,
  `handleDQJudge`, `handleDQ`, `handleLogFoul`, `handleStartPerformance`,
  `handleBeginBunkai`
- `DQPanel.tsx` — `handleConfirmDQ` / `onDQ` prop contract
- `TieResolutionModal.tsx` — `handleAutoStepResult`, `handleRankingResolve`

---

## What to Change

### 1. Scoring section — remove kumite controls for kata matches

When `operator/page.tsx` renders a kata match, the panel must **not** show:
- Yuko / Waza / Ippon point buttons (+/−)
- Senshu toggle
- Penalty buttons (C1, C2, C3, HC, H) for either athlete

These are rendered by the kumite operator UI. Gate them behind `if (!isKata)`.

**Keep visible for kata:**
- "Disqualify AKA" button → calls existing `handleDisqualify('aka')` or `handleDQ`
- "Disqualify AO" button → calls existing `handleDisqualify('ao')` or `handleDQ`

### 2. Kata selection dropdown (per match, per athlete)

Above the DQ buttons, add a kata selection area for **each athlete** (AKA and AO).

#### UI spec
- A searchable dropdown (combobox) per athlete.
- Label: "AKA Kata" / "AO Kata".
- Placeholder: "Search kata…"
- Options list: all 102 WKF-approved kata from `src/lib/kata-list.ts` (already exists).
- Filtering: case-insensitive substring match on kata name as the user types.
- Already-used katas: any kata that appears in `usedKatas` for this athlete in this
  bracket are shown with a ✓ tick and are **disabled / non-selectable** so the athlete
  cannot repeat a kata they've already performed in earlier rounds.
- On selection: call a new handler `handleKataSelect(side: 'aka' | 'ao', kataName: string)`
  which PATCHes the match document in Firestore with `{ akaKata: kataName }` or
  `{ aoKata: kataName }`.

#### Used-kata tracking
When loading the match (`loadMatch()`), compute `usedKatas` for each athlete by
scanning their previous matches in the same bracket:

```ts
// Pseudocode — add inside or after loadMatch()
const usedAkaKatas: string[] = bracketMatches
  .filter(m => m.akaAthleteId === currentMatch.akaAthleteId && m.id !== currentMatch.id)
  .map(m => m.akaKata)
  .filter(Boolean) as string[];

const usedAoKatas: string[] = bracketMatches
  .filter(m => m.aoAthleteId === currentMatch.aoAthleteId && m.id !== currentMatch.id)
  .map(m => m.aoKata)
  .filter(Boolean) as string[];
```

Store these in component state. Pass to the kata selection dropdown to mark/disable.

#### Saving kata selection
`handleKataSelect` should:
1. PATCH Firestore match document: `matches/{matchId}` with `{ akaKata }` or `{ aoKata }`.
2. Update local match state so the tiesheet display reflects immediately.
3. Show a toast on success / error (using the existing `react-hot-toast` import).

---

## Acceptance Criteria
- [ ] Kumite operator panel unchanged (point buttons, penalties, senshu all visible for kumite).
- [ ] Kata operator panel shows no point/penalty/senshu controls.
- [ ] Kata operator panel shows DQ AKA and DQ AO buttons (calling existing DQ logic).
- [ ] Each athlete has a searchable kata dropdown above DQ buttons.
- [ ] Katas already used by an athlete in prior rounds appear ticked and non-selectable.
- [ ] Selecting a kata patches the match document with `akaKata` / `aoKata`.
- [ ] `kata-list.ts` is the sole source of truth for the 102 kata options.
- [ ] No TypeScript errors. No kumite logic touched.
