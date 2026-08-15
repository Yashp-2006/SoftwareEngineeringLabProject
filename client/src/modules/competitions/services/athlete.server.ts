import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet/generator';

export class AthleteService {
  static async addAthlete(competitionId: string, categoryId: string, athleteData: any) {
    const catRef = adminDb.collection('competitions').doc(competitionId).collection('categories').doc(categoryId);
    
    return await adminDb.runTransaction(async (t) => {
      const catSnap = await t.get(catRef);
      if (!catSnap.exists) {
        throw new Error('NOT_FOUND: Category not found');
      }

      const category = catSnap.data()!;
      const matches: any[] = category.matches || [];
      const athletes: any[] = category.athletes || [];

      let finalInterestSpecial = athleteData.interestSpecial || '';
      const sp = finalInterestSpecial.toLowerCase().trim();
      if (['n/a', 'none', 'no', 'na', ''].includes(sp)) {
        finalInterestSpecial = '';
      }

      const newAthlete = {
        ...athleteData,
        interestSpecial: finalInterestSpecial,
        playerId: athleteData.playerId || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        gender: athleteData.gender || 'Unknown',
        weight: parseFloat(athleteData.weight?.toString() || '0') || 0,
        age: parseInt(athleteData.age?.toString() || '0') || 0,
      };

      const hasStarted = matches.some(m => m.status === 'completed' || m.status === 'live');
      const round1Matches = matches.filter(m => m.round === 1);
      
      let byeMatchIndex = -1;
      let byeSlot: 'aka' | 'ao' | null = null;

      for (let i = 0; i < round1Matches.length; i++) {
        const m = round1Matches[i];
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
        if (!m.aka && !m.ao && !m.akaFromMatchId && !m.aoFromMatchId) {
          byeMatchIndex = matches.findIndex(match => match.id === m.id);
          byeSlot = 'aka';
          break;
        }
      }

      let updatedMatches = [...matches];

      if (byeMatchIndex !== -1 && byeSlot) {
        const targetMatch = updatedMatches[byeMatchIndex];
        targetMatch[byeSlot] = {
          playerId: newAthlete.playerId,
          name: newAthlete.name,
          academy: newAthlete.academy || null,
          state: newAthlete.state || newAthlete.country || null,
        };
        
        targetMatch.winnerId = null;
        targetMatch.status = 'upcoming';

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
        if (hasStarted) {
          throw new Error('BAD_REQUEST: Category has already started and there are no BYE slots available. Cannot add athlete without wiping existing scores.');
        }

        const newAthletesList = [...athletes, newAthlete];
        
        let poolSize: PoolSize = 8;
        if (round1Matches.length === 2) poolSize = 4;
        else if (round1Matches.length === 4) poolSize = 8;
        else if (round1Matches.length === 8) poolSize = 16;
        else if (round1Matches.length === 16) poolSize = 32;

        const regeneratedMatches = generateBracket(newAthletesList, 'international', poolSize, { useRoundRobin: category.useRoundRobin });
        
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
          mat: category.mat || null,
        }));
      }

      athletes.push(newAthlete);
      athletes.sort((a, b) => a.name.localeCompare(b.name));

      t.update(catRef, {
        athletes: athletes,
        matches: updatedMatches,
        entries: athletes.length,
        updatedAt: new Date().toISOString(),
      });

      return { message: 'Athlete added successfully' };
    });
  }
}
