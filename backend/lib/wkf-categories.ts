export const WKF_CATEGORIES = [
  "Senior (18+) Male -60 kg",
  "Senior (18+) Male -67 kg",
  "Senior (18+) Male -75 kg",
  "Senior (18+) Male -84 kg",
  "Senior (18+) Male +84 kg",
  "Senior (18+) Female -50 kg",
  "Senior (18+) Female -55 kg",
  "Senior (18+) Female -61 kg",
  "Senior (18+) Female -68 kg",
  "Senior (18+) Female +68 kg",
  "Under 21 (18-20) Male -60 kg",
  "Under 21 (18-20) Male -67 kg",
  "Under 21 (18-20) Male -75 kg",
  "Under 21 (18-20) Male -84 kg",
  "Under 21 (18-20) Male +84 kg",
  "Under 21 (18-20) Female -50 kg",
  "Under 21 (18-20) Female -55 kg",
  "Under 21 (18-20) Female -61 kg",
  "Under 21 (18-20) Female -68 kg",
  "Under 21 (18-20) Female +68 kg",
  "Junior / U18 (16-17) Male -55 kg",
  "Junior / U18 (16-17) Male -61 kg",
  "Junior / U18 (16-17) Male -68 kg",
  "Junior / U18 (16-17) Male -76 kg",
  "Junior / U18 (16-17) Male +76 kg",
  "Junior / U18 (16-17) Female -48 kg",
  "Junior / U18 (16-17) Female -53 kg",
  "Junior / U18 (16-17) Female -59 kg",
  "Junior / U18 (16-17) Female -66 kg",
  "Junior / U18 (16-17) Female +66 kg",
  "Cadet / U16 (14-15) Male -52 kg",
  "Cadet / U16 (14-15) Male -57 kg",
  "Cadet / U16 (14-15) Male -63 kg",
  "Cadet / U16 (14-15) Male -70 kg",
  "Cadet / U16 (14-15) Male +70 kg",
  "Cadet / U16 (14-15) Female -47 kg",
  "Cadet / U16 (14-15) Female -54 kg",
  "Cadet / U16 (14-15) Female -61 kg",
  "Cadet / U16 (14-15) Female +61 kg",
  "U14 (12-13) Male -40 kg",
  "U14 (12-13) Male -45 kg",
  "U14 (12-13) Male -50 kg",
  "U14 (12-13) Male -55 kg",
  "U14 (12-13) Male +55 kg",
  "U14 (12-13) Female -42 kg",
  "U14 (12-13) Female -47 kg",
  "U14 (12-13) Female -52 kg",
  "U14 (12-13) Female +52 kg",
  "U12 (10-11) Male -30 kg",
  "U12 (10-11) Male -35 kg",
  "U12 (10-11) Male -40 kg",
  "U12 (10-11) Male -45 kg",
  "U12 (10-11) Male +45 kg",
  "U12 (10-11) Female -30 kg",
  "U12 (10-11) Female -35 kg",
  "U12 (10-11) Female -40 kg",
  "U12 (10-11) Female +40 kg",
  "U10 (8-9) Male -25 kg",
  "U10 (8-9) Male -30 kg",
  "U10 (8-9) Male -35 kg",
  "U10 (8-9) Male +35 kg",
  "U10 (8-9) Female -25 kg",
  "U10 (8-9) Female -30 kg",
  "U10 (8-9) Female +30 kg",
  "U8 (6-7) Male / Female -20 kg",
  "U8 (6-7) Male / Female -25 kg",
  "U8 (6-7) Male / Female +25 kg",
  "Toddler / Preschool (3-5) Mixed Gender Kata Only",
  "Senior (18+) Male Kata",
  "Senior (18+) Female Kata",
  "Under 21 (18-20) Male Kata",
  "Under 21 (18-20) Female Kata",
  "Junior / U18 (16-17) Male Kata",
  "Junior / U18 (16-17) Female Kata",
  "Cadet / U16 (14-15) Male Kata",
  "Cadet / U16 (14-15) Female Kata",
  "U14 (12-13) Male Kata",
  "U14 (12-13) Female Kata",
  "U12 (10-11) Male Kata",
  "U12 (10-11) Female Kata",
  "U10 (8-9) Male Kata",
  "U10 (8-9) Female Kata",
  "U8 (6-7) Male / Female Kata"
];

export interface WkfCategoryDetails {
  name: string;
  gender: 'Male' | 'Female' | 'Any';
  minAge?: number;
  maxAge?: number;
  minWeight?: number;
  maxWeight?: number;
  isKata: boolean;
}

export function parseWkfCategoryName(name: string): Omit<WkfCategoryDetails, 'name'> {
  let gender: 'Male' | 'Female' | 'Any' = 'Any';
  if (name.includes('Male / Female') || name.includes('Mixed Gender')) gender = 'Any';
  else if (name.includes('Male')) gender = 'Male';
  else if (name.includes('Female')) gender = 'Female';

  let minAge: number | undefined;
  let maxAge: number | undefined;
  if (name.includes('Senior (18+)')) { minAge = 18; maxAge = 99; }
  else if (name.includes('Under 21 (18-20)')) { minAge = 18; maxAge = 21; }
  else if (name.includes('Junior / U18 (16-17)')) { minAge = 16; maxAge = 18; }
  else if (name.includes('Cadet / U16 (14-15)')) { minAge = 14; maxAge = 16; }
  else if (name.includes('U14 (12-13)')) { minAge = 12; maxAge = 14; }
  else if (name.includes('U12 (10-11)')) { minAge = 10; maxAge = 12; }
  else if (name.includes('U10 (8-9)')) { minAge = 8; maxAge = 10; }
  else if (name.includes('U8 (6-7)')) { minAge = 6; maxAge = 8; }
  else if (name.includes('Toddler')) { minAge = 3; maxAge = 6; }

  let minWeight: number | undefined;
  let maxWeight: number | undefined;
  const wMatch = name.match(/([+-])(\d+)\s*kg/);
  if (wMatch) {
    const val = parseInt(wMatch[2]);
    if (wMatch[1] === '-') { maxWeight = val; }
    else if (wMatch[1] === '+') { minWeight = val; }
  }

  const isKata = name.toLowerCase().includes('kata');

  return { gender, minAge, maxAge, minWeight, maxWeight, isKata };
}

export function generateWkfCategories(mode: string = 'standard'): WkfCategoryDetails[] {
  const baseNames: string[] = [];
  if (mode === 'standard') {
    baseNames.push(...WKF_CATEGORIES);
  } else {
    const unique = new Set<string>();
    for (const cat of WKF_CATEGORIES) {
      if (cat.includes('Toddler')) {
        unique.add(cat);
        continue;
      }
      const isMale = cat.includes('Male');
      const genderSplit = isMale ? 'Male' : 'Female';
      if (cat.includes('Male / Female')) {
        const parts = cat.split('Male / Female');
        if (mode === 'age') unique.add(parts[0].trim() + ' Male / Female');
        else if (mode === 'weight') unique.add('Male / Female ' + parts[1].trim());
        continue;
      }
      const parts = cat.split(genderSplit);
      const agePart = parts[0].trim();
      const weightPart = parts[1].trim();
      if (mode === 'age') {
        unique.add(`${agePart} ${genderSplit}`.trim());
      } else if (mode === 'weight') {
        unique.add(`${genderSplit} ${weightPart}`.trim());
      }
    }
    baseNames.push(...Array.from(unique));
  }

  return baseNames.map(name => ({
    name,
    ...parseWkfCategoryName(name)
  }));
}
