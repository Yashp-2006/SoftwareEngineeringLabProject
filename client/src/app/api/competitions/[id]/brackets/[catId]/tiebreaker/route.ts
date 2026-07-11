import { NextResponse } from 'next/server';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';

/**
 * POST /api/competitions/{id}/brackets/{catId}/tiebreaker
 * Body: { matchId: string }
 *
 * Creates a supplementary MatchNode (isTieBreaker: true) for the specified match.
 * The new tiebreaker match is appended to the matches array.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const { id, catId } = await params;
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
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
    const currentIdx = matches.findIndex((m: any) => m.id === matchId);
    if (currentIdx === -1) {
      return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
    }

    const currentMatch = matches[currentIdx];

    // We can't have multiple tiebreakers for the same match without unique IDs
    const tiebreakerId = `${matchId}-TB${Date.now()}`;

    // Create the tiebreaker MatchNode
    const tiebreakerMatch = {
      ...currentMatch,
      id: tiebreakerId,
      matchNumber: currentMatch.matchNumber + 0.1, // So it sorts right after the current match
      roundLabel: `${currentMatch.roundLabel} (Tiebreaker)`,
      isTieBreaker: true,
      status: 'upcoming',
      // Reset scores and results
      akaScore: 0,
      aoScore: 0,
      winnerId: null,
      kataVotes: null,
      selectedKata: null,
      // Maintain next match link
      nextMatchId: currentMatch.nextMatchId,
      // Point the current match's "next" to this tiebreaker if you want it sequential,
      // but usually the tiebreaker resolves the same slot. We'll just leave currentMatch as completed (tied)
      // and let the tiebreaker's winner progress.
    };

    matches.push(tiebreakerMatch);

    // Update the next match (if any) to point its 'FromMatchId' to the tiebreaker, 
    // so the winner of the tiebreaker goes there, instead of the original match.
    if (currentMatch.nextMatchId) {
      const nextIdx = matches.findIndex((m: any) => m.id === currentMatch.nextMatchId);
      if (nextIdx !== -1) {
        const nextMatch = matches[nextIdx];
        if (nextMatch.akaFromMatchId === matchId) {
          matches[nextIdx] = { ...nextMatch, akaFromMatchId: tiebreakerId };
        } else if (nextMatch.aoFromMatchId === matchId) {
          matches[nextIdx] = { ...nextMatch, aoFromMatchId: tiebreakerId };
        }
      }
    }

    // Mark current match as completed (it resulted in a tie)
    matches[currentIdx] = {
      ...currentMatch,
      status: 'completed',
      winnerId: 'tie',
      nextMatchId: tiebreakerId, // Chain them
    };

    // Sort by matchNumber so the queue gets them in order
    matches.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

    await catRef.update({
      matches,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, tiebreakerId });
  } catch (error: any) {
    console.error('[brackets/[catId]/tiebreaker]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
