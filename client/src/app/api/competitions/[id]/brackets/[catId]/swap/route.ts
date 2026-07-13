import { NextResponse } from 'next/server';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet-generator';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  try {
    const cookieStr = request.headers.get('cookie') || '';
    const token = cookieStr.match(/(?:^|;)\s*session\s*=\s*([^;]+)/)?.[1];
    const { role } = await verifySession(token);
    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

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
