import { NextResponse } from 'next/server';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const { id, catId } = await params;
    const body = await request.json();
    const { sourceMatchId, sourceSide, targetMatchId, targetSide } = body;

    if (!sourceMatchId || !sourceSide || !targetMatchId || !targetSide) {
      return NextResponse.json({ success: false, error: 'Missing required swap parameters' }, { status: 400 });
    }

    const catRef = adminDb.collection('competitions').doc(id).collection('categories').doc(catId);
    
    return await adminDb.runTransaction(async (transaction) => {
      const catSnap = await transaction.get(catRef);
      if (!catSnap.exists) {
        throw new Error('Category not found');
      }

      const data = catSnap.data() as any;
      const matches = data.matches || [];

      const sourceMatchIdx = matches.findIndex((m: any) => m.id === sourceMatchId);
      const targetMatchIdx = matches.findIndex((m: any) => m.id === targetMatchId);

      if (sourceMatchIdx === -1 || targetMatchIdx === -1) {
        throw new Error('Match not found');
      }

      // Read current athletes
      const sourceAthlete = matches[sourceMatchIdx][sourceSide];
      const targetAthlete = matches[targetMatchIdx][targetSide];

      // Swap athletes
      matches[sourceMatchIdx][sourceSide] = targetAthlete;
      matches[targetMatchIdx][targetSide] = sourceAthlete;

      // Ensure that pending logic (like if there's only one athlete -> BYE) is updated.
      // We also need to clear winnerId if we swapped someone out of an auto-win
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

      resetWinnerIfByeChanged(matches[sourceMatchIdx]);
      resetWinnerIfByeChanged(matches[targetMatchIdx]);

      transaction.update(catRef, { matches });

      return NextResponse.json({ success: true });
    });
  } catch (error: any) {
    console.error('Error swapping athletes:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
