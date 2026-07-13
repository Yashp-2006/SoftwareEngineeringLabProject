import { bucketAthletes, generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet-generator';
import { rateLimiter } from '@lib/rate-limiter';
import { NextResponse } from 'next/server';
import { verifySession } from '@taikaix/backend/lib/firebase-admin';

// Only does CPU work: category bucketing + bracket generation.
// Accepts pre-parsed athlete rows as JSON — no xlsx binary, no Firestore.
// Runs in ~200ms even for 5000 athletes. Well within any serverless timeout.
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStr = req.headers.get('cookie') || '';
    const token = cookieStr.match(/(?:^|;)\s*session\s*=\s*([^;]+)/)?.[1];
    const { role } = await verifySession(token);
    if (role !== 'admin' && role !== 'guest_viewer') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    let rateLimitResult = { success: true, limit: 10, reset: 0, remaining: 10 };
    try {
      rateLimitResult = await rateLimiter.limit(`import_${ip}`);
    } catch (e: any) {
      console.warn('[rate-limiter] Redis error, bypassing:', e.message);
    }

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { rows, compType = 'international', poolSize: rawPoolSize = 8, wkfMode = 'standard', specialCategories = [], customCategories = [] } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No athlete rows provided.' }, { status: 400 });
    }

    const poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;

    const { categoryMap, uniqueAthletesCount } = bucketAthletes(rows, specialCategories, wkfMode, customCategories);

    if (categoryMap.size === 0) {
      return NextResponse.json({ success: false, error: 'No athlete data could be categorised. Check that the rows contain valid athlete data.' }, { status: 422 });
    }

    const dynamicSpecialCatNames = new Set<string>();
    for (const [, catAthletes] of categoryMap) {
      for (const a of catAthletes) {
        if (a.interestSpecial) dynamicSpecialCatNames.add(a.interestSpecial);
      }
    }

    const categories = Array.from(categoryMap.entries()).map(([catName, catAthletes]) => {
      if (catAthletes.length === 0) return null;
      const isSpecialCat = specialCategories.some((sc: any) => sc.name === catName) || dynamicSpecialCatNames.has(catName);
      const matches = generateBracket(catAthletes, compType, poolSize);
      return {
        name: catName,
        isSpecial: isSpecialCat,
        competitionId: id,
        status: 'upcoming',
        athletes: catAthletes.map((a: any) => ({
          playerId: a.playerId,
          name: a.name,
          gender: a.gender,
          weight: a.weight,
          age: a.age,
          country: a.country,
          state: a.state,
          district: a.district,
          academy: a.academy,
          interestSpecial: a.interestSpecial,
          coachName: a.coachName || '',
          phone: a.phone || '',
          email: a.email || '',
        })),
        matches: matches.slice(0, 500).map(m => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          aka: m.aka ? { playerId: m.aka.playerId, name: m.aka.name, academy: m.aka.academy || null, state: m.aka.state || m.aka.country || null } : null,
          ao: m.ao ? { playerId: m.ao.playerId, name: m.ao.name, academy: m.ao.academy || null, state: m.ao.state || m.ao.country || null } : null,
          akaFromMatchId: m.akaFromMatchId || null,
          aoFromMatchId: m.aoFromMatchId || null,
          akaScore: 0,
          aoScore: 0,
          winnerId: m.winnerId || null,
          nextMatchId: m.nextMatchId || null,
          status: m.status,
          mat: null,
        })),
        entries: catAthletes.length,
      };
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      competitionId: id,
      uniqueAthletesCount,
      categories,
    });
  } catch (error: any) {
    console.error('[import/route]', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
