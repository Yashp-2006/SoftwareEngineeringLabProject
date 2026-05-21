# TaiKaiX — Design System & UI Guidelines
**Version:** 1.0  
**Last Updated:** May 2026  

---

## 1. Design Philosophy

TaiKaiX is a **competition-grade** operations tool. The design language draws from the discipline and precision of karate itself — sharp edges, confident hierarchy, controlled energy. It is not decorative; every element serves the operator.

**Core Design Principles:**

1. **Clarity over cleverness** — An operator calling a match cannot afford to hunt for information. Information must be scannable in under 2 seconds.
2. **Status at a glance** — Every screen must communicate system state (upcoming / live / completed) without requiring user interaction.
3. **Controlled energy** — The brand colours (red, blue, white, black) are used purposefully to convey state and hierarchy, not as decoration.
4. **Earned animation** — Motion is used to communicate state change, not to impress. GSAP animations are reserved for key transitions and data-load reveals.
5. **Density with breathing room** — Competition management deals with dense data (hundreds of athletes, dozens of events). The UI embraces density without becoming claustrophobic through deliberate spacing tokens.

---

## 2. Color System

### 2.1 Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--aka` | `#D9262C` | Red/Aka — Primary brand, active states, error states, "Aka" competitor side |
| `--aka-hover` | `#B71C1F` | Darker red for hover/pressed |
| `--aka-light` | `#FDECEA` | Red tint for backgrounds, alerts |
| `--ao` | `#1A4DB5` | Blue/Ao — Secondary brand, links, info states, "Ao" competitor side |
| `--ao-hover` | `#133C96` | Darker blue for hover/pressed |
| `--ao-light` | `#E8EEFB` | Blue tint for backgrounds |
| `--shiro` | `#FFFFFF` | White — Primary background, cards |
| `--kuro` | `#0D0D0D` | Near-black — Primary text, nav background |

### 2.2 Neutral Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `--neutral-900` | `#111111` | Headings |
| `--neutral-700` | `#3D3D3D` | Body text |
| `--neutral-500` | `#6B6B6B` | Secondary text, labels |
| `--neutral-300` | `#C2C2C2` | Borders, dividers |
| `--neutral-100` | `#F4F4F4` | Page background |
| `--neutral-50` | `#FAFAFA` | Subtle card backgrounds |

### 2.3 Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--status-live` | `#16A34A` | Live/ongoing competition |
| `--status-live-bg` | `#F0FDF4` | Live status background |
| `--status-upcoming` | `#D97706` | Upcoming / not started |
| `--status-upcoming-bg`| `#FFFBEB` | Upcoming status background |
| `--status-done` | `#6B6B6B` | Completed |
| `--status-done-bg` | `#F4F4F4` | Completed status background |
| `--warning` | `#F59E0B` | Schedule delay warning |
| `--danger` | `#D9262C` | Same as `--aka` — errors, deletions |

### 2.4 Color Rules

- **Never** use red and blue simultaneously on the same element (they represent opposing competitors — mixing them creates visual confusion).
- Red (`--aka`) is the primary CTA color. Blue (`--ao`) is for secondary actions and informational UI.
- White is the default surface. `--neutral-100` is the page canvas. Cards are `--shiro`.
- Black (`--kuro`) is used only for the navigation bar background and modal overlays.
- Bracket/tie-sheet: Aka side always rendered in `--aka`, Ao side in `--ao`. This is non-negotiable.

---

## 3. Typography

### 3.1 Font Stack

| Role | Font | Weights | Source |
|------|------|---------|--------|
| Display / Headings | **Bebas Neue** | 400 | Google Fonts |
| UI / Body | **DM Sans** | 300, 400, 500, 600 | Google Fonts |
| Monospace / Data | **JetBrains Mono** | 400, 500 | Google Fonts |

**Rationale:**
- *Bebas Neue* is a condensed display typeface — assertive, sporty, and distinct. Used for competition names, section headings, stat numbers. It evokes sports scoreboards.
- *DM Sans* is a geometric humanist sans — highly legible at small sizes, modern but not clinical. Used for all body copy, labels, form elements.
- *JetBrains Mono* is used for athlete IDs, match numbers, weight values — data that benefits from monospacing.

### 3.2 Type Scale

| Level | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| Display | Bebas Neue | 48px | 400 | 1.1 | Competition names, hero numbers |
| H1 | Bebas Neue | 36px | 400 | 1.15 | Page titles |
| H2 | DM Sans | 24px | 600 | 1.3 | Section headings |
| H3 | DM Sans | 18px | 600 | 1.4 | Card titles, tab labels |
| Body | DM Sans | 15px | 400 | 1.6 | Default body text |
| Small | DM Sans | 13px | 400 | 1.5 | Labels, captions, badges |
| Micro | DM Sans | 11px | 500 | 1.4 | Status chips, table headers |
| Data | JetBrains Mono | 14px | 400 | 1.4 | IDs, weights, numbers in tables |

### 3.3 Typography Rules

- Dashboard stat numbers use Bebas Neue at 48px — they must feel like scoreboard values.
- Never use Bebas Neue below 20px — it loses legibility.
- Table body text uses DM Sans 14px / 400.
- All-caps usage: only Micro level and above (never force uppercase on body text).
- Letter spacing: +0.08em on Micro level text, +0.02em on H3 and above in Bebas Neue.

---

## 4. Spacing System

8px base grid. All spacing values are multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Micro gaps (icon to label) |
| `--space-2` | 8px | Tight component padding |
| `--space-3` | 12px | Standard inline padding |
| `--space-4` | 16px | Default component padding |
| `--space-5` | 24px | Card internal padding |
| `--space-6` | 32px | Section gaps |
| `--space-7` | 48px | Large section dividers |
| `--space-8` | 64px | Page-level vertical rhythm |

---

## 5. Component Library

### 5.1 Navigation Bar

- Background: `--kuro` (`#0D0D0D`)
- Height: 60px
- Logo: TaiKaiX wordmark, white, Bebas Neue
- Nav items: DM Sans 14px / 500, color `--neutral-300`, transitions to `--shiro` on hover
- Active item: `--shiro` text + 2px bottom border in `--aka`
- Right side: Profile avatar (circular, 36px) + dropdown chevron
- Shadow: `0 2px 8px rgba(0,0,0,0.4)` — separates nav from light content
- Users item: conditionally rendered only for Admin role; no empty space left behind

### 5.2 Buttons

**Primary Button**
- Background: `--aka`
- Text: white, DM Sans 14px / 600
- Padding: 10px 20px
- Border radius: 6px
- Hover: `--aka-hover` + `transform: translateY(-1px)` + subtle shadow
- Active: `transform: translateY(0)` + `--aka-hover`

**Secondary Button**
- Background: transparent
- Border: 1.5px solid `--ao`
- Text: `--ao`, DM Sans 14px / 600
- Hover: `--ao-light` background

**Destructive Button**
- Same visual as Primary but used only for delete/danger actions
- Requires confirmation dialog before execution

**Ghost Button**
- Background: transparent
- Text: `--neutral-500`
- Hover: `--neutral-100` background
- Used for secondary actions in dense tables

**Icon Button**
- 36px × 36px
- Border radius: 8px
- Hover: `--neutral-100`
- Tooltip on hover (DM Sans 12px, dark tooltip)

**Competition "+" Tab Button**
- Styled like a browser tab
- Dashed border, `--neutral-300`
- Center-aligned `+` icon in `--neutral-500`
- Hover: solid border, `--ao` accent, background `--ao-light`

### 5.3 Cards

**Standard Card**
- Background: `--shiro`
- Border: 1px solid `--neutral-300`
- Border radius: 10px
- Padding: `--space-5` (24px)
- Shadow: `0 1px 4px rgba(0,0,0,0.06)`
- Hover (clickable cards): `transform: translateY(-2px)`, shadow elevation increase

**Competition Card** (in competition list)
- Left accent border: 4px solid — color reflects status (`--aka` for live, `--status-upcoming` for upcoming, `--neutral-300` for completed)
- Contains: Competition name (H3), Date (Small), Status chip, Entry count, Organizer name
- Action icons (Edit, Archive, Delete) appear on hover only — ghost icon buttons

**Bento Grid Tile** (dashboard)
- Background: `--shiro`
- Border: 1px solid `--neutral-300`
- Border radius: 12px
- Tiles vary in size: stat tiles are 1×1, graph tile is 2×1 (spans 2 columns)
- Stat number: Bebas Neue 48px, `--neutral-900`
- Stat label: DM Sans 12px / 500, `--neutral-500`, uppercase, letter-spacing 0.08em

### 5.4 Status Chips

- Border radius: 999px (fully rounded pill)
- Padding: 3px 10px
- Font: DM Sans 11px / 600, uppercase
- No border; background color carries the meaning

| State | Background | Text |
|-------|-----------|------|
| Live | `--status-live-bg` | `--status-live` |
| Upcoming | `--status-upcoming-bg`| `--status-upcoming` |
| Completed | `--status-done-bg` | `--status-done` |

### 5.5 Tables

- Header row: background `--neutral-50`, text `--neutral-500`, DM Sans 11px / 600, uppercase, letter-spacing 0.08em
- Row height: 48px
- Row hover: background `--neutral-50`
- Row border: 1px bottom `--neutral-100`
- Selected row: `--ao-light` background + `--ao` left border 3px
- Pagination: centered below table, ghost buttons, active page in `--aka`
- Data values that are numbers/IDs: JetBrains Mono 13px

### 5.6 Forms & Inputs

- Input height: 40px
- Border: 1.5px solid `--neutral-300`
- Border radius: 6px
- Focus: border color `--ao`, `box-shadow: 0 0 0 3px rgba(26,77,181,0.15)`
- Error state: border `--aka`, error message below in `--aka`, 12px DM Sans
- Label: DM Sans 13px / 500, `--neutral-700`, margin-bottom 6px
- Placeholder: `--neutral-300`

**Multi-step Form Modal**
- Max width: 640px
- Step indicator at top: numbered circles with connector line
  - Active step: `--aka` fill
  - Completed step: `--ao` fill with checkmark
  - Inactive: `--neutral-300` border
- Each step slides in from right (GSAP `xPercent: 100` → `0`)

### 5.7 Bracket / Tie-Sheet

- Each match cell: 160px wide, white background, border 1px `--neutral-300`, border radius 8px
- Aka competitor (upper slot): left border 3px `--aka`
- Ao competitor (lower slot): left border 3px `--ao`
- Winner slot: background `--status-live-bg`, check icon
- Connector lines: SVG, `--neutral-300`, 1.5px stroke
- Match number badge: Bebas Neue 14px, top-right corner, `--neutral-100` background
- Eliminated athletes: text color `--neutral-300` + strikethrough

### 5.8 Modals & Dialogs

- Overlay: `rgba(13,13,13,0.6)` backdrop, `backdrop-filter: blur(4px)`
- Modal: max-width 640px, border-radius 12px, white background
- Entry animation: GSAP `scale: 0.95, opacity: 0` → `scale: 1, opacity: 1`, 0.25s ease-out
- Header: competition name + close button (×)
- Footer: action buttons right-aligned (Primary on right, Cancel on left)
- Confirmation dialogs for destructive actions: red-bordered, danger button

---

## 6. Iconography

- Icon library: **Lucide React** (consistent stroke weight, clean)
- Default size: 18px
- Nav icons: 20px
- Stroke width: 1.75px (do not mix with 2px or 1px — pick one and stick with it)
- Icons are never used alone as actions without a tooltip or label visible on hover
- Competition status icons: 🟢 Live → use CSS dot instead (8px circle, `--status-live`), not emoji

---

## 7. Layout & Grid

### 7.1 Page Layout

```
┌─────────────────────────────────────────────────────┐
│                 NAV BAR (60px, fixed)               │
├─────────────────────────────────────────────────────┤
│         PAGE CONTENT (max-width: 1280px)            │
│  padding: 32px 48px                                 │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Page title (H1) + breadcrumb               │   │
│  ├─────────────────────────────────────────────┤   │
│  │  Main content area                          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 7.2 Dashboard Bento Grid

```
┌──────────────┬──────────────┬────────────────────────┐
│  Total       │  Active      │                        │
│  Competitions│  Competitions│  Bar Graph             │
│  (1×1)       │  (1×1)       │  Comps per Month (2×1) │
├──────────────┼──────────────┤                        │
│  Total Users │  Upcoming    │                        │
│  (1×1)       │  (1×1)       ├────────────────────────┤
│              │              │  Total Athletes (1×1)  │
└──────────────┴──────────────┴────────────────────────┘
```

- Grid: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px`
- Bar graph tile: `grid-column: span 2; grid-row: span 2`

### 7.3 Competition Detail Tabs

- Tab bar: full-width, underline style
- Active tab: `--aka` bottom border 3px, text `--neutral-900`
- Inactive: `--neutral-500`, no border
- Tab content: fades in (GSAP opacity 0→1, 0.2s)

---

## 8. Animation Guidelines (GSAP)

**Use GSAP for:**
- Page transitions (route changes): slide in from right, fade out to left
- Multi-step form slide transitions
- Modal entrance/exit
- Dashboard tile reveal on first load (staggered: `stagger: 0.08s` from bottom)
- Bracket generation reveal (nodes appear sequentially with stagger)
- Number counter animation on dashboard stat tiles (0 → actual value)

**Use CSS transitions for:**
- Button hover states
- Card hover lift
- Nav active state
- Input focus rings
- Status chip color transitions

**Rules:**
- No animation longer than 400ms for UI transitions
- No animation longer than 800ms for data reveals
- All animations must respect `prefers-reduced-motion: reduce` — use `gsap.matchMedia()` to disable/reduce
- Ease: `power2.out` for entrances, `power2.in` for exits, `power3.inOut` for page transitions
- Never animate layout properties (width/height) — animate transform and opacity only

---

## 9. Responsive Breakpoints

| Breakpoint | Width | Layout Adaptation |
|------------|-------|-------------------|
| Desktop (default) | ≥1280px | Full layout, all columns |
| Laptop | 1024–1279px | Reduced padding |
| Tablet | 768–1023px | Bento grid 2-col, nav collapses |
| Mobile | <768px | Single column, hamburger nav |

> **Note:** v1.0 targets desktop and tablet primarily. Mobile is gracefully degraded — all data is accessible but UX is not optimised for touch competition operations.

---

## 10. Accessibility

- All interactive elements have visible focus rings (`outline: 2px solid --ao; outline-offset: 2px`)
- Color is never the sole indicator of state — always accompanied by label or icon
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text (WCAG AA)
- Aria labels on all icon-only buttons
- Tables use `<th scope="col">` and `role="grid"` where appropriate
- Modals trap focus (focus-trap library or native `<dialog>`)
- Error messages are associated with inputs via `aria-describedby`

---

## 11. Dark Mode (Planned v1.1)

All CSS tokens are defined under `:root` (light). A `[data-theme="dark"]` attribute will override:
- `--neutral-100` → `#0A0A0A`
- `--shiro` → `#1A1A1A`
- `--kuro` → `#000000`
- `--neutral-900` → `#F5F5F5`
- `--neutral-700` → `#C2C2C2`
- `--neutral-500` → `#8A8A8A`
- `--neutral-300` → `#333333`

Brand colors (`--aka`, `--ao`) remain unchanged in dark mode.

---

*End of Design Guide v1.0*
