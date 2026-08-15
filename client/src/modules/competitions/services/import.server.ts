import { parseExcelIntoCategories, generateBracket, PoolSize, normalizeAthleteRows, bucketAthletes } from '@taikaix/backend/services/tiesheet/generator';
import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { generateWkfCategories } from '@taikaix/backend/lib/wkf-categories';

export class ImportService {
  /**
   * Parses Excel/CSV files or JSON rows, buckets athletes into categories, and generates un-saved brackets.
   * This logic is memory intensive so it is handled carefully.
   */
  static async processImport(id: string, options: any) {
    const { isJson, jsonBody, formData } = options;

    const compSnap = await adminDb.collection('competitions').doc(id).get();
    const compData = compSnap.exists ? compSnap.data() : null;
    const compRules = compData?.rules || 'custom';

    let compType = 'international';
    let poolSize: PoolSize = 8;
    let specialCategories: any[] = [];
    let customCategories: any[] = [];
    let wkfMode = 'standard';
    let categoryMap: Map<string, any[]> = new Map();
    let uniqueAthletesCount = 0;

    if (isJson) {
      compType = jsonBody.compType || 'international';
      const rawPoolSize = parseInt(jsonBody.poolSize) || 8;
      poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;
      
      const specialCategoriesStr = jsonBody.specialCategories;
      try {
        specialCategories = typeof specialCategoriesStr === 'string' ? JSON.parse(specialCategoriesStr) : (specialCategoriesStr || []);
      } catch {}

      const customCategoriesStr = jsonBody.customCategories;
      try {
        customCategories = typeof customCategoriesStr === 'string' ? JSON.parse(customCategoriesStr) : (customCategoriesStr || []);
      } catch {}

      wkfMode = jsonBody.wkfMode || 'standard';

      const wkfCatNames = new Set(generateWkfCategories(wkfMode).map(c => c.name));
      const filteredCustomCategories = compRules === 'wkf'
        ? customCategories.filter((c: any) => !wkfCatNames.has(c.name))
        : customCategories;

      const rawRows = jsonBody.rows || [];
      if (rawRows.length === 0) {
        throw new Error('BAD_REQUEST: No athlete data provided');
      }

      const athletes = normalizeAthleteRows(rawRows);
      const bucketed = bucketAthletes(athletes, specialCategories, wkfMode, filteredCustomCategories, compRules);
      categoryMap = bucketed.categoryMap;
      uniqueAthletesCount = bucketed.uniqueAthletesCount;
    } else {
      const file = formData.get('file') as File;
      compType = (formData.get('compType') as string) || 'international';
      const rawPoolSize = parseInt(formData.get('poolSize') as string) || 8;
      poolSize = ([4, 8, 16, 32].includes(rawPoolSize) ? rawPoolSize : 8) as PoolSize;

      if (!file) {
        throw new Error('BAD_REQUEST: No file uploaded');
      }

      const fileName = file.name?.toLowerCase() ?? '';
      const allowedExtensions = ['.csv', '.xls', '.xlsx'];
      if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
        throw new Error(`BAD_REQUEST: Unsupported file type "${file.name}". Please upload a .csv, .xls, or .xlsx file.`);
      }

      const specialCategoriesStr = formData.get('specialCategories') as string;
      try { specialCategories = JSON.parse(specialCategoriesStr || '[]'); } catch {}

      const customCategoriesStr = formData.get('customCategories') as string;
      try { customCategories = JSON.parse(customCategoriesStr || '[]'); } catch {}

      wkfMode = (formData.get('wkfMode') as string) || 'standard';

      const wkfCatNames = new Set(generateWkfCategories(wkfMode).map(c => c.name));
      const filteredCustomCategories = compRules === 'wkf'
        ? customCategories.filter((c: any) => !wkfCatNames.has(c.name))
        : customCategories;

      let buffer: ArrayBuffer | string;
      if (file.name.toLowerCase().endsWith('.csv')) {
        buffer = await file.text();
      } else {
        buffer = await file.arrayBuffer();
      }

      try {
        const parsed = parseExcelIntoCategories(buffer, specialCategories, wkfMode, filteredCustomCategories, compRules);
        categoryMap = parsed.categoryMap;
        uniqueAthletesCount = parsed.uniqueAthletesCount;
      } catch (parseErr: any) {
        throw new Error(`UNPROCESSABLE_ENTITY: Could not read "${file.name}". Make sure it is a valid, non-password-protected Excel or CSV file. (${parseErr.message})`);
      }
    }

    if (categoryMap.size === 0) {
      throw new Error('UNPROCESSABLE_ENTITY: No athlete data found. Check that the sheet has a header row and at least one athlete row.');
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

    return { uniqueAthletesCount, categories };
  }
}
