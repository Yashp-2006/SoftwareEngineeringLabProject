export function getAgeFromCategory(catName: string): number {
  if (catName.includes('U8')) return 8;
  if (catName.includes('U10')) return 10;
  if (catName.includes('U12')) return 12;
  if (catName.includes('U14')) return 14;
  if (catName.includes('U16') || catName.includes('Cadet')) return 16;
  if (catName.includes('U18') || catName.includes('Junior')) return 18;
  if (catName.includes('Under 21') || catName.includes('U21')) return 21;
  if (catName.includes('Senior')) return 22;
  if (catName.includes('Veteran') || catName.includes('Masters')) return 35;
  
  const ageMatch = catName.match(/(\d+)\s*Years?/i) || catName.match(/(?:^|\s|\()(\d+)-/);
  if (ageMatch) {
    return parseInt(ageMatch[1], 10);
  }
  
  return 99; // Unknown
}

export function getGenderRank(catName: string): number {
  const lower = catName.toLowerCase();
  // Female categories first (rank 0)
  if (/\b(female|girls?|women)\b/.test(lower) || lower.includes('female')) {
    return 0;
  }
  // Male categories second (rank 1)
  if (/\b(male|boys?|men)\b/.test(lower) || lower.includes('male')) {
    return 1;
  }
  // Mixed / open / unspecified last (rank 2)
  return 2;
}

export function getDisciplineRank(catName: string): number {
  const lower = catName.toLowerCase();
  if (lower.includes('kata')) return 0; // Kata first
  return 1; // Kumite / other
}

export function getWeightInfo(catName: string): { isKata: boolean; isPlus: boolean; weight: number } {
  const lower = catName.toLowerCase();
  if (lower.includes('kata')) {
    return { isKata: true, isPlus: false, weight: -1 };
  }
  const match = catName.match(/([+-]?)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
  if (match) {
    const isPlus = match[1] === '+';
    const weight = parseFloat(match[2]);
    return { isKata: false, isPlus, weight };
  }
  return { isKata: false, isPlus: false, weight: 999 };
}

export function compareCategoryNames(nameA: string, nameB: string): number {
  // 1. Age: Youngest to Oldest
  const ageA = getAgeFromCategory(nameA);
  const ageB = getAgeFromCategory(nameB);
  if (ageA !== ageB) return ageA - ageB;

  // 2. Gender: Female first, then Male
  const genA = getGenderRank(nameA);
  const genB = getGenderRank(nameB);
  if (genA !== genB) return genA - genB;

  // 3. Discipline: Kata first, then Kumite
  const discA = getDisciplineRank(nameA);
  const discB = getDisciplineRank(nameB);
  if (discA !== discB) return discA - discB;

  // 4. Weight: Lightest to Heaviest (plus/heavyweight categories last)
  const wA = getWeightInfo(nameA);
  const wB = getWeightInfo(nameB);

  if (!wA.isKata && !wB.isKata) {
    if (wA.isPlus !== wB.isPlus) {
      if (wA.weight === wB.weight) {
        return wA.isPlus ? 1 : -1;
      }
      if (!wA.isPlus && wB.isPlus && wA.weight <= wB.weight) return -1;
      if (wA.isPlus && !wB.isPlus && wA.weight >= wB.weight) return 1;
    }
    if (wA.weight !== wB.weight) {
      return wA.weight - wB.weight;
    }
  }

  // 5. Fallback alphabetical
  return nameA.localeCompare(nameB);
}

export function sortCategories<T extends { name?: string, categoryName?: string, id?: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const nameA = (a.name || a.categoryName || a.id || '');
    const nameB = (b.name || b.categoryName || b.id || '');
    return compareCategoryNames(nameA, nameB);
  });
}
