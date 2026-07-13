import { adminDb, verifySession } from '@taikaix/backend/lib/firebase-admin';
import { parseExcelIntoCategories, generateBracket, PoolSize } from '@taikaix/backend/services/tiesheet-generator';
import { rateLimiter } from '@lib/rate-limiter';
import { NextResponse } from 'next/server';

// Allow up to 60 seconds for large roster imports on Vercel
export const maxDuration = 60;


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

    // Guard: Firebase Admin not initialized (missing env vars on server)
    if (!adminDb) {
      console.error('[import/route] adminDb is null — Firebase Admin env vars are missing on this server.');
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Firebase Admin not initialized. Please check server environment variables.' },
        { status: 503 }
      );
    }

    let rateLimitResult = { success: true, limit: 10, reset: 0, remaining: 10 };
    try {
      rateLimitResult = await rateLimiter.limit(`import_${ip}`);
    } catch (e: any) {
      console.warn('[rate-limiter] Redis error, bypassing:', e.message);
    }
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Limit': rateLimitResult.limit.toString(), 'X-RateLimit-Remaining': rateLimitResult.remaining.toString(), 'X-RateLimit-Reset': rateLimitResult.reset.toString() } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const compType = (formData.get('compType') as string) || 'international';
    const rawPoolSize = parseInt(formData.get('poolSize') as string) || 8;
    const poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type before attempting to parse
    const fileName = file.name?.toLowerCase() ?? '';
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
      'text/plain', // some OS send CSV as text/plain
      'application/octet-stream', // some browsers send xlsx as octet-stream
    ];
    const hasValidMime = !file.type || allowedMimeTypes.includes(file.type);

    if (!hasValidExtension || !hasValidMime) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type "${file.name}". Please upload a .csv, .xls, or .xlsx file.` },
        { status: 400 }
      );
    }

    const append = formData.get('append') === 'true';

    const specialCategoriesStr = formData.get('specialCategories') as string;
    let specialCategories: any[] = [];
    try { specialCategories = JSON.parse(specialCategoriesStr || '[]'); } catch {}

    const customCategoriesStr = formData.get('customCategories') as string;
    let customCategories: any[] = [];
    try { customCategories = JSON.parse(customCategoriesStr || '[]'); } catch {}

    const wkfMode = (formData.get('wkfMode') as string) || 'standard';

    // Read file into buffer for parsing
    const buffer = await file.arrayBuffer();

    let categoryMap: Map<string, any[]>;
    let uniqueAthletesCount = 0;
    try {
      const parsed = parseExcelIntoCategories(buffer, specialCategories, wkfMode, customCategories);
      categoryMap = parsed.categoryMap;
      uniqueAthletesCount = parsed.uniqueAthletesCount;
    } catch (parseErr: any) {
      console.error('[import/route] Excel parse error:', parseErr.message);
      return NextResponse.json(
        { success: false, error: `Could not read the file "${file.name}". Make sure it is a valid, non-password-protected Excel or CSV file. (Detail: ${parseErr.message})` },
        { status: 422 }
      );
    }

    if (categoryMap.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No athlete data found in the file. Check that the sheet has a header row and at least one athlete row.' },
        { status: 422 }
      );
    }

    let categoriesCreated = 0;
    let athletesImported = 0;

    const competitionRef = adminDb.collection('competitions').doc(id);
    const competitionSnap = await competitionRef.get();
    const existingCompetitionData = competitionSnap.exists ? competitionSnap.data() : null;
    let currentAthletesCount = existingCompetitionData?.athletesCount || 0;
    let currentEntriesCount = existingCompetitionData?.entriesCount || 0;
    let currentCategoriesCount = existingCompetitionData?.categoriesCount || 0;

    const categoriesRef = competitionRef.collection('categories');
    
    const entries = Array.from(categoryMap.entries());

    const dynamicSpecialCatNames = new Set<string>();
    for (const [, catAthletes] of categoryMap) {
      for (const a of catAthletes) {
        if (a.interestSpecial) {
          dynamicSpecialCatNames.add(a.interestSpecial);
        }
      }
    }

    for (let i = 0; i < entries.length; i++) {
      const [catName, catAthletes] = entries[i];
      if (catAthletes.length === 0) continue;

      // Upsert: find existing category by name, or create new one
      const existingQuery = await categoriesRef.where('name', '==', catName).limit(1).get();

      const isSpecialCat = specialCategories.some((sc: any) => sc.name === catName) || dynamicSpecialCatNames.has(catName);

      let finalAthletes = catAthletes;
      if (append && !existingQuery.empty) {
        const existingData = existingQuery.docs[0].data();
        const existingAthletes = existingData.athletes || [];
        finalAthletes = [...existingAthletes, ...catAthletes];
      }

      const matches = generateBracket(finalAthletes, compType, poolSize);

      const categoryData = {
        name: catName,
        isSpecial: isSpecialCat,
        competitionId: id,
        status: 'upcoming',
        athletes: finalAthletes.map((a: any) => ({
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
        // Cap at 500 matches to respect Firestore 1MB document limit
        matches: matches.slice(0, 500).map(m => ({
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
          mat: null,
        })),
        entries: finalAthletes.length,
        updatedAt: new Date().toISOString(),
      };

      if (!existingQuery.empty) {
        await existingQuery.docs[0].ref.update(categoryData);
      } else {
        await categoriesRef.add({ ...categoryData, createdAt: new Date().toISOString() });
        categoriesCreated++;
      }

      athletesImported += catAthletes.length;
    }

    const returnedCategories = Array.from(categoryMap.entries()).map(([name, athletes]) => ({
      id: name,
      name,
      entries: athletes.length
    }));

    if (append) {
      await competitionRef.update({
        athletesCount: currentAthletesCount + uniqueAthletesCount,
        entriesCount: currentEntriesCount + athletesImported,
        categoriesCount: currentCategoriesCount + categoriesCreated,
        updatedAt: new Date().toISOString()
      });
    } else {
      await competitionRef.update({
        athletesCount: uniqueAthletesCount,
        entriesCount: athletesImported,
        categoriesCount: categoryMap.size,
        updatedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      categoriesCreated,
      categoriesTotal: categoryMap.size,
      athletesImported: uniqueAthletesCount,
      entriesImported: athletesImported,
      poolSize,
      categories: returnedCategories,
    });
  } catch (error: any) {
    console.error('[import/route]', error);
    const msg = error?.message || 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
