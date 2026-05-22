import * as xlsx from 'xlsx';

export interface AthleteRow {
  playerId: string;
  name: string;
  gender: string;
  weight: number | string;
  age: number;
  country: string;
  state: string;
  district: string;
  academy: string;
  interestSpecial: string;
}

export interface MatchNode {
  id: string;
  round: number;
  matchNumber: number;
  // round 1 — actual athletes assigned
  aka: Partial<AthleteRow> | null;
  ao: Partial<AthleteRow> | null;
  // round 2+ — winner references (set when round 1 finishes)
  akaFromMatchId: string | null;
  aoFromMatchId: string | null;
  akaScore: number;
  aoScore: number;
  winnerId: string | null;
  nextMatchId: string | null;
  status: 'upcoming' | 'live' | 'completed';
}

export function parseExcel(buffer: ArrayBuffer): AthleteRow[] {
  const workbook = xlsx.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet) as any[];

  return rawData.map(row => ({
    playerId: row['Player ID'] || row['playerId'] || Math.random().toString(36).substring(7),
    name: row['Name'] || row['name'] || 'Unknown',
    gender: (row['Gender'] || row['gender'] || 'Male').toString().toLowerCase(),
    weight: row['Weight'] || row['weight'] || 0,
    age: parseInt(row['Age'] || row['age'] || '18', 10),
    country: row['Country'] || row['country'] || 'Unknown',
    state: row['State'] || row['state'] || 'Unknown',
    district: row['District'] || row['district'] || 'Unknown',
    academy: row['Academy'] || row['academy'] || row['Club'] || row['club'] || 'Unknown',
    interestSpecial: row['Interest for Special Categories'] || row['interestSpecial'] || row['Special Category'] || ''
  }));
}

/**
 * Determines WKF weight category for an athlete.
 * Returns null if the athlete explicitly registered for a special/custom category.
 */
export function determineCategory(athlete: AthleteRow, specialCategories: any[] = []): string {
  // If athlete explicitly registered for a special/custom category, use it
  if (athlete.interestSpecial && athlete.interestSpecial.trim()) {
    return athlete.interestSpecial.trim();
  }

  // Check if athlete matches any special/custom category constraints
  for (const cat of specialCategories) {
    let matches = true;
    
    // Check age range
    if (athlete.age < (cat.minAge || 0) || athlete.age > (cat.maxAge || 99)) {
      matches = false;
    }
    
    // Check weight range
    const weight = typeof athlete.weight === 'number' ? athlete.weight : parseFloat(String(athlete.weight) || '0');
    if (weight < (cat.minWeight || 0) || weight > (cat.maxWeight || 300)) {
      matches = false;
    }
    
    // In real life we could check medal reqs here, but for now age & weight are the filters
    if (matches) {
      return cat.name;
    }
  }

  const genderGroup = athlete.gender.startsWith('f') ? 'Female' : 'Male';
  const age = athlete.age;
  let ageGroup = '';

  // WKF age groups
  if (age >= 18) ageGroup = 'Senior';
  else if (age >= 16) ageGroup = 'Junior';
  else if (age >= 14) ageGroup = 'Cadet';
  else if (age >= 12) ageGroup = 'U14';
  else if (age >= 10) ageGroup = 'U10';
  else if (age >= 8) ageGroup = 'U8';
  else ageGroup = 'U8';

  let weightGroup = '';
  const w = typeof athlete.weight === 'number' ? athlete.weight : parseFloat(String(athlete.weight) || '0');

  // WKF weight divisions by age group and gender
  if (ageGroup === 'Senior') {
    if (genderGroup === 'Male') {
      if (w <= 60) weightGroup = '-60kg';
      else if (w <= 67) weightGroup = '-67kg';
      else if (w <= 75) weightGroup = '-75kg';
      else if (w <= 84) weightGroup = '-84kg';
      else weightGroup = '+84kg';
    } else {
      if (w <= 50) weightGroup = '-50kg';
      else if (w <= 55) weightGroup = '-55kg';
      else if (w <= 61) weightGroup = '-61kg';
      else if (w <= 68) weightGroup = '-68kg';
      else weightGroup = '+68kg';
    }
  } else if (ageGroup === 'Junior') {
    if (genderGroup === 'Male') {
      if (w <= 55) weightGroup = '-55kg';
      else if (w <= 61) weightGroup = '-61kg';
      else if (w <= 68) weightGroup = '-68kg';
      else if (w <= 76) weightGroup = '-76kg';
      else weightGroup = '+76kg';
    } else {
      if (w <= 48) weightGroup = '-48kg';
      else if (w <= 53) weightGroup = '-53kg';
      else if (w <= 59) weightGroup = '-59kg';
      else if (w <= 66) weightGroup = '-66kg';
      else weightGroup = '+66kg';
    }
  } else if (ageGroup === 'Cadet') {
    if (genderGroup === 'Male') {
      if (w <= 52) weightGroup = '-52kg';
      else if (w <= 57) weightGroup = '-57kg';
      else if (w <= 63) weightGroup = '-63kg';
      else if (w <= 70) weightGroup = '-70kg';
      else weightGroup = '+70kg';
    } else {
      if (w <= 47) weightGroup = '-47kg';
      else if (w <= 54) weightGroup = '-54kg';
      else if (w <= 61) weightGroup = '-61kg';
      else weightGroup = '+61kg';
    }
  } else {
    // U14, U12, U10, U8 — simplified groupings
    if (w <= 30) weightGroup = '-30kg';
    else if (w <= 40) weightGroup = '-40kg';
    else if (w <= 50) weightGroup = '-50kg';
    else weightGroup = '+50kg';
  }

  return `${ageGroup} ${genderGroup} ${weightGroup}`.trim();
}

/**
 * WKF Separation Algorithm.
 * 
 * For NATIONAL tournaments:   sort by State > District > Academy
 * For INTERNATIONAL tournaments: sort by Country > State > Academy
 * 
 * Then "card-deal" into two halves and re-interleave to ensure maximum separation.
 * The result: index%2==0 → AKA position, index%2==1 → AO position.
 */
export function separateAthletes(athletes: AthleteRow[], compType: string = 'international'): AthleteRow[] {
  const sorted = [...athletes].sort((a, b) => {
    if (compType === 'national') {
      // National: separate by state first, then district, then academy
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      if (a.district !== b.district) return a.district.localeCompare(b.district);
    } else {
      // International: separate by country first, then state, then academy
      if (a.country !== b.country) return a.country.localeCompare(b.country);
      if (a.state !== b.state) return a.state.localeCompare(b.state);
    }
    return a.academy.localeCompare(b.academy);
  });

  // WKF card-deal: split sorted list into two halves, then re-interleave
  // This ensures athletes from same region are placed on OPPOSITE sides of the bracket
  const half1: AthleteRow[] = [];
  const half2: AthleteRow[] = [];
  
  sorted.forEach((athlete, index) => {
    if (index % 2 === 0) half1.push(athlete);
    else half2.push(athlete);
  });

  // Interleave for final bracket array
  // Even indices (0, 2, 4...) → AKA position
  // Odd indices (1, 3, 5...)  → AO position
  const finalArray: AthleteRow[] = [];
  const maxLength = Math.max(half1.length, half2.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < half1.length) finalArray.push(half1[i]);
    if (i < half2.length) finalArray.push(half2[i]);
  }

  return finalArray;
}

/**
 * Generates a WKF-compliant elimination bracket.
 * 
 * Rules:
 * - ≤ 2 athletes: single match
 * - 3-5 athletes: Round Robin
 * - 6+ athletes: Single Elimination with byes to next power of 2
 * 
 * AKA/AO assignment: index%2==0 → AKA, index%2==1 → AO (WKF convention)
 * 
 * Later rounds are generated with null aka/ao but with akaFromMatchId/aoFromMatchId
 * references so the UI can show "WINNER M01" placeholders.
 */
export function generateBracket(athletes: AthleteRow[], compType: string = 'international'): MatchNode[] {
  if (athletes.length === 0) return [];

  // Single match
  if (athletes.length === 2) {
    const separated = separateAthletes(athletes, compType);
    return [{
      id: 'R1-M1',
      round: 1,
      matchNumber: 1,
      aka: separated[0],
      ao: separated[1],
      akaFromMatchId: null,
      aoFromMatchId: null,
      akaScore: 0,
      aoScore: 0,
      winnerId: null,
      nextMatchId: null,
      status: 'upcoming',
    }];
  }

  const separated = separateAthletes(athletes, compType);

  // Round Robin for 3-5 athletes
  if (separated.length >= 3 && separated.length <= 5) {
    const matches: MatchNode[] = [];
    let matchCounter = 1;
    for (let i = 0; i < separated.length; i++) {
      for (let j = i + 1; j < separated.length; j++) {
        matches.push({
          id: `RR-M${matchCounter}`,
          round: 1,
          matchNumber: matchCounter++,
          aka: separated[i],
          ao: separated[j],
          akaFromMatchId: null,
          aoFromMatchId: null,
          akaScore: 0,
          aoScore: 0,
          winnerId: null,
          nextMatchId: null,
          status: 'upcoming',
        });
      }
    }
    return matches;
  }

  // Single Elimination for 6+ athletes
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(separated.length)));
  const totalR1Matches = nextPowerOf2 / 2;
  
  const matches: MatchNode[] = [];
  let matchCounter = 1;

  // Round 1: assign real athletes, handle byes
  const round1Matches: MatchNode[] = [];
  for (let i = 0; i < totalR1Matches; i++) {
    const akaIndex = i * 2;      // even index → AKA (WKF rule)
    const aoIndex = i * 2 + 1;  // odd index  → AO  (WKF rule)
    
    const akaAthlete = akaIndex < separated.length ? separated[akaIndex] : null;
    const aoAthlete = aoIndex < separated.length ? separated[aoIndex] : null;

    const match: MatchNode = {
      id: `R1-M${i + 1}`,
      round: 1,
      matchNumber: matchCounter++,
      aka: akaAthlete,
      ao: aoAthlete,
      akaFromMatchId: null,
      aoFromMatchId: null,
      akaScore: 0,
      aoScore: 0,
      // Auto-advance on bye (only aka present, ao is null)
      winnerId: (akaAthlete && !aoAthlete) ? akaAthlete.playerId : null,
      nextMatchId: null,
      status: 'upcoming',
    };
    
    round1Matches.push(match);
    matches.push(match);
  }

  // Build subsequent rounds with winner-reference placeholders
  let currentRoundMatches = round1Matches;
  let roundNum = 2;

  while (currentRoundMatches.length > 1) {
    const nextRoundMatches: MatchNode[] = [];
    
    for (let i = 0; i < currentRoundMatches.length; i += 2) {
      const match1 = currentRoundMatches[i];
      const match2 = currentRoundMatches[i + 1];
      
      const newMatch: MatchNode = {
        id: `R${roundNum}-M${Math.floor(i / 2) + 1}`,
        round: roundNum,
        matchNumber: matchCounter++,
        // Future rounds start with no athletes — they'll be filled when matches complete
        aka: null,
        ao: null,
        // But we store which match their winner will come from (for UI placeholder labels)
        akaFromMatchId: match1.id,
        aoFromMatchId: match2 ? match2.id : null,
        akaScore: 0,
        aoScore: 0,
        winnerId: null,
        nextMatchId: null,
        status: 'upcoming',
      };
      
      // Link previous matches to this one
      match1.nextMatchId = newMatch.id;
      if (match2) match2.nextMatchId = newMatch.id;
      
      nextRoundMatches.push(newMatch);
      matches.push(newMatch);
    }
    
    currentRoundMatches = nextRoundMatches;
    roundNum++;
  }

  return matches;
}
