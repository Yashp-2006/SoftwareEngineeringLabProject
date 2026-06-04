import { NextResponse } from 'next/server';
import { parseExcelIntoCategories, generateBracket, PoolSize } from '@lib/tiesheet-generator';
import { rateLimiter } from '@lib/rate-limiter';
import { adminDb } from '@lib/firebase-admin';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    const specialCategoriesStr = formData.get('specialCategories') as string;
    let specialCategories: any[] = [];
    try { specialCategories = JSON.parse(specialCategoriesStr || '[]'); } catch {}

    const customCategoriesStr = formData.get('customCategories') as string;
    let customCategories: any[] = [];
    try { customCategories = JSON.parse(customCategoriesStr || '[]'); } catch {}

    const wkfMode = (formData.get('wkfMode') as string) || 'standard';

    const buffer = await file.arrayBuffer();
    const categoryMap = parseExcelIntoCategories(buffer, specialCategories, wkfMode, customCategories);

    let categoriesCreated = 0;
    let athletesImported = 0;

    const competitionRef = adminDb.collection('competitions').doc(id);
    const categoriesRef = competitionRef.collection('categories');
    
    const entries = Array.from(categoryMap.entries());
    const chunkSize = 25; // Process in chunks to avoid overwhelming the database

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);

      await Promise.all(chunk.map(async ([catName, catAthletes]) => {
        if (catAthletes.length === 0) return;

        const matches = generateBracket(catAthletes, compType, poolSize);

        // Upsert: find existing category by name, or create new one
        const existingQuery = await categoriesRef.where('name', '==', catName).limit(1).get();

        const categoryData = {
          name: catName,
          competitionId: id,
          status: 'upcoming',
          athletes: catAthletes.map(a => ({
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
          })),
          matches: matches.map(m => ({
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
          entries: catAthletes.length,
          updatedAt: new Date().toISOString(),
        };

        if (!existingQuery.empty) {
          await existingQuery.docs[0].ref.update(categoryData);
        } else {
          await categoriesRef.add({ ...categoryData, createdAt: new Date().toISOString() });
          categoriesCreated++;
        }

        athletesImported += catAthletes.length;
      }));
    }

    const returnedCategories = Array.from(categoryMap.entries()).map(([name, athletes]) => ({
      id: name,
      name,
      entries: athletes.length
    }));

    await competitionRef.update({
      athletesCount: athletesImported,
      categoriesCount: categoryMap.size,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      categoriesCreated,
      categoriesTotal: categoryMap.size,
      athletesImported,
      poolSize,
      categories: returnedCategories,
    });
  } catch (error: any) {
    console.error('[import/route]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
