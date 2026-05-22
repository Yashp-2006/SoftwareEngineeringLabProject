import { NextResponse } from 'next/server';
import { parseExcel, determineCategory, generateBracket } from '@lib/tiesheet-generator';
import { rateLimiter } from '@lib/rate-limiter';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Apply Rate Limiting
    const { success, limit, reset, remaining } = await rateLimiter.limit(`import_${ip}`);
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Limit': limit.toString(), 'X-RateLimit-Remaining': remaining.toString(), 'X-RateLimit-Reset': reset.toString() } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const compType = formData.get('compType') as string || 'international';
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const specialCategoriesStr = formData.get('specialCategories') as string;
    let specialCategories: any[] = [];
    if (specialCategoriesStr) {
      try {
        specialCategories = JSON.parse(specialCategoriesStr);
      } catch (e) {}
    }

    const buffer = await file.arrayBuffer();
    const athletes = parseExcel(buffer);

    // Group by category
    const categoriesMap: Record<string, any[]> = {};
    for (const ath of athletes) {
      const cat = ath.interestSpecial || determineCategory(ath, specialCategories);
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push(ath);
    }

    const results = [];
    for (const [catName, catAthletes] of Object.entries(categoriesMap)) {
      const matches = generateBracket(catAthletes, compType);
      results.push({
        categoryName: catName,
        athletes: catAthletes,
        matches
      });
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
