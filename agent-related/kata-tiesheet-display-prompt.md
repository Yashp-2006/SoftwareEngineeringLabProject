# Kata Tiesheet Display — Feature Prompt

## Context & Constraints

This app manages karate competitions. Kumite (fighting) and Kata (forms) are two distinct
discipline types. The tiesheet system is fully built for kumite. This feature adapts the
**tiesheet visual display only** for kata categories — no bracket generation logic changes.

### Files you must NOT break
- `client/lib/tiesheet-generator.ts` — all `buildKata*`, `generateKataBracket()` functions
- `client/lib/tiesheet-pdf-exporter.ts` — `exportTiesheetsPDF()` and all `draw*` helpers
- `client/src/components/BracketViewer.tsx`
- `client/src/components/FullscreenBracketModal.tsx`
- Any kumite match rendering — the change is **conditional on category type being kata**

---

## What to Change

### Where it renders
The tiesheet match/bout blocks render inside `BracketViewer.tsx` and
`FullscreenBracketModal.tsx`. Each match block currently shows two coloured athlete
slots (AKA red / AO blue) with score circles on the left or right of each name.

### The Change: kata match blocks
When the parent category has `type === 'kata'` (or equivalent discriminator field on
the category/bracket document in Firestore):

1. **Remove** the score circles (Yuko / Waza / Ippon indicators — the red circles in
   the tiesheet image). These are kumite-only.

2. **In their place**, render a kata name pill/badge beneath each athlete's name slot:
   - If the match document has `akaKata: string` → show that string in the AKA slot.
   - If the match document has `aoKata: string` → show that string in the AO slot.
   - If the field is absent, null, or empty string → show `"Kata not selected"` in
     muted/italic styling so operators can see it is pending.

3. **No other structural changes** to the bracket layout, match ordering, round
   headers, bye rendering, or pool structure.

### Data model addition
Add two optional fields to the match/node document schema (Firestore + TypeScript types):

```ts
// In your Match / BracketNode type (backend/types/index.ts and wherever used client-side)
akaKata?: string;   // name of kata chosen by AKA athlete for this match
aoKata?: string;    // name of kata chosen by AO athlete for this match
```

These fields are set by the operator panel (see `kata-operator-panel-prompt.md`) and
read here purely for display.

### Rendering logic (pseudocode)
```tsx
// Inside the match block render, gated by category type
if (category.type === 'kata') {
  // replace score circles with kata name badge
  return (
    <div className="kata-name-badge">
      {athleteKata ? athleteKata : <em>Kata not selected</em>}
    </div>
  );
} else {
  // existing kumite score circles — untouched
}
```

### PDF tiesheet (`tiesheet-pdf-exporter.ts`)
In `drawMatchBlock()`, apply the same conditional:
- If category is kata: call a new helper `drawKataNameRow(doc, x, y, kataName)` instead
  of drawing score circles.
- `drawKataNameRow` draws the kata name string (or "Kata not selected" in grey) in the
  same horizontal space the circles previously occupied.
- Do **not** modify `drawAthleteRow()`, `drawMedalistSection()`, `drawPageHeader()`,
  `getRounds()`, or `getMedalists()`.

---

## Acceptance Criteria
- [ ] Kumite bracket blocks are visually identical to before.
- [ ] Kata bracket blocks show no score circles.
- [ ] Kata bracket blocks show kata name or "Kata not selected" per athlete per match.
- [ ] PDF export reflects the same kata name / "not selected" display.
- [ ] No TypeScript errors introduced.
- [ ] `akaKata` / `aoKata` fields typed as `string | undefined` — never required.
