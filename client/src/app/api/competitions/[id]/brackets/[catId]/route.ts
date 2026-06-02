import { NextResponse } from 'next/server';
import { adminDb } from '@lib/firebase-admin';

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
    const { id, catId } = await params;
    const body = await req.json();
    const { matchId, winnerId, byeFor } = body;
    // byeFor = 'aka' | 'ao' — means that side won by BYE (opponent disqualified/absent)

    if (!matchId || !winnerId) {
      return NextResponse.json({ success: false, error: 'matchId and winnerId are required' }, { status: 400 });
    }

    const catRef = adminDb
      .collection('competitions')
      .doc(id)
      .collection('categories')
      .doc(catId);

    const catSnap = await catRef.get();
    if (!catSnap.exists) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const catData = catSnap.data()!;
    const matches: any[] = [...(catData.matches || [])];

    // Find the current match
    const currentIdx = matches.findIndex(m => m.id === matchId);
    if (currentIdx === -1) {
      return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
    }

    const currentMatch = matches[currentIdx];

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

    if (!winnerData) {
      return NextResponse.json({ success: false, error: 'Winner not found in match' }, { status: 400 });
    }

    // Mark current match completed
    matches[currentIdx] = {
      ...currentMatch,
      winnerId,
      status: 'completed',
      ...(byeFor ? { byeFor } : {}),
    };

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

    await catRef.update({
      matches,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, nextMatchId: nextMatchId || null });
  } catch (error: any) {
    console.error('[brackets/[catId]]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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

    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { id: snap.id, ...snap.data() } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
