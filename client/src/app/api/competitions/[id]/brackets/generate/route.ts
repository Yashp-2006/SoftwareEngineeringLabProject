import { NextResponse } from 'next/server';
import { generateBracket, seedSpecialCategory, PoolSize, CategoryDoc } from '@taikaix/backend/services/tiesheet-generator';
import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';

/**
 * POST /api/competitions/{id}/brackets/generate
 * Body: {
 *   categoryId?: string        // standard category — regenerate bracket from its athletes
 *   specialCategoryId?: string // special category — seed from sibling categories
 *   poolSize?: 4 | 8 | 16 | 32
 *   compType?: string
 * }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStr = req.headers.get('cookie') || '';
    const token = cookieStr.match(/(?:^|;)\s*session\s*=\s*([^;]+)/)?.[1];
    const { role } = await verifySession(token);
    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json();
    const { categoryId, categoryIds, specialCategoryId, poolSize: rawPoolSize, compType = 'international', useRoundRobin } = body;
    const poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;

    const competitionRef = adminDb.collection('competitions').doc(id);
    const categoriesRef = competitionRef.collection('categories');

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

        const matches = generateBracket(athletes, compType, poolSize, { useRoundRobin: catData.useRoundRobin || useRoundRobin });

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

      if (opCount > 0) {
        batches.push(currentBatch);
      }

      if (batches.length > 0) {
        await Promise.all(batches.map(b => b.commit()));
      }

      return NextResponse.json({
        success: true,
        matchesGenerated: totalMatchesGenerated,
        athleteCount: totalAthleteCount,
        categoriesProcessed: targetCategoryIds.length
      });
    }

    // ── Special category seeding ──
    if (specialCategoryId) {
      const specialCatDoc = await categoriesRef.doc(specialCategoryId).get();
      if (!specialCatDoc.exists) {
        return NextResponse.json({ success: false, error: 'Special category not found' }, { status: 404 });
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

      // Fetch all sibling (non-special) categories
      const allCatsSnap = await categoriesRef.where('isSpecial', '==', false).get();

      const allCategoryDocs: CategoryDoc[] = allCatsSnap.docs
        .filter((d: any) => d.id !== specialCategoryId)
        .map((d: any) => ({ id: d.id, ...d.data() } as CategoryDoc));

      const eligibleAthletes = seedSpecialCategory(allCategoryDocs, rule);

      if (eligibleAthletes.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No eligible athletes found. Ensure standard tiesheets are completed first.',
        }, { status: 400 });
      }

      const matches = generateBracket(eligibleAthletes, compType, poolSize, { useRoundRobin: specialCatData.useRoundRobin || useRoundRobin });

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

      return NextResponse.json({
        success: true,
        athletesSeeded: eligibleAthletes.length,
        matchesGenerated: matches.length,
      });
    }

    return NextResponse.json({ success: false, error: 'Provide categoryId or specialCategoryId' }, { status: 400 });
  } catch (error: any) {
    console.error('[brackets/generate]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
