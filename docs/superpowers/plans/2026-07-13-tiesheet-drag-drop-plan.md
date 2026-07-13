# Tiesheet Drag-and-Drop Match Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable drag-and-drop same-category and cross-category match editing (swapping or moving athletes) on tiesheets, with auto-save directly to Firestore.

**Architecture:** Modify the swap API route to handle cross-category atomic updates in a transaction. Add "Edit Mode" enabling to both setup page and live page by passing `isAdmin` property, track drag states and trigger view switching in the sidebar when dragging, and implement confirm dialogs for cross-category operations.

**Tech Stack:** React, Next.js App Router, Firestore, Tailwind CSS, Lucide icons.

---

### Task 1: API Route Enhancement
**Files:**
- Modify: `client/src/app/api/competitions/[id]/brackets/[catId]/swap/route.ts`

- [ ] **Step 1: Write the updated PATCH handler with cross-category transaction logic**

Replace the entire `PATCH` handler content with transaction support for cross-category swapping and moving.

```typescript
import { NextResponse } from 'next/server';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet-generator';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const { id, catId } = await params;
    const body = await request.json();
    const { sourceMatchId, sourceSide, targetCategoryId, targetMatchId, targetSide, action = 'swap' } = body;

    if (!sourceMatchId || !sourceSide || !targetMatchId || !targetSide) {
      return NextResponse.json({ success: false, error: 'Missing required swap parameters' }, { status: 400 });
    }

    const sourceCatRef = adminDb.collection('competitions').doc(id).collection('categories').doc(catId);
    const targetCatId = targetCategoryId || catId;
    const isCrossCategory = targetCatId !== catId;
    const targetCatRef = isCrossCategory 
      ? adminDb.collection('competitions').doc(id).collection('categories').doc(targetCatId)
      : sourceCatRef;

    const resetWinnerIfByeChanged = (match: any) => {
      const hasAka = !!match.aka;
      const hasAo = !!match.ao;
      
      if (hasAka && !hasAo) {
        match.winnerId = match.aka.playerId;
        match.byeFor = 'ao';
        match.status = 'completed';
      } else if (!hasAka && hasAo) {
        match.winnerId = match.ao.playerId;
        match.byeFor = 'aka';
        match.status = 'completed';
      } else if (hasAka && hasAo) {
        match.winnerId = null;
        match.byeFor = null;
        match.status = 'upcoming';
      } else {
        match.winnerId = null;
        match.byeFor = null;
        match.status = 'upcoming';
      }
    };

    return await adminDb.runTransaction(async (transaction) => {
      const sourceSnap = await transaction.get(sourceCatRef);
      const targetSnap = isCrossCategory ? await transaction.get(targetCatRef) : sourceSnap;

      if (!sourceSnap.exists || !targetSnap.exists) {
        throw new Error('Category not found');
      }

      const sourceData = sourceSnap.data() as any;
      const targetData = targetSnap.data() as any;

      const sourceMatches = [...(sourceData.matches || [])];
      const targetMatches = isCrossCategory ? [...(targetData.matches || [])] : sourceMatches;

      const sourceMatchIdx = sourceMatches.findIndex((m: any) => m.id === sourceMatchId);
      const targetMatchIdx = targetMatches.findIndex((m: any) => m.id === targetMatchId);

      if (sourceMatchIdx === -1 || targetMatchIdx === -1) {
        throw new Error('Match not found');
      }

      const sourceAthlete = sourceMatches[sourceMatchIdx][sourceSide];
      const targetAthlete = targetMatches[targetMatchIdx][targetSide];

      if (action === 'swap') {
        // Swap athletes in matches
        sourceMatches[sourceMatchIdx][sourceSide] = targetAthlete;
        targetMatches[targetMatchIdx][targetSide] = sourceAthlete;

        if (isCrossCategory) {
          const sourceAthletesList = [...(sourceData.athletes || [])];
          const targetAthletesList = [...(targetData.athletes || [])];

          if (sourceAthlete) {
            const idx = sourceAthletesList.findIndex((a: any) => a.playerId === sourceAthlete.playerId);
            if (idx !== -1) sourceAthletesList.splice(idx, 1);
            targetAthletesList.push(sourceAthlete);
          }
          if (targetAthlete) {
            const idx = targetAthletesList.findIndex((a: any) => a.playerId === targetAthlete.playerId);
            if (idx !== -1) targetAthletesList.splice(idx, 1);
            sourceAthletesList.push(targetAthlete);
          }

          sourceAthletesList.sort((a: any, b: any) => a.name.localeCompare(b.name));
          targetAthletesList.sort((a: any, b: any) => a.name.localeCompare(b.name));

          sourceData.athletes = sourceAthletesList;
          sourceData.entries = sourceAthletesList.length;
          targetData.athletes = targetAthletesList;
          targetData.entries = targetAthletesList.length;
        }

        resetWinnerIfByeChanged(sourceMatches[sourceMatchIdx]);
        resetWinnerIfByeChanged(targetMatches[targetMatchIdx]);
      } else {
        // action === 'move' (cross-category move without swapping back)
        if (!sourceAthlete) {
          throw new Error('Source athlete not found');
        }

        // Remove from source matches
        sourceMatches[sourceMatchIdx][sourceSide] = null;
        resetWinnerIfByeChanged(sourceMatches[sourceMatchIdx]);

        // Cascade removal of auto-winner in source matches
        const srcMatch = sourceMatches[sourceMatchIdx];
        if (srcMatch.nextMatchId) {
          const nextMatchIdx = sourceMatches.findIndex((m: any) => m.id === srcMatch.nextMatchId);
          if (nextMatchIdx !== -1) {
            const nextMatch = sourceMatches[nextMatchIdx];
            if (nextMatch.akaFromMatchId === srcMatch.id) {
              nextMatch.aka = null;
            } else if (nextMatch.aoFromMatchId === srcMatch.id) {
              nextMatch.ao = null;
            }
          }
        }

        // Remove from source list
        const sourceAthletesList = [...(sourceData.athletes || [])];
        const athleteIndex = sourceAthletesList.findIndex((a: any) => a.playerId === sourceAthlete.playerId);
        let fullAthleteData = null;
        if (athleteIndex !== -1) {
          fullAthleteData = sourceAthletesList[athleteIndex];
          sourceAthletesList.splice(athleteIndex, 1);
        } else {
          fullAthleteData = {
            playerId: sourceAthlete.playerId,
            name: sourceAthlete.name,
            academy: sourceAthlete.academy || '',
            state: sourceAthlete.state || '',
          };
        }
        sourceData.athletes = sourceAthletesList;
        sourceData.entries = sourceAthletesList.length;

        // Add to target category
        const targetAthletesList = [...(targetData.athletes || [])];
        const newAthlete = {
          ...fullAthleteData,
          categoryId: targetCatId,
        };
        targetAthletesList.push(newAthlete);
        targetAthletesList.sort((a: any, b: any) => a.name.localeCompare(b.name));
        targetData.athletes = targetAthletesList;
        targetData.entries = targetAthletesList.length;

        // Try to place in target matches
        const round1Matches = targetMatches.filter((m: any) => m.round === 1);
        let byeMatchIndex = -1;
        let byeSlot: 'aka' | 'ao' | null = null;

        for (let i = 0; i < round1Matches.length; i++) {
          const m = round1Matches[i];
          if (m.aka && !m.ao && !m.aoFromMatchId) {
            byeMatchIndex = targetMatches.findIndex((match: any) => match.id === m.id);
            byeSlot = 'ao';
            break;
          }
          if (!m.aka && m.ao && !m.akaFromMatchId) {
            byeMatchIndex = targetMatches.findIndex((match: any) => match.id === m.id);
            byeSlot = 'aka';
            break;
          }
          if (!m.aka && !m.ao && !m.akaFromMatchId && !m.aoFromMatchId) {
            byeMatchIndex = targetMatches.findIndex((match: any) => match.id === m.id);
            byeSlot = 'aka';
            break;
          }
        }

        if (byeMatchIndex !== -1 && byeSlot) {
          const targetMatch = targetMatches[byeMatchIndex];
          targetMatch[byeSlot] = {
            playerId: newAthlete.playerId,
            name: newAthlete.name,
            academy: newAthlete.academy || null,
            state: newAthlete.state || newAthlete.country || null,
          };
          targetMatch.winnerId = null;
          targetMatch.status = 'upcoming';

          if (targetMatch.nextMatchId) {
            const nextMatchIdx = targetMatches.findIndex((m: any) => m.id === targetMatch.nextMatchId);
            if (nextMatchIdx !== -1) {
              const nextMatch = targetMatches[nextMatchIdx];
              if (nextMatch.akaFromMatchId === targetMatch.id) {
                nextMatch.aka = null;
              } else if (nextMatch.aoFromMatchId === targetMatch.id) {
                nextMatch.ao = null;
              }
            }
          }
        } else {
          // No BYEs, must regenerate target matches
          const hasStarted = targetMatches.some((m: any) => m.status === 'completed' || m.status === 'live');
          if (hasStarted) {
            throw new Error('Target category has already started and there are no BYE slots available.');
          }

          let poolSize: PoolSize = 8;
          if (round1Matches.length === 2) poolSize = 4;
          else if (round1Matches.length === 4) poolSize = 8;
          else if (round1Matches.length === 8) poolSize = 16;
          else if (round1Matches.length === 16) poolSize = 32;

          const regeneratedMatches = generateBracket(targetAthletesList, 'international', poolSize, { useRoundRobin: targetData.useRoundRobin });
          targetData.matches = regeneratedMatches.map((m: any) => ({
            id: m.id,
            round: m.round,
            matchNumber: m.matchNumber,
            aka: m.aka ? {
              playerId: m.aka.playerId,
              name: m.aka.name,
              academy: m.aka.academy || null,
              state: m.aka.state || m.aka.country || null,
            } : null,
            ao: m.ao ? {
              playerId: m.ao.playerId,
              name: m.ao.name,
              academy: m.ao.academy || null,
              state: m.ao.state || m.ao.country || null,
            } : null,
            akaFromMatchId: m.akaFromMatchId || null,
            aoFromMatchId: m.aoFromMatchId || null,
            akaScore: 0,
            aoScore: 0,
            winnerId: m.winnerId || null,
            nextMatchId: m.nextMatchId || null,
            status: m.status,
            mat: targetData.mat || null,
          }));
        }
      }

      // Write updates
      if (isCrossCategory) {
        transaction.update(sourceCatRef, { matches: sourceMatches, athletes: sourceData.athletes, entries: sourceData.entries, updatedAt: new Date().toISOString() });
        transaction.update(targetCatRef, { matches: targetData.matches || targetMatches, athletes: targetData.athletes, entries: targetData.entries, updatedAt: new Date().toISOString() });
      } else {
        transaction.update(sourceCatRef, { matches: sourceMatches, updatedAt: new Date().toISOString() });
      }

      return NextResponse.json({ success: true });
    });
  } catch (error: any) {
    console.error('Error swapping athletes:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit API Route Change**

Run:
```bash
git add client/src/app/api/competitions/[id]/brackets/[catId]/swap/route.ts
git commit -m "feat(api): support cross-category drag-and-drop swapping and moving in route"
```

---

### Task 2: Bracket Modal Frontend Integration
**Files:**
- Modify: `client/src/components/FullscreenBracketModal.tsx`

- [ ] **Step 1: Update drag states, drop handlers, and hover category switching**

Modify `FullscreenBracketModal.tsx` to:
1. Restrict `isAkaDraggable` and `isAoDraggable` to `upcoming` or `completed` with `byeFor` status matches.
2. Store the category ID during drag-start.
3. Switch active category when dragging over sidebar items after a 500ms timeout.
4. Call `onSwapDrop` with `action: 'swap'` or `'move'` and `targetCategoryId` on cross-category drop.

```typescript
// Replace lines 56-74 in client/src/components/FullscreenBracketModal.tsx:
  const handleDragStart = (e: React.DragEvent, side: 'aka' | 'ao') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: match.id, side, categoryId: activeCategory?.id || '' }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, side: 'aka' | 'ao') => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.matchId && data.side && onSwapDrop) {
        onSwapDrop(data.matchId, data.side, match.id, side, data.categoryId);
      }
    } catch (err) {}
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
```

Change the draggable check to allow BYE/upcoming matches only:
```typescript
// Replace lines 90-91 in client/src/components/FullscreenBracketModal.tsx:
  const isAkaDraggable = isEditMode && !match.akaFromMatchId && (match.status === 'upcoming' || (match.status === 'completed' && !!match.byeFor));
  const isAoDraggable = isEditMode && !match.aoFromMatchId && (match.status === 'upcoming' || (match.status === 'completed' && !!match.byeFor));
```

Update `onSwapDrop` signature in `FullscreenBracketModal` definitions:
```typescript
// Replace lines 710 in client/src/components/FullscreenBracketModal.tsx:
  onSwapDrop?: (
    categoryId: string, 
    sourceMatchId: string, 
    sourceSide: 'aka' | 'ao', 
    targetMatchId: string, 
    targetSide: 'aka' | 'ao',
    targetCategoryId?: string,
    action?: 'swap' | 'move'
  ) => void;
```

Modify the sidebar rendering to add the `onDragOver` category switching timeout:
```typescript
// Add ref for timeout inside FullscreenBracketModal:
  const dragHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

Add handlers to the sidebar items:
```typescript
// Inside FullscreenBracketModal filteredSidebarCats.map (line 1107+):
                    <div 
                      key={cat.id} 
                      className={`fsb-sidebar-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveCatId(cat.id);
                        setShowMobileSidebar(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (cat.id !== activeCatId && !dragHoverTimeoutRef.current) {
                          dragHoverTimeoutRef.current = setTimeout(() => {
                            setActiveCatId(cat.id);
                            dragHoverTimeoutRef.current = null;
                          }, 500);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragHoverTimeoutRef.current) {
                          clearTimeout(dragHoverTimeoutRef.current);
                          dragHoverTimeoutRef.current = null;
                        }
                      }}
                      onDrop={() => {
                        if (dragHoverTimeoutRef.current) {
                          clearTimeout(dragHoverTimeoutRef.current);
                          dragHoverTimeoutRef.current = null;
                        }
                      }}
                    >
```

Modify the swap drop handler inside the modal body:
```typescript
// Replace onSwapDrop callback in FullscreenBracketModal rendering (line 1204+):
                onSwapDrop={async (srcMatchId, srcSide, tgtMatchId, tgtSide, srcCategoryId) => {
                  if (onSwapDrop && activeCategory && srcCategoryId) {
                    if (srcCategoryId !== activeCategory.id) {
                      // Cross-category swap or move
                      const srcCatName = categories.find(c => c.id === srcCategoryId)?.name || 'Source Category';
                      const tgtCatName = activeCategory.name;

                      const srcMatch = categories.find(c => c.id === srcCategoryId)?.matches?.find((m: any) => m.id === srcMatchId);
                      const tgtMatch = activeCategory.matches?.find((m: any) => m.id === tgtMatchId);

                      const srcAthlete = srcMatch ? srcMatch[srcSide] : null;
                      const tgtAthlete = tgtMatch ? tgtMatch[tgtSide] : null;

                      if (!srcAthlete) return;

                      if (tgtAthlete) {
                        const confirmSwap = window.confirm(
                          `Do you want to swap ${srcAthlete.name} (from ${srcCatName}) and ${tgtAthlete.name} (from ${tgtCatName}) between their categories?\n\n` +
                          `Select 'Cancel' to keep things as they are, or 'OK' to proceed with swap.`
                        );
                        if (confirmSwap) {
                          onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'swap');
                        } else {
                          const confirmMove = window.confirm(
                            `Would you like to move ${srcAthlete.name} to ${tgtCatName} without swapping ${tgtAthlete.name} back?\n` +
                            `(Note: This will place ${srcAthlete.name} in a BYE slot / regenerate brackets for ${tgtCatName})`
                          );
                          if (confirmMove) {
                            onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'move');
                          }
                        }
                      } else {
                        const confirmMove = window.confirm(
                          `Are you sure you want to move ${srcAthlete.name} from ${srcCatName} to ${tgtCatName}?`
                        );
                        if (confirmMove) {
                          onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide, activeCategory.id, 'move');
                        }
                      }
                    } else {
                      // Same category
                      onSwapDrop(srcCategoryId, srcMatchId, srcSide, tgtMatchId, tgtSide);
                    }
                  }
                }}
```

- [ ] **Step 2: Commit Frontend Modal changes**

Run:
```bash
git add client/src/components/FullscreenBracketModal.tsx
git commit -m "feat(frontend): enable drag-and-drop edit mode, cross-category swap/move prompt, and hover category switching"
```

---

### Task 3: Wire Up setup wizard and live bracket pages
**Files:**
- Modify: `client/src/app/competitions/[id]/bracket/page.tsx`
- Modify: `client/src/app/setup/[id]/page.tsx`

- [ ] **Step 1: Pass isAdmin and update handleSwapAthletes in bracket/page.tsx**

Update `handleSwapAthletes` in `bracket/page.tsx` to handle optional `targetCategoryId` and `action`:

```typescript
// Replace lines 155-172 in client/src/app/competitions/[id]/bracket/page.tsx:
  const handleSwapAthletes = async (
    categoryId: string, 
    sourceMatchId: string, 
    sourceSide: 'aka' | 'ao', 
    targetMatchId: string, 
    targetSide: 'aka' | 'ao',
    targetCategoryId?: string,
    action?: 'swap' | 'move'
  ) => {
    try {
      const res = await fetch(`/api/competitions/${id}/brackets/${categoryId}/swap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceMatchId, sourceSide, targetMatchId, targetSide, targetCategoryId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'move' ? 'Athlete moved successfully!' : 'Athletes swapped successfully!');
      } else {
        toast.error('Failed to update tiesheet: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating tiesheet:', err);
      toast.error('Failed to update tiesheet. Please try again.');
    }
  };
```

Pass `isAdmin` property to `FullscreenBracketModal` inside `bracket/page.tsx`:
```typescript
// Replace lines 599-612 in client/src/app/competitions/[id]/bracket/page.tsx:
        <FullscreenBracketModal
          categories={categories}
          initialCategoryId={activeCategoryId || undefined}
          highlightMatchId={highlightMatchId}
          mats={mats}
          isAdmin={role === 'admin'}
          onClose={() => {
            setModalOpen(false);
            setHighlightMatchId(null);
          }}
          onPromote={(role === 'admin' || role === 'guest_viewer') ? handlePromote : undefined}
          onAssignMat={(role === 'admin' || role === 'guest_viewer') ? handleAssignMat : undefined}
          onSwapDrop={role === 'admin' ? handleSwapAthletes : undefined}
          onRevertMatch={role === 'admin' ? handleRevertMatch : undefined}
        />
```

- [ ] **Step 2: Add handlers and pass properties to setup/[id]/page.tsx**

Update `FullscreenBracketModalWrapper` in `setup/[id]/page.tsx` to define `handleSwapAthletes`, `handleRevertMatch` and pass them to the modal.

```typescript
// Replace lines 2167-2175 in client/src/app/setup/[id]/page.tsx:
  const handleSwapAthletes = async (
    categoryId: string, 
    sourceMatchId: string, 
    sourceSide: 'aka' | 'ao', 
    targetMatchId: string, 
    targetSide: 'aka' | 'ao',
    targetCategoryId?: string,
    action?: 'swap' | 'move'
  ) => {
    try {
      const res = await fetch(`/api/competitions/${competitionId}/brackets/${categoryId}/swap`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceMatchId, sourceSide, targetMatchId, targetSide, targetCategoryId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'move' ? 'Athlete moved successfully!' : 'Athletes swapped successfully!');
      } else {
        toast.error('Failed to update tiesheet: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating tiesheet:', err);
      toast.error('Failed to update tiesheet. Please try again.');
    }
  };

  const handleRevertMatch = async (categoryId: string, matchId: string) => {
    try {
      const res = await fetch(`/api/competitions/${competitionId}/brackets/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, action: 'revert' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Match reverted successfully!');
      } else {
        toast.error('Failed to revert match: ' + data.error);
      }
    } catch (err) {
      console.error('Error reverting match:', err);
      toast.error('Failed to revert match. Please try again.');
    }
  };

  return (
    <FullscreenBracketModal
      categories={categories}
      initialCategoryId={initialCategoryId || categories[0]?.id}
      firstRoundOnly={true}
      isAdmin={true}
      onSwapDrop={handleSwapAthletes}
      onRevertMatch={handleRevertMatch}
      onClose={onClose}
    />
  );
```

- [ ] **Step 3: Commit Wire Up changes**

Run:
```bash
git add client/src/app/competitions/[id]/bracket/page.tsx client/src/app/setup/[id]/page.tsx
git commit -m "feat(pages): wire up drag-and-drop swap handlers and enable isAdmin in setup and bracket viewer pages"
```
