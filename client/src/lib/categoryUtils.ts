export function getAgeFromCategory(catName: string): number {
  if (catName.includes('U8')) return 8;
  if (catName.includes('U10')) return 10;
  if (catName.includes('U12')) return 12;
  if (catName.includes('U14')) return 14;
  if (catName.includes('U16') || catName.includes('Cadet')) return 16;
  if (catName.includes('U18') || catName.includes('Junior')) return 18;
  if (catName.includes('Senior')) return 20;
  if (catName.includes('Veteran')) return 35;
  
  const ageMatch = catName.match(/(\d+)\s*Years?/i) || catName.match(/(?:^|\s|\()(\d+)-/);
  if (ageMatch) {
    return parseInt(ageMatch[1], 10);
  }
  
  return 99; // Unknown
}

export function sortCategories<T extends { name?: string, categoryName?: string, id?: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const nameA = (a.name || a.categoryName || a.id || '');
    const nameB = (b.name || b.categoryName || b.id || '');
    const ageA = getAgeFromCategory(nameA);
    const ageB = getAgeFromCategory(nameB);
    
    if (ageA !== ageB) {
      return ageA - ageB;
    }
    return nameA.localeCompare(nameB);
  });
}
