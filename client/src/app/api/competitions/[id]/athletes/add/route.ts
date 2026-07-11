import { NextResponse } from 'next/server';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet-generator';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: competitionId } = await params;
    const body = await req.json();
    const { categoryId, athleteData } = body;

    if (!categoryId || !athleteData) {
      return NextResponse.json({ success: false, error: 'Missing categoryId or athleteData' }, { status: 400 });
    }

    const catRef = adminDb.collection('competitions').doc(competitionId).collection('categories').doc(categoryId);
    const catSnap = await catRef.get();

    if (!catSnap.exists) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 });
    }

    const category = catSnap.data()!;
    const matches: any[] = category.matches || [];
    const athletes: any[] = category.athletes || [];

    let finalInterestSpecial = athleteData.interestSpecial || '';
    const sp = finalInterestSpecial.toLowerCase().trim();
    if (['n/a', 'none', 'no', 'na', ''].includes(sp)) {
      finalInterestSpecial = '';
    }

    // Assign a unique player ID if not provided
    const newAthlete = {
      ...athleteData,
      interestSpecial: finalInterestSpecial,
      playerId: athleteData.playerId || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      gender: athleteData.gender || 'Unknown',
      weight: parseFloat(athleteData.weight) || 0,
      age: parseInt(athleteData.age) || 0,
    };

    // Check if category has already started
    const hasStarted = matches.some(m => m.status === 'completed' || m.status === 'live');

    // Find a BYE slot in Round 1
    const round1Matches = matches.filter(m => m.round === 1);
    let byeMatchIndex = -1;
    let byeSlot: 'aka' | 'ao' | null = null;

    for (let i = 0; i < round1Matches.length; i++) {
      const m = round1Matches[i];
      // A BYE slot means one side has an athlete and the other side is null (and it's not a placeholder from a previous match)
      if (m.aka && !m.ao && !m.aoFromMatchId) {
        byeMatchIndex = matches.findIndex(match => match.id === m.id);
        byeSlot = 'ao';
        break;
      }
      if (!m.aka && m.ao && !m.akaFromMatchId) {
        byeMatchIndex = matches.findIndex(match => match.id === m.id);
        byeSlot = 'aka';
        break;
      }
      // Or both are null in Round 1
      if (!m.aka && !m.ao && !m.akaFromMatchId && !m.aoFromMatchId) {
        byeMatchIndex = matches.findIndex(match => match.id === m.id);
        byeSlot = 'aka'; // Assign to aka first
        break;
      }
    }

    let updatedMatches = [...matches];

    if (byeMatchIndex !== -1 && byeSlot) {
      // 1. Fill BYE Slot
      const targetMatch = updatedMatches[byeMatchIndex];
      targetMatch[byeSlot] = {
        playerId: newAthlete.playerId,
        name: newAthlete.name,
        academy: newAthlete.academy || null,
        state: newAthlete.state || newAthlete.country || null,
      };
      
      // Since it's no longer a BYE, clear auto-advance winnerId if it was set
      targetMatch.winnerId = null;

      // Ensure the match status is upcoming
      targetMatch.status = 'upcoming';

      // We need to cascade the removal of the auto-winner from the next match
      if (targetMatch.nextMatchId) {
        const nextMatchIdx = updatedMatches.findIndex(m => m.id === targetMatch.nextMatchId);
        if (nextMatchIdx !== -1) {
          const nextMatch = updatedMatches[nextMatchIdx];
          if (nextMatch.akaFromMatchId === targetMatch.id) {
            nextMatch.aka = null;
          } else if (nextMatch.aoFromMatchId === targetMatch.id) {
            nextMatch.ao = null;
          }
        }
      }
    } else {
      // 2. No BYE slot found. Can we regenerate?
      if (hasStarted) {
        return NextResponse.json({ 
          success: false, 
          error: 'Category has already started and there are no BYE slots available. Cannot add athlete without wiping existing scores.' 
        }, { status: 400 });
      }

      // Safe to regenerate
      const newAthletesList = [...athletes, newAthlete];
      
      // Try to determine poolSize from existing round 1 matches
      let poolSize: PoolSize = 8;
      if (round1Matches.length === 2) poolSize = 4;
      else if (round1Matches.length === 4) poolSize = 8;
      else if (round1Matches.length === 8) poolSize = 16;
      else if (round1Matches.length === 16) poolSize = 32;

      // Note: If poolSize was 8 and we add a 9th player, `generateBracket` with poolSize=8 
      // will automatically use the `buildMultiPool` logic!
      const regeneratedMatches = generateBracket(newAthletesList, 'international', poolSize);
      
      updatedMatches = regeneratedMatches.map(m => ({
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
        mat: category.mat || null, // Keep existing mat
      }));
    }

    // Add athlete to roster
    athletes.push(newAthlete);
    // Re-sort alphabetically
    athletes.sort((a, b) => a.name.localeCompare(b.name));

    await catRef.update({
      athletes: athletes,
      matches: updatedMatches,
      entries: athletes.length,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Athlete added successfully' });
  } catch (error: any) {
    console.error('[athletes/add] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
