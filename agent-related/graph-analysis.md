# TaikaiX — Graphify Knowledge Graph Analysis

**Generated:** 2026-05-21  
**Source:** `TaiKaiX Frontend/TaiKaiX/` (5 doc files, 10 images)  
**Graph:** 30 nodes · 25 edges · 8 communities  
**Graph files:** `TaiKaiX Frontend/TaiKaiX/graphify-out/graph.html` (interactive)

---

## Graph Summary

Corpus: 15 files (5 docs, 10 images)
- docs: brand-spec.md, DESIGN-HANDOFF.md, mp6paub1-TaiKaiX_DesignGuide.md, PLAN.md, taikaixapp.md

---

## God Nodes (Most Connected Core Abstractions)

| Rank | Node | Edges | Significance |
|---|---|---|---|
| 1 | **Competition Lifecycle Workflow** | 6 | Master orchestrator — connects design, data, workflows |
| 2 | Category Entity (Age/Weight Group) | 3 | Central data entity — athletes, brackets, schedule all depend on it |
| 3 | Mat Operations & Live Scoring Hub | 3 | Critical path — drives RTDB, broadcast screens |
| 4 | Design Fidelity Contract | 2 | Design governance layer |
| 5 | AKA/AO Color System (Red/Blue) | 2 | Bridges design tokens ↔ scoring data |
| 6 | Competition Entity | 2 | Root of the data hierarchy |
| 7 | Match Entity (AKA/AO Scoring) | 2 | Core scoring model |
| 8 | Athlete Entity | 2 | Links excel import → bracket → medals |
| 9 | Bracket/Tiesheet (Zoomable Canvas) | 2 | Key UX feature, depends on category |
| 10 | Schedule Row Entity | 2 | Bridges categories ↔ schedule |

---

## 8 Communities Detected

| Community | Label | Key Nodes |
|---|---|---|
| 0 | **Brand Design Tokens** | Color Tokens, AKA/AO Colors, Competition Entity |
| 1 | **Tournament Data Model** | Athlete, Bracket/Tiesheet, Category, Excel Import, LocalStorage |
| 2 | **Competition Lifecycle** | Status Chips, 29-Screen Inventory, Archive Analytics, Competition Lifecycle |
| 3 | **UI Components System** | Typography, Bento Card, Design Fidelity Contract |
| 4 | **Auth & Access Control** | Auth Guard, Broadcast Screens, Staff Roles, Mat Password, Tournament Setup Wizard |
| 5 | **Next.js / Vercel Stack** | Next.js Stack, Vercel Deployment |
| 6 | **Spacing System** | Spacing System (isolated) |
| 7 | **Responsive Contracts** | Responsive Viewport Contract (isolated) |

---

## Surprising Connections

1. **Status Chips ↔ Competition Lifecycle** [INFERRED, 0.80]
   - The Live/Upcoming/Done status chip design in `DesignGuide.md` is semantically coupled to the competition status state machine in `taikaixapp.md`
   - **Implication**: When implementing status chips, always derive their state from Firestore `competition.status` — don't hardcode

2. **Match Entity ↔ AKA/AO Color System** [INFERRED, 0.90]
   - The match scoring model (aka/ao sides) directly maps to the red/blue color tokens in the design
   - **Implication**: The CSS variables `var(--aka)` and `var(--ao)` must always match the score side — never swap them

3. **Competition Lifecycle ↔ Competition Entity** [EXTRACTED, 1.0]
   - Cross-file connection: `taikaixapp.md` lifecycle workflow directly references `PLAN.md` entity
   - **Implication**: The PLAN.md entity definition is the canonical source of truth for Firestore schema

4. **Bento Card ↔ Design Fidelity Contract** [INFERRED, 0.85]
   - The bento card component pattern is directly governed by the fidelity contract rules
   - **Implication**: `bento-card` CSS class must never be renamed or restructured

5. **29-Screen Inventory ↔ Competition Lifecycle** [EXTRACTED, 1.0]
   - `DESIGN-HANDOFF.md` screen list maps directly to the competition workflow stages
   - **Implication**: Every screen must exist as a distinct route — no merging

---

## Suggested Questions This Graph Can Answer

1. **Why does Competition Lifecycle connect to Brand Design Tokens AND Tournament Data Model?**
   - It's the highest betweenness centrality (0.404) — it's the architectural keystone
   - The competition lifecycle is where design decisions (status chips) meet data decisions (Firestore schema)

2. **Are the 2 inferred relationships involving Competition Lifecycle Workflow correct?**
   - Archive Analytics → Competition Lifecycle: YES — archive is just a read of completed competition data
   - Status Chips → Competition Lifecycle: YES — status chips are direct visual representations of competition.status

3. **What connects Color Tokens, Typography, Spacing to the rest of the system?**
   - 14 weakly-connected nodes found — these are design-only nodes not yet connected to the implementation
   - **Action needed**: When scaffolding Next.js, explicitly import and use these tokens. The connection will be made in code.

---

## Key Architectural Insights from Graph

### Insight 1: The Competition Entity is the Data Root
Every other entity (Category, Match, Athlete, Mat, Staff, Medal, Schedule) is a child of Competition. This maps perfectly to Firestore's subcollection structure. Do NOT denormalize unless performance requires it.

### Insight 2: RTDB and Firestore are two distinct clusters
In the graph, `Firebase RTDB` and `Firestore Schema` are connected (conceptually_related_to) but belong to the same cluster. This confirms the dual-database architecture is correct — they serve different purposes but are complementary.

### Insight 3: Design System is Isolated from Data
Communities 0 (Brand Tokens), 3 (UI Components), 6 (Spacing), 7 (Responsive) are design-only clusters with no direct connections to data or API nodes. This is correct — the design system should be CSS-only, not data-driven.

### Insight 4: Auth & Broadcast are in the Same Community
The Auth Guard and Public Broadcast Screens both live in Community 4. This reveals the tension: broadcast screens BYPASS the auth guard (they're public), but they're architecturally connected because the auth guard explicitly permits their public routes. This exception must be explicitly coded.

---

## Most Interesting Graph Question

> **"Why does Competition Lifecycle connect Brand Design Tokens to Tournament Data Model?"**

**Answer**: Because Competition Status (live/upcoming/done) is the bridge. The design system uses status values to choose which CSS color token to apply (`var(--status-live)`, `var(--status-upcoming)`, `var(--status-done)`). The data model stores `competition.status` as a string enum. The component layer (Status Chips) translates between the two. This means any change to the status state machine in Firestore will require corresponding updates to the CSS token system.
