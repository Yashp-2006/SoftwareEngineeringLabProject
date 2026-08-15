import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { generateBracket, seedSpecialCategory, PoolSize, CategoryDoc } from '@taikaix/backend/services/tiesheet/generator';

export class BracketService {
  /**
   * Generates or regenerates brackets for one or more categories, or globally rebuckets all athletes.
   */
  static async generateBrackets(id: string, options: any) {
    const { categoryId, categoryIds, specialCategoryId, poolSize: rawPoolSize, compType = 'international', useRoundRobin, rebucketAll, wkfMode, compRules } = options;
    const poolSize = (rawPoolSize ? (typeof rawPoolSize === 'string' ? parseInt(rawPoolSize) : rawPoolSize) : 8) as PoolSize;
    const finalPoolSize = ([4, 8, 16, 32].includes(poolSize) ? poolSize : 8) as PoolSize;

    const competitionRef = adminDb.collection('competitions').doc(id);
    const categoriesRef = competitionRef.collection('categories');

    // ── Global Rebucketing ──
    if (rebucketAll) {
      const { bucketAthletes } = await import('@taikaix/backend/services/tiesheet/generator');
      
      const catsSnap = await categoriesRef.get();
      const allCategories = catsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      const allAthletes: any[] = [];
      for (const c of allCategories) {
        if (c.athletes && c.athletes.length > 0) {
          allAthletes.push(...c.athletes);
        }
      }

      const uniqueAthletes = Array.from(new Map(allAthletes.map(a => [a.playerId, a])).values());

      const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
      const wkfCatNames = new Set(generateWkfCategories(wkfMode || 'standard').map(c => c.name));
      const customCats = compRules === 'wkf' 
         ? allCategories.filter(c => !c.isSpecial && !wkfCatNames.has(c.name))
         : allCategories.filter(c => !c.isSpecial);
      
      const { categoryMap } = bucketAthletes(uniqueAthletes, [], wkfMode || 'standard', customCats, compRules || 'international');

      let processed = 0;
      const batches = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;

      for (const oldCat of allCategories) {
        if (oldCat.isSpecial) continue;
        
        const newAthletes = categoryMap.get(oldCat.name) || [];
        const oldAthletes = oldCat.athletes || [];
        
        const oldIds = oldAthletes.map((a: any) => a.playerId).sort().join(',');
        const newIds = newAthletes.map((a: any) => a.playerId).sort().join(',');

        if (oldIds !== newIds) {
           newAthletes.sort((a: any, b: any) => a.name.localeCompare(b.name));
           
           const catUpdate: any = {
             athletes: newAthletes,
             entries: newAthletes.length,
             updatedAt: new Date().toISOString()
           };

           if (newAthletes.length > 0) {
             const matches = generateBracket(newAthletes, compType, finalPoolSize, { useRoundRobin: oldCat.useRoundRobin || useRoundRobin });
             catUpdate.matches = matches.map(m => ({
               id: m.id,
               round: m.round,
               matchNumber: m.matchNumber,
               aka: m.aka || null,
               ao: m.ao || null,
               akaFromMatchId: m.akaFromMatchId || null,
               aoFromMatchId: m.aoFromMatchId || null,
               akaScore: 0,
               aoScore: 0,
               winnerId: m.winnerId || null,
               nextMatchId: m.nextMatchId || null,
               status: m.status,
               mat: null,
             }));
           } else {
             catUpdate.matches = [];
           }

           currentBatch.update(categoriesRef.doc(oldCat.id), catUpdate);
           processed++;
           opCount++;
           if (opCount === 400) { batches.push(currentBatch); currentBatch = adminDb.batch(); opCount = 0; }
        }
      }

      if (opCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map(b => b.commit()));

      return { categoriesProcessed: processed };
    }

    // ── Standard category regeneration ──
    const targetCategoryIds = categoryIds || (categoryId ? [categoryId] : []);

    if (targetCategoryIds.length > 0) {
      const batches: any[] = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;
      let totalMatchesGenerated = 0;
      let totalAthleteCount = 0;

      for (const catId of targetCategoryIds) {
        const catDoc = await categoriesRef.doc(catId).get();
        if (!catDoc.exists) continue;

        const catData = catDoc.data()!;
        const athletes = catData.athletes || [];

        if (athletes.length === 0) continue;

        const matches = generateBracket(athletes, compType, finalPoolSize, { useRoundRobin: catData.useRoundRobin || useRoundRobin });

        const matchesPayload = matches.map(m => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          aka: m.aka || null,
          ao: m.ao || null,
          akaFromMatchId: m.akaFromMatchId || null,
          aoFromMatchId: m.aoFromMatchId || null,
          akaScore: 0,
          aoScore: 0,
          winnerId: m.winnerId || null,
          nextMatchId: m.nextMatchId || null,
          status: m.status,
          mat: null,
        }));

        currentBatch.update(categoriesRef.doc(catId), {
          matches: matchesPayload,
          updatedAt: new Date().toISOString(),
        });

        totalMatchesGenerated += matches.length;
        totalAthleteCount += athletes.length;
        opCount++;

        if (opCount === 400) {
          batches.push(currentBatch);
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }

      if (opCount > 0) batches.push(currentBatch);
      if (batches.length > 0) await Promise.all(batches.map(b => b.commit()));

      return {
        matchesGenerated: totalMatchesGenerated,
        athleteCount: totalAthleteCount,
        categoriesProcessed: targetCategoryIds.length
      };
    }

    // ── Special category seeding ──
    if (specialCategoryId) {
      const specialCatDoc = await categoriesRef.doc(specialCategoryId).get();
      if (!specialCatDoc.exists) {
        throw new Error('NOT_FOUND: Special category not found');
      }

      const specialCatData = specialCatDoc.data()!;
      const rule = {
        id: specialCategoryId,
        name: specialCatData.name,
        medal: specialCatData.medal || 'Any Medal',
        minAge: specialCatData.minAge,
        maxAge: specialCatData.maxAge,
        minWeight: specialCatData.minWeight,
        maxWeight: specialCatData.maxWeight,
        sourceCategoryIds: specialCatData.sourceCategoryIds,
        sourceCategoryId: specialCatData.sourceCategoryId,
        medals: specialCatData.medals,
      };

      const allCatsSnap = await categoriesRef.where('isSpecial', '==', false).get();

      const allCategoryDocs: CategoryDoc[] = allCatsSnap.docs
        .filter((d: any) => d.id !== specialCategoryId)
        .map((d: any) => ({ id: d.id, ...d.data() } as CategoryDoc));

      const eligibleAthletes = seedSpecialCategory(allCategoryDocs, rule);

      if (eligibleAthletes.length === 0) {
        throw new Error('BAD_REQUEST: No eligible athletes found. Ensure standard tiesheets are completed first.');
      }

      const matches = generateBracket(eligibleAthletes, compType, finalPoolSize, { useRoundRobin: specialCatData.useRoundRobin || useRoundRobin });

      await categoriesRef.doc(specialCategoryId).update({
        athletes: eligibleAthletes.map(a => ({
          playerId: a.playerId,
          name: a.name,
          gender: a.gender,
          weight: a.weight,
          age: a.age,
          country: a.country,
          state: a.state,
          district: a.district,
          academy: a.academy,
          medal: a.medal || null,
          sourceCategory: a.sourceCategory || null,
        })),
        matches: matches.map(m => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          aka: m.aka || null,
          ao: m.ao || null,
          akaFromMatchId: m.akaFromMatchId || null,
          aoFromMatchId: m.aoFromMatchId || null,
          akaScore: 0,
          aoScore: 0,
          winnerId: m.winnerId || null,
          nextMatchId: m.nextMatchId || null,
          status: m.status,
          mat: null,
        })),
        updatedAt: new Date().toISOString(),
      });

      return {
        athletesSeeded: eligibleAthletes.length,
        matchesGenerated: matches.length,
      };
    }

    throw new Error('BAD_REQUEST: Provide categoryId or specialCategoryId');
  }

  /**
   * Swaps athletes between matches (either within the same category or across categories).
   */
  static async swapAthletes(id: string, catId: string, options: any) {
    const { action = 'swap', sourceMatchId, sourceSide, targetCategoryId, targetMatchId, targetSide } = options;

    if (!sourceMatchId || !sourceSide || !targetMatchId || !targetSide) {
      throw new Error('BAD_REQUEST: Missing required swap parameters');
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
        throw new Error('NOT_FOUND: Category not found');
      }

      const sourceData = sourceSnap.data() as any;
      const targetData = targetSnap.data() as any;

      const sourceMatches = [...(sourceData.matches || [])];
      const targetMatches = isCrossCategory ? [...(targetData.matches || [])] : sourceMatches;

      const sourceMatchIdx = sourceMatches.findIndex((m: any) => m.id === sourceMatchId);
      const targetMatchIdx = targetMatches.findIndex((m: any) => m.id === targetMatchId);

      if (sourceMatchIdx === -1 || targetMatchIdx === -1) {
        throw new Error('NOT_FOUND: Match not found');
      }

      const sourceAthlete = sourceMatches[sourceMatchIdx][sourceSide];
      const targetAthlete = targetMatches[targetMatchIdx][targetSide];

      if (action === 'swap') {
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
        if (!sourceAthlete) {
          throw new Error('NOT_FOUND: Source athlete not found');
        }

        sourceMatches[sourceMatchIdx][sourceSide] = null;
        resetWinnerIfByeChanged(sourceMatches[sourceMatchIdx]);

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

        const targetAthletesList = [...(targetData.athletes || [])];
        const newAthlete = {
          ...fullAthleteData,
          categoryId: targetCatId,
        };
        targetAthletesList.push(newAthlete);
        targetAthletesList.sort((a: any, b: any) => a.name.localeCompare(b.name));
        targetData.athletes = targetAthletesList;
        targetData.entries = targetAthletesList.length;

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
          const hasStarted = targetMatches.some((m: any) => m.status === 'completed' || m.status === 'live');
          if (hasStarted) {
            throw new Error('BAD_REQUEST: Target category has already started and there are no BYE slots available.');
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

      if (isCrossCategory) {
        transaction.update(sourceCatRef, { matches: sourceMatches, athletes: sourceData.athletes, entries: sourceData.entries, updatedAt: new Date().toISOString() });
        transaction.update(targetCatRef, { matches: targetData.matches || targetMatches, athletes: targetData.athletes, entries: targetData.entries, updatedAt: new Date().toISOString() });
      } else {
        transaction.update(sourceCatRef, { matches: sourceMatches, updatedAt: new Date().toISOString() });
      }

      return { success: true };
    });
  }

  /**
   * Creates a supplementary tiebreaker MatchNode.
   */
  static async resolveTie(id: string, catId: string, matchId: string) {
    const catRef = adminDb
      .collection('competitions')
      .doc(id)
      .collection('categories')
      .doc(catId);

    const catSnap = await catRef.get();
    if (!catSnap.exists) {
      throw new Error('NOT_FOUND: Category not found');
    }

    const catData = catSnap.data()!;
    const matches: any[] = [...(catData.matches || [])];

    const currentIdx = matches.findIndex((m: any) => m.id === matchId);
    if (currentIdx === -1) {
      throw new Error('NOT_FOUND: Match not found');
    }

    const currentMatch = matches[currentIdx];
    const tiebreakerId = `${matchId}-TB${Date.now()}`;

    const tiebreakerMatch = {
      ...currentMatch,
      id: tiebreakerId,
      matchNumber: currentMatch.matchNumber + 0.1,
      roundLabel: `${currentMatch.roundLabel || 'Round'} (Tiebreaker)`,
      isTieBreaker: true,
      status: 'upcoming',
      akaScore: 0,
      aoScore: 0,
      winnerId: null,
      kataVotes: null,
      selectedKata: null,
      nextMatchId: currentMatch.nextMatchId,
    };

    matches.push(tiebreakerMatch);

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

    matches[currentIdx] = {
      ...currentMatch,
      status: 'completed',
      winnerId: 'tie',
      nextMatchId: tiebreakerId,
    };

    matches.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

    await catRef.update({
      matches,
      updatedAt: new Date().toISOString(),
    });

    return { tiebreakerId };
  }
}
