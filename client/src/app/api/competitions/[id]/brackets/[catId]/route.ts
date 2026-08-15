import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { updateBracketSchema } from '@taikaix/backend/types/schemas';
import { z } from 'zod';

/**
 * PATCH /api/competitions/{id}/brackets/{catId}
 * Body: { matchId: string, winnerId: string }
 *
 * Atomically:
 *  1. Marks the match as completed with the given winner
 *  2. Pushes the winner's athlete data into the next round's match slot
 *  3. Returns the updated matches array
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'mat_operator') {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 403 });
    }
    const { id, catId } = await params;
    const body = await req.json();
    const validated = updateBracketSchema.parse(body);
    const { matchId, winnerId, byeFor, selectedKata, action } = validated;
    // byeFor = 'aka' | 'ao' — means that side won by BYE (opponent disqualified/absent)

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    if (action !== 'revert' && !winnerId && !selectedKata) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'winnerId or selectedKata is required' } }, { status: 400 });
    }

    const catRef = adminDb
      .collection('competitions')
      .doc(id)
      .collection('categories')
      .doc(catId);

    const catSnap = await catRef.get();
    if (!catSnap.exists) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } }, { status: 404 });
    }

    const catData = catSnap.data()!;
    const matches: any[] = [...(catData.matches || [])];

    // Find the current match
    const currentIdx = matches.findIndex(m => m.id === matchId);
    if (currentIdx === -1) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Match not found' } }, { status: 404 });
    }

    const currentMatch = matches[currentIdx];

    // Handle revert action
    if (action === 'revert') {
      if (!currentMatch.winnerId && currentMatch.status !== 'completed') {
        return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Match is not completed' } }, { status: 400 });
      }

      const clearNextMatches = (currentMatchId: string) => {
        const idx = matches.findIndex((m: any) => m.id === currentMatchId);
        if (idx === -1) return;
        const match = matches[idx];
        const nextMatchId = match.nextMatchId;
        if (!nextMatchId) return;
        
        const targetIdx = matches.findIndex((m: any) => m.id === nextMatchId);
        if (targetIdx === -1) return;
        
        const targetMatch = matches[targetIdx];
        const updatedTarget = { ...targetMatch };
        if (targetMatch.akaFromMatchId === currentMatchId) {
          updatedTarget.aka = null;
        } else if (targetMatch.aoFromMatchId === currentMatchId) {
          updatedTarget.ao = null;
        }
        
        updatedTarget.winnerId = null;
        updatedTarget.byeFor = null;
        updatedTarget.status = 'upcoming';
        updatedTarget.akaKata = null;
        updatedTarget.aoKata = null;
        updatedTarget.selectedKata = null;
        delete updatedTarget.manualByeRevert;
        
        matches[targetIdx] = updatedTarget;
        clearNextMatches(targetMatch.id);
      };

      // Check next match to see if the winner has already played
      const nextMatchId = currentMatch.nextMatchId;
      if (nextMatchId) {
        const nextIdx = matches.findIndex((m: any) => m.id === nextMatchId);
        if (nextIdx !== -1) {
          const nextMatch = matches[nextIdx];
          const isNextMatchPlayed = nextMatch.status === 'completed' && !nextMatch.byeFor;
          if (isNextMatchPlayed || nextMatch.status === 'live') {
            return NextResponse.json({ 
              success: false, 
              error: { code: 'BAD_REQUEST', message: 'Cannot revert this match because the winner has already completed the next round. Please revert the next round\'s match first.' } 
            }, { status: 400 });
          }
          clearNextMatches(matchId);
        }
      }

      // Reset the current match
      const isBye = currentMatch.byeFor || (!currentMatch.aka || !currentMatch.ao);
      matches[currentIdx] = {
        ...currentMatch,
        winnerId: null,
        status: 'upcoming',
        byeFor: null,
        selectedKata: null,
        akaKata: null,
        aoKata: null,
        manualByeRevert: isBye ? true : undefined,
      } as any;

      await catRef.update({
        matches,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    // Resolve winner data from the match
    let winnerData = currentMatch.aka?.playerId === winnerId
      ? currentMatch.aka
      : currentMatch.ao?.playerId === winnerId
        ? currentMatch.ao
        : null;

    // If winnerId is not a playerId but 'aka' or 'ao' side reference (BYE case)
    if (!winnerData && byeFor) {
      const loserSide = byeFor === 'aka' ? 'ao' : 'aka'; // winner is opposite of byeFor
      winnerData = currentMatch[loserSide === 'aka' ? 'aka' : 'ao'];
      // if still null, try using winnerId as direct lookup
    }

    // If we only want to update the selected kata without finishing the match
    if (!winnerId && selectedKata) {
      matches[currentIdx] = {
        ...currentMatch,
        selectedKata,
        akaKata: selectedKata.aka?.name,
        aoKata: selectedKata.ao?.name
      };
      await catRef.update({
        matches,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, nextMatchId: null });
    }

    if (!winnerData) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Winner not found in match' } }, { status: 400 });
    }

    // Mark current match completed
    matches[currentIdx] = {
      ...currentMatch,
      winnerId,
      status: 'completed',
      ...(byeFor ? { byeFor } : {}),
      ...(selectedKata ? { 
          selectedKata, 
          akaKata: selectedKata.aka?.name, 
          aoKata: selectedKata.ao?.name 
      } : {}),
    };
    delete (matches[currentIdx] as any).manualByeRevert;

    // Propagate winner to the next match
    const nextMatchId = currentMatch.nextMatchId;
    if (nextMatchId) {
      const nextIdx = matches.findIndex(m => m.id === nextMatchId);
      if (nextIdx !== -1) {
        const nextMatch = matches[nextIdx];
        if (nextMatch.akaFromMatchId === matchId) {
          matches[nextIdx] = { ...nextMatch, aka: winnerData };
        } else if (nextMatch.aoFromMatchId === matchId) {
          matches[nextIdx] = { ...nextMatch, ao: winnerData };
        }
      }
    }

    // Auto-advance players in subsequent matches if they face empty brackets
    const { propagateByesAndWinners } = await import('@taikaix/backend/services/tiesheet/generator');
    propagateByesAndWinners(matches);


    // Check if this is the final match of the pool (no next match)
    // If so, assign medals!
    let athletes = [...(catData.athletes || [])];
    
    if (!nextMatchId) {
      // This is the pool final!
      const compSnap = await adminDb.collection('competitions').doc(id).get();
      const bronzeRule = compSnap.data()?.bronzeRule || 'two';

      // 1. Assign Gold to winner
      athletes = athletes.map(a => a.playerId === winnerId ? { ...a, medal: 'gold' } : a);

      // 2. Assign Silver to loser
      const loserData = winnerId === currentMatch.aka?.playerId ? currentMatch.ao : currentMatch.aka;
      if (loserData?.playerId) {
        athletes = athletes.map(a => a.playerId === loserData.playerId ? { ...a, medal: 'silver' } : a);
      }

      // 3. Assign Bronze
      if (bronzeRule === 'two') {
        // Find semi-finals (matches that point to this final)
        const semiFinals = matches.filter(m => m.nextMatchId === matchId);
        semiFinals.forEach(semi => {
          // The loser of the semi-final gets Bronze
          // Since the semi is completed, we know the winnerId
          if (semi.winnerId && semi.status === 'completed') {
            const sfLoser = semi.winnerId === semi.aka?.playerId ? semi.ao : semi.aka;
            if (sfLoser?.playerId) {
              athletes = athletes.map(a => a.playerId === sfLoser.playerId ? { ...a, medal: 'bronze' } : a);
            }
          }
        });
      } else if (bronzeRule === 'one') {
        // If there's a 3rd-place playoff, its nextMatchId would be null too, but it's not the "final".
        // Actually, our bracket generator doesn't build a 3rd place match.
        // We will leave Bronze unassigned so the operator can manually assign it or we handle it later.
      }
    }

    await catRef.update({
      matches,
      athletes,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, nextMatchId: nextMatchId || null });
  } catch (error: any) {
    console.error('[brackets/PATCH]', error);
    if (error instanceof z.ZodError || error?.name === 'ZodError') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation Error', details: error.issues || error.errors } }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update bracket' } }, { status: 500 });
  }
}

/**
 * GET /api/competitions/{id}/brackets/{catId}
 * Returns the category doc (matches + athletes)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const { id, catId } = await params;
    const catRef = adminDb.collection('competitions').doc(id).collection('categories').doc(catId);
    const snap = await catRef.get();

    const data = snap.data() as any;
    // Strip PII fields from athletes before returning to client
    if (data?.athletes) {
      data.athletes = data.athletes.map(({ phone: _p, email: _e, ...safe }: any) => safe);
    }

    return NextResponse.json({ success: true, data: { id: snap.id, ...data } });
  } catch (error: any) {
    console.error('[brackets/GET]', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch category' } }, { status: 500 });
  }
}
