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
  "Toddler / Preschool (3-5) Mixed Gender Kata Only"
];

export function generateWkfCategories(mode: string = 'standard'): string[] {
  if (mode === 'standard') return [...WKF_CATEGORIES];

  const unique = new Set<string>();

  for (const cat of WKF_CATEGORIES) {
    if (cat.includes('Toddler')) {
      unique.add(cat);
      continue;
    }

    const isMale = cat.includes('Male');
    const genderSplit = isMale ? 'Male' : 'Female';
    
    // Some categories like U8 have "Male / Female"
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

  return Array.from(unique);
}
