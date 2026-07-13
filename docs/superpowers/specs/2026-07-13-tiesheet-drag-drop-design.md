# Design Spec: Tiesheet Drag-and-Drop Match Editing

## Goal
Enable tournament organizers (admins) to edit tiesheets manually by dragging and dropping athletes between match slots. Supports:
1. Same-category athlete swapping/moving.
2. Cross-category athlete swapping/moving.
   - When dropping onto an occupied slot in another category, prompts the user:
     - **Yes**: Swap Athlete A and Athlete B between their categories.
     - **No**: Move Athlete A to the target category, leaving Athlete B there (runs on-spot entry logic to place Athlete A, regenerating bracket / increasing pool size if no BYE slots are available).
     - **Cancel**: Do nothing.
   - When dropping onto an empty slot in another category:
     - Prompts the user: "Are you sure you want to move Athlete A to this category?"
     - If yes, moves Athlete A, leaving their old slot empty (creating a BYE in the source category).
3. Hovering over sidebar categories during drag to switch views.
4. **Auto-save**: Every drag-and-drop action immediately commits to the database, ensuring zero lost edits.

---

## Proposed Architecture

### 1. API Changes
Modify `PATCH /api/competitions/[id]/brackets/[catId]/swap` to handle:
- `targetCategoryId`
- `action` ('swap' | 'move')

#### Swap Action:
- Runs an atomic Firestore transaction.
- Read both category documents.
- Swap the athletes in their respective matches (updating player details).
- Update both categories' `athletes` arrays (moving source player to target category, and target player to source category).
- Re-sort both athletes lists alphabetically.
- Re-calculate match byes/winners if matches now have 1 or 0 players.
- Commit updates to both documents.

#### Move Action:
- Runs an atomic Firestore transaction.
- **Source Category**:
  - Remove Athlete A from the `athletes` array.
  - Set Athlete A's slot in the match to `null`.
  - Re-calculate match byes/winners for that match.
  - Clear advanced winner from next match if applicable.
- **Target Category**:
  - Add Athlete A to target category `athletes` array.
  - Search for a Round 1 BYE slot in the target category.
  - If found: Fill the BYE slot with Athlete A, clear auto-advance.
  - If not found: Verify category hasn't started, then regenerate the entire bracket using `generateBracket` with the updated athlete list (increasing pool size if needed).

### 2. Frontend Changes (`FullscreenBracketModal.tsx`)
- Pass `isAdmin={role === 'admin'}` in both Setup Wizard and Live Bracket page.
- Track a hover timeout ref for switching category views:
  - Hovering a sidebar category item during drag for `500ms` triggers `setActiveCatId(cat.id)`, switching the view.
- Update `handleDragStart` to pack `categoryId: activeCategory.id` in `dataTransfer`.
- Update `handleDrop` to:
  - If `data.categoryId !== activeCategory.id`:
    - Find target athlete (if occupied).
    - If occupied, prompt: `"Do you want to swap [Player A] and [Player B] between categories? (Select 'No' to move [Player A] without swapping [Player B] back)"`
      - **Yes**: Call PATCH API with `action: 'swap'`.
      - **No**: Call PATCH API with `action: 'move'`.
    - If empty, prompt: `"Are you sure you want to move [Player A] to this category?"`
      - **Yes**: Call PATCH API with `action: 'move'`.
  - If `data.categoryId === activeCategory.id`:
    - Call PATCH API with same category swap.
- Immediate UI updates: Since API write commits directly, Firestore `onSnapshot` real-time listener automatically fetches updated bracket, refreshing display instantly.

---

## Verification Plan

### Manual Verification
1. Open Setup Wizard -> Phase 3 (Tiesheets). Click "Edit Mode". Drag athlete to empty slot in same category. Verify slot becomes empty and target is filled.
2. Drag athlete to occupied slot in same category. Verify athletes are swapped.
3. Drag athlete over another category in sidebar. Verify view switches after 500ms. Drop onto a slot. Verify confirmation dialog appears and swap completes.
4. Verify same flow in Live Tournament bracket viewer.
