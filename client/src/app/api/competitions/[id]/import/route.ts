import { parseExcelIntoCategories, generateBracket, PoolSize, normalizeAthleteRows, bucketAthletes } from '@taikaix/backend/services/tiesheet-generator';
import { rateLimiter } from '@lib/rate-limiter';
import { NextResponse } from 'next/server';
import { verifySession, adminDb } from '@taikaix/backend/lib/firebase-admin';

// Parses file + generates brackets only — NO Firestore writes.
// Firestore writes are done client-side to avoid Vercel timeout.
// Parse+bracket is ~200ms even for 5000 athletes — safe within 10s limit.
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

    // Load competition details to check rules
    const compSnap = await adminDb.collection('competitions').doc(id).get();
    const compData = compSnap.exists ? compSnap.data() : null;
    const compRules = compData?.rules || 'custom';

    const contentType = req.headers.get('content-type') || '';
    let compType = 'international';
    let poolSize: PoolSize = 8;
    let specialCategories: any[] = [];
    let customCategories: any[] = [];
    let wkfMode = 'standard';
    let categoryMap: Map<string, any[]> = new Map();
    let uniqueAthletesCount = 0;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      compType = body.compType || 'international';
      const rawPoolSize = parseInt(body.poolSize) || 8;
      poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;
      
      const specialCategoriesStr = body.specialCategories;
      try {
        specialCategories = typeof specialCategoriesStr === 'string' ? JSON.parse(specialCategoriesStr) : (specialCategoriesStr || []);
      } catch {}

      const customCategoriesStr = body.customCategories;
      try {
        customCategories = typeof customCategoriesStr === 'string' ? JSON.parse(customCategoriesStr) : (customCategoriesStr || []);
      } catch {}

      wkfMode = body.wkfMode || 'standard';

      const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
      const wkfCatNames = new Set(generateWkfCategories(wkfMode));
      const filteredCustomCategories = compRules === 'wkf'
        ? customCategories.filter((c: any) => !wkfCatNames.has(c.name))
        : customCategories;

      const rawRows = body.rows || [];
      if (rawRows.length === 0) {
        return NextResponse.json({ success: false, error: 'No athlete data provided' }, { status: 400 });
      }

      const athletes = normalizeAthleteRows(rawRows);
      const bucketed = bucketAthletes(athletes, specialCategories, wkfMode, filteredCustomCategories, compRules);
      categoryMap = bucketed.categoryMap;
      uniqueAthletesCount = bucketed.uniqueAthletesCount;
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      compType = (formData.get('compType') as string) || 'international';
      const rawPoolSize = parseInt(formData.get('poolSize') as string) || 8;
      poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;

      if (!file) {
        return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      }

      const fileName = file.name?.toLowerCase() ?? '';
      const allowedExtensions = ['.csv', '.xls', '.xlsx'];
      if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
        return NextResponse.json(
          { success: false, error: `Unsupported file type "${file.name}". Please upload a .csv, .xls, or .xlsx file.` },
          { status: 400 }
        );
      }

      const specialCategoriesStr = formData.get('specialCategories') as string;
      try { specialCategories = JSON.parse(specialCategoriesStr || '[]'); } catch {}

      const customCategoriesStr = formData.get('customCategories') as string;
      try { customCategories = JSON.parse(customCategoriesStr || '[]'); } catch {}

      wkfMode = (formData.get('wkfMode') as string) || 'standard';

      const { generateWkfCategories } = await import('@taikaix/backend/lib/wkf-categories');
      const wkfCatNames = new Set(generateWkfCategories(wkfMode));
      const filteredCustomCategories = compRules === 'wkf'
        ? customCategories.filter((c: any) => !wkfCatNames.has(c.name))
        : customCategories;

      const buffer = await file.arrayBuffer();
      try {
        const parsed = parseExcelIntoCategories(buffer, specialCategories, wkfMode, filteredCustomCategories, compRules);
        categoryMap = parsed.categoryMap;
        uniqueAthletesCount = parsed.uniqueAthletesCount;
      } catch (parseErr: any) {
        console.error('[import/route] parse error:', parseErr.message);
        return NextResponse.json(
          { success: false, error: `Could not read "${file.name}". Make sure it is a valid, non-password-protected Excel or CSV file. (${parseErr.message})` },
          { status: 422 }
        );
      }
    }

    if (categoryMap.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No athlete data found. Check that the sheet has a header row and at least one athlete row.' },
        { status: 422 }
      );
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

    return NextResponse.json({ success: true, competitionId: id, uniqueAthletesCount, categories });
  } catch (error: any) {
    console.error('[import/route]', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
