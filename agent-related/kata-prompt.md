# TaikaiX — Kata Mode Directives
> **Scope:** All changes required to add full Kata support across Setup, Live Ops, Scoring, and Tie Resolution.
> **Constraint:** All existing Kumite logic is untouched. Every Kata branch is gated behind `isKata: true` on the category document.

---

## 1. Data Model Changes

### 1.1 Category Document (Firestore `competitions/{id}/categories/{catId}`)

Add the following fields:

```ts
isKata: boolean                          // gates all kata-mode behaviour
kataMode: "WKF" | "Custom"              // set during setup wizard
kataFormat: "elimination" | "round-robin" | "two-pool"
numberOfJudges: 3 | 5 | 7               // operator-configurable; WKF default = 7 (RR), 5 (elim)
allowedKataList: string[]               // WKF mode = full 102-item list; Custom = operator-selected subset
```

### 1.2 Match Document (RTDB `live_scores/{id}/mats/{matId}`)

When `isKata === true`, replace the Kumite score fields entirely with:

```ts
kataScores: {
  aka: { [judgeIndex: string]: number | null }   // 5.0–10.0 or null (not yet entered) or 0.0 (DQ)
  ao:  { [judgeIndex: string]: number | null }
}
kataVotes: {
  aka: number    // count of judges who voted AKA (higher score for AKA)
  ao:  number
}
kataWinner: "aka" | "ao" | "tie_pending" | null
selectedKata: {
  aka: { number: number; name: string } | null
  ao:  { number: number; name: string } | null
}
phase: "kata" | "bunkai"               // teams in medal rounds only; default "kata"
teamTimerSeconds: number | null        // 300 on start; null for individual bouts
fouls: {
  aka: string[]     // list of foul codes logged this bout
  ao:  string[]
}
isDQ: { aka: boolean; ao: boolean }
```

Remove from RTDB payload when `isKata === true`: `senshu`, `hansoku`, `jogai`, `ippon`, `wazaAri`, `yuko`, `matchTimer`.

### 1.3 Static Constant File

Create `client/src/lib/kata-list.ts` — a plain exported array of 102 objects:

```ts
export const KATA_LIST: { number: number; name: string }[] = [
  { number: 1,  name: "Anan" },
  { number: 2,  name: "Anan Dai" },
  // ... all 102 entries from WKF Appendix 1
]
```

This file is the single source of truth. No Firestore reads for the kata list.

---

## 2. Setup Wizard — Kata Configuration (Phase: Categories)

### 2.1 Discipline Toggle

When the operator selects **"Kata"** as the discipline for a category, reveal a Kata Configuration sub-panel below the standard category fields. This applies to both **WKF mode** and **Custom mode**.

### 2.2 WKF Mode

- Category list is pre-populated from WKF Appendix 2 (14 official categories). Operator selects from the list; they do not type categories freehand.
- `allowedKataList` is automatically set to all 102 kata from `KATA_LIST`. No manual selection needed.
- `numberOfJudges` shows the WKF default per round type:
  - Round-robin rounds: **7**
  - Elimination rounds: **5**
  - Operator may override to 3, 5, or 7. Display a soft warning ("WKF standard is 7/5") if they deviate, but do not block.
- `kataFormat` defaults to `"elimination"` with a dropdown to change.

### 2.3 Custom Mode

The operator must define everything manually:

**Category name:** Free-text input (same as current custom Kumite flow).

**Number of Judges:** Segmented selector — `3 | 5 | 7`. Required. No default. The live operator UI will render exactly this many judge columns.

**Kata Format:** Dropdown — `Elimination | Round-Robin | Two-Pool`.

**Allowed Kata List:** A searchable multi-select panel sourced from `KATA_LIST`. The operator ticks which kata are permitted for this category. A "Select All" shortcut is available. The selection is saved as an array of kata numbers on `allowedKataList`. Minimum 1 kata must be selected before the category can be saved.

### 2.4 Validation

A category with `isKata: true` cannot be saved unless:
- `numberOfJudges` is set.
- `allowedKataList` has at least 1 entry.
- `kataFormat` is set.

---

## 3. Operator Portal — Kata Mode (`operator/page.tsx`)

Gate the entire scoring panel: `isKata ? <KataOperatorPanel /> : <KumiteOperatorPanel />`. Do not modify `KumiteOperatorPanel`.

### 3.1 Pre-Bout: Kata Selection

Before starting the bout, the operator (or runner) records each competitor's chosen kata:

- Two searchable dropdowns, one for AKA and one for AO, populated only from `category.allowedKataList`.
- Dropdown items display as `#number — Kata Name`.
- **Repetition enforcement (client-side):** Query all previous match documents for this athlete in this competition. Disable any kata that has already been used twice. Mark kata used once with a "(used 1×)" label. If all remaining allowed kata have been used twice, show a warning and allow free selection (edge case for long tournaments).
- **Conflict rule:** If the operator selects by number and the name shown doesn't match their intent, the number takes precedence — display a `"Using kata #N"` confirmation chip.
- Confirm selection → writes `selectedKata.aka` and `selectedKata.ao` to the match document.

### 3.2 Active Bout: Judge Score Entry Panel

Render exactly `category.numberOfJudges` judge columns side by side, labelled **J1, J2, … Jn**.

Each judge column contains:
- A **score input** for AKA: numeric stepper, range 5.0–10.0, step 0.1. Blank until entered.
- A **score input** for AO: same.
- A **DQ button** per side: sets that side's score for this judge to `0.0` and marks the cell with a red DQ badge.

All score inputs are **editable until the operator hits Finish**. Scores are written to RTDB on each change so the live display updates in real time.

**Team medal rounds only:** Show a **5:00 countdown timer** at the top of the panel. Timer starts when the operator taps "Start Performance". A "Begin Bunkai" button appears after kata is done — tapping it switches `phase` to `"bunkai"` in RTDB (no bow between kata and bunkai; timer keeps running). Warning pulse at 0:30 remaining. At 0:00, auto-flag the team for time-limit DQ and surface a confirmation dialog for the operator before committing.

### 3.3 Finishing the Bout

Operator clicks **"Finish Bout"** button.

**System actions on finish:**

1. Validate all `numberOfJudges` scores are entered for both AKA and AO. If any are missing, block finish and highlight the empty cells.
2. For each judge `i`, compare `kataScores.aka[i]` vs `kataScores.ao[i]`:
   - Higher score → that side gets the judge's vote.
   - Equal scores (exact tie on a judge): counted as neither — do not add to either vote tally. Surface as a greyed-out column on the display.
3. Compute `kataVotes.aka` and `kataVotes.ao`.
4. **Winner determination:** Majority of judge votes wins. E.g., with 7 judges, first to 4 votes wins.
5. If `kataVotes.aka === kataVotes.ao` (exact tie in votes) → set `kataWinner: "tie_pending"` and trigger the tie resolution flow (Section 5).
6. Otherwise set `kataWinner` and push the complete result to RTDB.

### 3.4 Score Reveal Behaviour

Scores are **hidden from the live display until the operator hits Finish**. The live screen shows "Scores pending…" while the bout is active. On finish, all judge scores and vote indicators animate in simultaneously — this replaces the flag-raise system. Whether the tournament uses physical flags or not, the operator enters numeric scores; the system is the single source of truth.

---

## 4. Live Scoreboard (`live/mat/[matId]`) — Kata Layout

When the RTDB payload has `isKata: true`, render the Kata scoreboard layout. All Kumite panels (timer bar, penalty dots, Ippon/Waza counts) are hidden.

### Layout (top to bottom)

**Header row:** Category name (left) · Round label (right).

**Competitor rows (AKA above, AO below):**
- National flag · Competitor name · Kata name announced (or "—" if not yet announced).

**Judge score grid:**
- `numberOfJudges` columns.
- Pre-finish: each cell shows `–` (dash). No scores visible.
- Post-finish (on `kataWinner` write): all cells animate in simultaneously.
  - Each cell shows the numeric score for AKA (top) and AO (bottom).
  - The cell background fills AKA-red if that judge voted AKA, AO-blue if AO, grey if a tie on that judge.

**Result banner (bottom, appears after finish):**
- `WINNER: AKA X – Y` or `WINNER: AO Y – X` where X and Y are vote counts.
- If `tie_pending`: banner reads `TIE — RESOLUTION IN PROGRESS`.

---

## 5. Tie Resolution

### 5.1 When a Tie is Triggered

`kataVotes.aka === kataVotes.ao` after the operator finishes a bout. This surfaces a **Tie Resolution Modal** in the operator portal. The competition continues normally for other mats while this is resolved.

### 5.2 Tie Resolution Steps (WKF Articles 5.11, 5.12)

The modal walks the operator through each step in order. Each step is attempted; if it resolves the tie, the modal closes and the winner is committed. If not, the next step is shown.

**Individual — Elimination system:**
Majority of judge votes is the sole criterion (Article 5.10). A tie here means truly equal votes — proceed to an extra kata (step below).

**Individual — Round-Robin:**
1. Most victory points across all group bouts (auto-calculated; shown to operator).
2. Head-to-head result between the tied athletes in this group (auto-looked up).
3. Highest cumulative judge-vote count across all group bouts (auto-calculated).
4. Highest WKF World Ranking — operator enters each athlete's ranking manually (free number input) since ranking data is not stored in TaikaiX.
5. Extra kata performance → operator creates a new supplementary bout in the queue marked `"tie-breaker"`.

**Teams — Round-Robin:**
1. Most victory points.
2. Head-to-head match result.
3. Highest cumulative judge-vote count.
4. Extra kata performance (no Bunkai required for this tiebreaker).

**Runner-up comparison across groups (Article 5.13):**
Net judge-vote differential (votes for minus votes against across all group bouts). Auto-calculated and displayed. If still tied: extra kata.

### 5.3 Extra Kata Bout

When tie resolution reaches "extra kata":
- A new match is pushed to the match queue for that mat, flagged `isTieBreaker: true`.
- The kata repetition rules apply — the operator must select a valid kata for each side.
- The bout runs through the full score entry flow (Section 3).
- The winner of the extra kata bout is the final result; this resolves the original tie.

### 5.4 Operator UI for Tie

- A yellow `TIE` badge appears on the match row in the queue.
- The Tie Resolution Modal shows the current step, the computed values for each criterion, and a "Next Step" button if the current step doesn't resolve it.
- Steps resolved automatically (victory points, head-to-head, vote count) show the values and a green checkmark if resolved, or a yellow "Still tied" label if not.
- Steps requiring operator input (world ranking, extra kata) are flagged clearly.
- Once resolved, the modal shows the winner and a "Confirm & Close" button that commits `kataWinner` to RTDB.

---

## 6. Fouls & Disqualification

### 6.1 Foul Logging

A collapsible **Fouls** panel in the Kata operator view. Not tied to automatic scoring deductions — fouls are logged as annotations for judge reference and are visible in the match record. Foul codes:

| Code | Description |
|------|-------------|
| `ANNOUNCE_EARLY` | Kata announced before bow |
| `MINOR_BALANCE` | Minor loss of balance |
| `INCOMPLETE_TECH` | Incorrect/incomplete movement |
| `ASYNC` | Asynchronous movement (or team out of sync) |
| `AUDIBLE_CUE` | Audible cue from outside to guide tempo |
| `THEATRICS` | Stamping, slapping, inappropriate exhalation (serious foul) |
| `WRONG_KIAI` | Incorrect Kiai |
| `BELT_LOOSE` | Belt loose/coming off hips |
| `TIME_WASTE` | Time wasting / exceeded 35-second start window |
| `BUNKAI_INJURY` | Injury caused by lack of control in Bunkai |
| `UNCONSCIOUS_2S` | Simulated unconsciousness >2 seconds in Bunkai |

Operator selects the foul code from a dropdown, selects the side (AKA / AO), and taps "Log Foul". Fouls are appended to `fouls.aka[]` or `fouls.ao[]` on the match document.

### 6.2 Disqualification

A **DQ** button per competitor side, prominent in the operator panel. Tapping it opens a confirmation dialog listing the valid DQ reasons (Article 5.8):

- Wrong / unannounced kata
- No bow at start or end
- Not facing judges at start
- Distinct pause or stop
- Omitted / added / changed movements
- Persistent theatrics
- Corrective step or fall from balance loss
- Belt fell off
- Time limit exceeded (5 min — teams only)
- Jodan Kani Basami in Bunkai
- SHIKKAKU / misconduct

Operator selects the reason, confirms. System sets `isDQ.aka = true` (or `ao`), sets all that side's judge scores to `0.0`, and awards the bout to the opponent. If **both** are DQ'd in a medal bout: a re-performance is scheduled (flagged `isReperformance: true`; no Bunkai required for teams). Chief Judge must call Shugo before DQ is committed — the confirmation dialog includes a checkbox: "Chief Judge has called Shugo ✓".

---

## 7. Bracket / Tiesheet Adaptations

### 7.1 Group Allocation (Round-Robin, Article 3.7.9)

Implement the WKF group allocation table in `tiesheet-generator.ts` for Kata round-robin formats. The table maps `numberOfAthletes` → `numberOfGroups` → `athletesPerGroup[]` exactly as specified in the WKF rules (3–32 athletes, 1–8 groups). Seeds 1–4 are placed into groups 4, 2, 1, 3 (in that order) per the WKF seeding pattern.

### 7.2 Match Cell Display

In `BracketViewer.tsx` and `FullscreenBracketModal.tsx`, when `isKata === true`:
- Show **kata name** as the subtitle of each match cell (below competitor name), once it has been recorded.
- Show the **vote result** (e.g. `4–3`) instead of a point score.
- DQ matches show a `DQ` badge on the disqualified side.

### 7.3 Round-Robin Disqualification Rule

An athlete/team DQ'd during a round-robin bout is **not removed from the draw**. Their opponent wins that bout (3 Victory Points). All other bouts the DQ'd athlete has already won or will play remain valid. Implement this in `tiesheet-generator.ts`: a DQ flag on a match result sets opponent VP to 3 but does not withdraw the DQ'd athlete from remaining scheduled bouts.

---

## 8. Component Architecture

```
operator/page.tsx
  └── isKata
        ├── true  → <KataOperatorPanel categoryId judges={numberOfJudges} />
        │             ├── <KataSelectionRow side="aka|ao" allowedList />
        │             ├── <JudgeScoreGrid judges={n} scores onScoreChange />
        │             ├── <KataTimer />           (team medal rounds only)
        │             ├── <FoulPanel />
        │             ├── <DQPanel />
        │             └── <TieResolutionModal />  (conditional on tie_pending)
        └── false → <KumiteOperatorPanel />       (unchanged)

live/mat/[matId]/page.tsx
  └── isKata
        ├── true  → <KataScoreboard judgeCount scores kataWinner />
        └── false → <KumiteScoreboard />          (unchanged)
```

All new Kata components live under `client/src/components/kata/`.

---

## 9. Implementation Order (Recommended)

1. `lib/kata-list.ts` — static file, no dependencies.
2. Firestore category schema additions + Setup Wizard Kata sub-panel (WKF + Custom, judge count, kata multi-select).
3. RTDB match payload — add kata fields, remove Kumite fields when `isKata`.
4. `KataSelectionRow` + repetition enforcement.
5. `JudgeScoreGrid` — score entry, DQ button, RTDB real-time write.
6. Finish Bout logic — vote calculation, winner determination, tie detection.
7. `TieResolutionModal` — step-by-step resolution flow.
8. `KataScoreboard` — live display with score reveal animation.
9. Bracket adaptations — group allocation table, match cell kata label.
10. Foul / DQ panel + SHIKKAKU confirmation gate.
11. Team Kata — Bunkai phase toggle + 5-minute timer.
12. Extra kata tiebreaker bout flow.