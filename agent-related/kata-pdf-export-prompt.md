# Kata PDF Tiesheet Export — Feature Prompt

## Context & Constraints

PDF tiesheet download is triggered from two places in the codebase:

- `src/app/setup/[id]/page.tsx` → `handleDownloadTiesheets()` at L351
- `src/app/archive/[id]/page.tsx` → `handleDownloadTiesheets()` at L62

Both follow the same pattern:
1. `getDocs(collection(...))` — fetches match documents from Firestore
2. Maps raw docs into a data structure
3. Dynamically imports `exportTiesheetsPDF` from `client/lib/tiesheet-pdf-exporter.ts`
4. Calls `exportTiesheetsPDF(...)` with the mapped data

Inside `tiesheet-pdf-exporter.ts`, the call chain is:

```
exportTiesheetsPDF()          L309
  └─ getRounds()              L171  — determines round structure from bracket
  └─ drawPageHeader()         L238  — category title, athlete names header
  └─ drawMatchBlock()         L152  — per-match outer box
       └─ drawAthleteRow()    L76   — per-athlete row (name, club, state, score circles, penalty boxes)
  └─ getMedalists()           L182  — extracts podium from bracket
  └─ drawMedalistSection()    L198  — renders medal podium at end of category
```

### Files you must NOT break
- `exportTiesheetsPDF()` — existing kumite call path must be unchanged
- `drawAthleteRow()` — the score circles and penalty boxes drawn here are kumite-only;
  do NOT remove them, add a conditional instead
- `drawMatchBlock()` — the outer rect drawn here is shared; keep it
- `getRounds()`, `getMedalists()`, `drawMedalistSection()`, `drawPageHeader()` — untouched
- Both `handleDownloadTiesheets()` callers — minimal changes, only pass additional data

---

## What to Change

### 1. Pass kata data through to the exporter

`handleDownloadTiesheets()` currently maps Firestore docs to match objects and passes
them to `exportTiesheetsPDF`. The kata names (`akaKata`, `aoKata`) are already stored
on match documents (set by the operator panel). They just need to be included in the
mapped data object so the exporter can read them.

In both `setup/[id]/page.tsx` and `archive/[id]/page.tsx`, in the `.map()` that
builds match objects, include:

```ts
akaKata: doc.data().akaKata ?? null,
aoKata:  doc.data().aoKata  ?? null,
```

No other changes to either page file.

### 2. Pass `isKata` flag to `exportTiesheetsPDF`

The exporter needs to know whether a category is kata to switch rendering.
The category type is already available at the time `handleDownloadTiesheets()` runs
(it iterates categories). Add `isKata: boolean` to the category object passed into
`exportTiesheetsPDF`, or pass it as a top-level option parameter:

```ts
// Option A — on the category object already passed in
category.isKata = category.type === 'kata';

// Option B — as a separate options param on exportTiesheetsPDF
exportTiesheetsPDF(doc, matches, category, { isKata: category.type === 'kata' })
```

Choose whichever fits the existing function signature cleanly. Do not break the
existing signature for kumite callers — use a default value if adding a new param:

```ts
export function exportTiesheetsPDF(
  doc: jsPDF,
  matches: MatchData[],
  category: CategoryData,
  options: { isKata?: boolean } = {}   // ← safe default, kumite callers unchanged
) { ... }
```

### 3. Modify `drawAthleteRow()` — conditional score circles and penalties

`drawAthleteRow()` currently draws (based on raw call sites L90–L147):
- Background rect for athlete name area (L90–L103) — **keep**
- Athlete name text (L107–L110) — **keep**
- Club + state text (L113–L117) — **keep**
- Score circle boxes: the filled/outlined rects at L122–L128 — **kumite only**
- Separator lines and score labels at L135–L147 — **kumite only**

Add an `isKata: boolean` parameter to `drawAthleteRow()` (default `false`):

```ts
function drawAthleteRow(
  doc: jsPDF,
  x: number, y: number, w: number,
  athlete: AthleteData,
  isKata = false,
  kataName?: string | null
) {
  // ... name/club/state drawing unchanged ...

  if (!isKata) {
    // existing score circles and penalty boxes — UNTOUCHED
    // L122–L147 code stays exactly as-is here
  } else {
    // kata: draw kata name in the space where score circles were
    drawKataNameInRow(doc, x, y, w, kataName);
  }
}
```

### 4. Add `drawKataNameInRow()` helper — new function

Add a new private helper function in `tiesheet-pdf-exporter.ts` below the existing
helpers. It draws the kata name (or a placeholder) in the horizontal space that the
score circles occupy in kumite rows:

```ts
function drawKataNameInRow(
  doc: jsPDF,
  x: number,
  y: number,
  rowWidth: number,
  kataName: string | null | undefined
) {
  const label = kataName ?? 'Kata not selected';
  const isPlaceholder = !kataName;

  // Light background pill in the score area
  doc.setFillColor(isPlaceholder ? 240 : 230, isPlaceholder ? 240 : 240, isPlaceholder ? 240 : 255);
  doc.rect(x + rowWidth * 0.6, y + 2, rowWidth * 0.36, 8, 'F');

  // Text
  doc.setFont('helvetica', isPlaceholder ? 'italic' : 'bold');
  doc.setFontSize(7);
  doc.setTextColor(isPlaceholder ? 160 : 40, isPlaceholder ? 160 : 40, isPlaceholder ? 160 : 40);
  doc.text(label, x + rowWidth * 0.62, y + 7.5, { maxWidth: rowWidth * 0.32 });
}
```

Adjust x/y/width values to match the actual coordinate system used in the existing
`drawAthleteRow()` — reference L90–L103 for the coordinate baseline.

### 5. Thread `isKata` and kata names through `drawMatchBlock()`

`drawMatchBlock()` calls `drawAthleteRow()` for AKA and AO athletes. Pass the new
params through:

```ts
function drawMatchBlock(
  doc: jsPDF,
  match: MatchData,
  x: number, y: number, w: number, h: number,
  isKata = false
) {
  // existing outer rect — unchanged (L165–L167)
  doc.setDrawColor(...);
  doc.setLineWidth(...);
  doc.rect(x, y, w, h);

  // AKA row
  drawAthleteRow(doc, x, y,           w, match.aka, isKata, isKata ? match.akaKata : undefined);
  // AO row
  drawAthleteRow(doc, x, y + h * 0.5, w, match.ao,  isKata, isKata ? match.aoKata  : undefined);
}
```

### 6. Thread `isKata` through `exportTiesheetsPDF()`

At the point in `exportTiesheetsPDF()` where `drawMatchBlock()` is called (inside
the loop at approx L419–L428 based on the `flatMap`/`filter` calls), pass `isKata`:

```ts
drawMatchBlock(doc, match, x, y, w, h, options.isKata ?? false);
```

---

## Data Model — no new fields required

`akaKata` and `aoKata` are already defined on match documents (established in
`kata-operator-panel-prompt.md`). This feature only reads them.

---

## Acceptance Criteria
- [ ] Kumite PDF tiesheets: visually identical to current output. Score circles and
      penalty boxes appear as before. `exportTiesheetsPDF` called without `isKata`
      option defaults to kumite rendering.
- [ ] Kata PDF tiesheets: no score circles, no penalty boxes in athlete rows.
- [ ] Kata PDF: each athlete row shows the kata name they selected, or "Kata not
      selected" in muted/italic style if `akaKata`/`aoKata` is absent.
- [ ] Both `handleDownloadTiesheets()` callers (setup + archive) pass kata fields
      through with minimal change — only the `.map()` data extraction updated.
- [ ] `drawKataNameInRow()` is a new private function; it does not replace or modify
      any existing drawing function.
- [ ] `drawAthleteRow()` signature change is backward-compatible (`isKata` defaults
      to `false`, `kataName` defaults to `undefined`).
- [ ] No TypeScript errors. No changes to `getRounds()`, `getMedalists()`,
      `drawMedalistSection()`, or `drawPageHeader()`.
