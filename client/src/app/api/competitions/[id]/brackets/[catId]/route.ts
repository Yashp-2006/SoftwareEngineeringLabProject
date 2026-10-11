import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { cookies } from 'next/headers';
import { updateBracketSchema } from '@taikaix/backend/types/schemas';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

/**
 * PATCH /api/competitions/{id}/brackets/{catId}
 * Body: { matchId: string, winnerId: string }
 *
 * Atomically:
 *  1. Marks the match as completed with the given winner
 *  2. Pushes the winner's athlete data into the next round's match slot
 *  3. Returns the updated matches array
 */
function cleanFirestoreData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(cleanFirestoreData);
  }
  if (data !== null && typeof data === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        res[k] = cleanFirestoreData(v);
      }
    }
    return res;
  }
  return data;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const sessionToken = (await cookies()).get('session')?.value;
    const { role } = await verifySession(sessionToken);
    if (role !== 'admin' && role !== 'guest_viewer' && role !== 'mat_operator') {
      return unauthorizedResponse();
    }
    const { id, catId } = await params;
    const body = await req.json();
    const validated = updateBracketSchema.parse(body);
    const {
      matchId,
      winnerId,
      byeFor,
      selectedKata,
      action,
      akaScore,
      aoScore,
      akaIppon,
      akaWazaari,
      akaYuko,
      akaSenshu,
      akaC1,
      akaC2,
      aoIppon,
      aoWazaari,
      aoYuko,
      aoSenshu,
      aoC1,
      aoC2,
      kataVotes,
      akaKata,
      aoKata,
    } = validated;
    // byeFor = 'aka' | 'ao' — means that side won by BYE (opponent disqualified/absent)

    if (!matchId) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'matchId is required' } }, { status: 400 });
    }

    if (action !== 'revert' && !winnerId && !selectedKata && !akaKata && !aoKata) {
      return NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'winnerId, selectedKata, or kata selection is required' } }, { status: 400 });
    }

    const catRef = adminDb
      .collection('competitions')
      .doc(id)
      .collection('categories')
      .doc(catId);

    const compRef = adminDb.collection('competitions').doc(id);

    const txResult = await adminDb.runTransaction(async (transaction) => {
      const [catSnap, compSnap] = await Promise.all([
        transaction.get(catRef),
        transaction.get(compRef),
      ]);

      if (!catSnap.exists) {
        return { error: NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } }, { status: 404 }) };
      }

      const catData = catSnap.data()!;
      const matches: any[] = [...(catData.matches || [])];

      // Find the current match
      const currentIdx = matches.findIndex(m => m.id === matchId);
      if (currentIdx === -1) {
        return { error: NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Match not found' } }, { status: 404 }) };
      }

      const currentMatch = matches[currentIdx];

      // Handle revert action
      if (action === 'revert') {
        if (!currentMatch.winnerId && currentMatch.status !== 'completed') {
          return { error: NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Match is not completed' } }, { status: 400 }) };
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
              return { 
                error: NextResponse.json({ 
                  success: false, 
                  error: { code: 'BAD_REQUEST', message: 'Cannot revert this match because the winner has already completed the next round. Please revert the next round\'s match first.' } 
                }, { status: 400 }) 
              };
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
          akaScore: 0,
          aoScore: 0,
          akaIppon: 0,
          akaWazaari: 0,
          akaYuko: 0,
          akaSenshu: false,
          akaC1: 0,
          akaC2: 0,
          aoIppon: 0,
          aoWazaari: 0,
          aoYuko: 0,
          aoSenshu: false,
          aoC1: 0,
          aoC2: 0,
          byeFor: null,
          selectedKata: null,
          akaKata: null,
          aoKata: null,
          kataVotes: null,
          manualByeRevert: isBye ? true : undefined,
        } as any;

        transaction.update(catRef, {
          matches,
          updatedAt: new Date().toISOString(),
        });
        return { success: true, nextMatchId: null };
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
      }

      // Resolve kata names (supporting string or object notation, or explicit fields)
      const resolvedAkaKata = (typeof selectedKata?.aka === 'string' ? selectedKata.aka : selectedKata?.aka?.name) || akaKata || currentMatch.akaKata || null;
      const resolvedAoKata = (typeof selectedKata?.ao === 'string' ? selectedKata.ao : selectedKata?.ao?.name) || aoKata || currentMatch.aoKata || null;
      const resolvedSelectedKata = selectedKata || currentMatch.selectedKata || (resolvedAkaKata || resolvedAoKata ? {
        aka: resolvedAkaKata ? { name: resolvedAkaKata } : null,
        ao: resolvedAoKata ? { name: resolvedAoKata } : null,
      } : null);

      // If we only want to update the selected kata without finishing the match
      if (!winnerId && (selectedKata || akaKata || aoKata)) {
        matches[currentIdx] = cleanFirestoreData({
          ...currentMatch,
          selectedKata: resolvedSelectedKata,
          akaKata: resolvedAkaKata,
          aoKata: resolvedAoKata,
        });
        transaction.update(catRef, {
          matches: cleanFirestoreData(matches),
          updatedAt: new Date().toISOString(),
        });
        return { success: true, nextMatchId: null };
      }

      if (!winnerData) {
        return { error: NextResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'Winner not found in match' } }, { status: 400 }) };
      }

      // Mark current match completed
      matches[currentIdx] = cleanFirestoreData({
        ...currentMatch,
        winnerId,
        status: 'completed',
        ...(akaScore !== undefined && akaScore !== null ? { akaScore } : {}),
        ...(aoScore !== undefined && aoScore !== null ? { aoScore } : {}),
        ...(akaIppon !== undefined && akaIppon !== null ? { akaIppon } : {}),
        ...(akaWazaari !== undefined && akaWazaari !== null ? { akaWazaari } : {}),
        ...(akaYuko !== undefined && akaYuko !== null ? { akaYuko } : {}),
        ...(akaSenshu !== undefined && akaSenshu !== null ? { akaSenshu } : {}),
        ...(akaC1 !== undefined && akaC1 !== null ? { akaC1 } : {}),
        ...(akaC2 !== undefined && akaC2 !== null ? { akaC2 } : {}),
        ...(aoIppon !== undefined && aoIppon !== null ? { aoIppon } : {}),
        ...(aoWazaari !== undefined && aoWazaari !== null ? { aoWazaari } : {}),
        ...(aoYuko !== undefined && aoYuko !== null ? { aoYuko } : {}),
        ...(aoSenshu !== undefined && aoSenshu !== null ? { aoSenshu } : {}),
        ...(aoC1 !== undefined && aoC1 !== null ? { aoC1 } : {}),
        ...(aoC2 !== undefined && aoC2 !== null ? { aoC2 } : {}),
        ...(byeFor ? { byeFor } : {}),
        ...(resolvedSelectedKata ? { selectedKata: resolvedSelectedKata } : {}),
        ...(resolvedAkaKata ? { akaKata: resolvedAkaKata } : {}),
        ...(resolvedAoKata ? { aoKata: resolvedAoKata } : {}),
        ...(kataVotes ? { kataVotes } : {}),
      });
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
            if (semi.winnerId && semi.status === 'completed') {
              const sfLoser = semi.winnerId === semi.aka?.playerId ? semi.ao : semi.aka;
              if (sfLoser?.playerId) {
                athletes = athletes.map(a => a.playerId === sfLoser.playerId ? { ...a, medal: 'bronze' } : a);
              }
            }
          });
        }
      }

      transaction.update(catRef, {
        matches: cleanFirestoreData(matches),
        athletes: cleanFirestoreData(athletes),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, nextMatchId: nextMatchId || null };
    });

    if ('error' in txResult && txResult.error) {
      return txResult.error;
    }

    return NextResponse.json({ success: true, nextMatchId: txResult.nextMatchId });
  } catch (error: unknown) {
    console.error('[brackets/PATCH]', error);
    return errorResponse(error, 'Failed to update bracket');
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
  } catch (error: unknown) {
    console.error('[brackets/GET]', error);
    return errorResponse(error, 'Failed to fetch category');
  }
}
