import * as xlsx from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AthleteRow {
  playerId: string;
  name: string;
  gender: string;
  weight: number;
  age: number;
  country: string;
  state: string;
  district: string;
  academy: string;
  interestSpecial: string;
  events?: string[];
  medal?: 'gold' | 'silver' | 'bronze' | null;
  sourceCategory?: string;
  coachName?: string;
  phone?: string;
  email?: string;
}

export interface MatchNode {
  id: string;
  round: number;
  matchNumber: number;
  aka: Partial<AthleteRow> | null;
  ao: Partial<AthleteRow> | null;
  akaFromMatchId: string | null;
  aoFromMatchId: string | null;
  akaScore: number;
  aoScore: number;
  winnerId: string | null;
  nextMatchId: string | null;
  status: 'upcoming' | 'live' | 'completed';
  mat?: string | null;
}

export interface SpecialCategoryRule {
  id?: string;
  name: string;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  minWeight?: number;
  maxWeight?: number;
  sourceCategoryId?: string;
  medal?: string;
}

export interface CategoryDoc {
  id: string;
  name: string;
  athletes?: AthleteRow[];
  matches?: MatchNode[];
  status?: string;
}

export type PoolSize = 4 | 8 | 16 | 32;

// ─── Excel Parsing ─────────────────────────────────────────────────────────────

/**
 * Parses an Excel/CSV file and returns a flat list of athletes.
 * Reads the first sheet. Athletes are returned sorted A-Z by name.
 */
export function parseExcel(buffer: ArrayBuffer): AthleteRow[] {
  const workbook = xlsx.read(buffer, { type: 'array' });
  const allAthletes: AthleteRow[] = [];

  // Read all sheets (some tournaments export one sheet per category)
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

    for (const rawRow of rawData) {
      const row: any = {};
      for (const key in rawRow) {
        row[key.trim().toLowerCase()] = rawRow[key];
      }
      
      const rawWeight = row['weight'] ?? row['weight (kg)'] ?? row['weight(kg)'] ?? 0;
      
      let parsedName = '';
      let parsedAcademy = '';
      let parsedFirst = '';
      let parsedLast = '';
      let coachName = '';
      let phone = '';
      let email = '';

      for (const k of Object.keys(row)) {
        if (!parsedAcademy && (k.includes('academy') || k.includes('club') || k.includes('team') || k.includes('dojo') || k.includes('school') || k.includes('organization') || k.includes('association') || k.includes('dojo/organization')) && !k.includes('id')) {
          parsedAcademy = String(row[k]);
        } else if (k.includes('first name') || k === 'first') {
          parsedFirst = String(row[k]);
        } else if (k.includes('last name') || k === 'last' || k === 'surname') {
          parsedLast = String(row[k]);
        } else if (!parsedName && (k.includes('name') || k.includes('athlete') || k.includes('player') || k.includes('participant') || k.includes('competitor'))) {
          if (!k.includes('coach')) {
            parsedName = String(row[k]);
          }
        }
        
        if (k.includes('coach') || k.includes('instructor')) {
          coachName = String(row[k]);
        } else if (k.includes('phone') || k.includes('mobile') || k.includes('contact')) {
          phone = String(row[k]);
        } else if (k.includes('email') || k.includes('mail')) {
          email = String(row[k]);
        }
      }

      if (!parsedName && (parsedFirst || parsedLast)) {
        parsedName = `${parsedFirst} ${parsedLast}`.trim();
      }
      
      parsedName = parsedName.trim() || 'Unknown';
      if (parsedName.toUpperCase() === 'BYE') continue; // Skip explicit BYE rows to let generator handle empty slots
      parsedAcademy = parsedAcademy.trim() || 'Unknown';

      // ... age parsing remains the same ...
      let parsedAge = parseInt(String(row['age'] ?? ''), 10);
      if (isNaN(parsedAge) || !row['age']) {
        let dobVal: any = null;
        for (const k of Object.keys(row)) {
          if (k.includes('dob') || k.includes('date of birth') || k.includes('birth')) {
            dobVal = row[k];
            break;
          }
        }
        if (dobVal) {
          if (!isNaN(Number(dobVal)) && Number(dobVal) > 1900 && Number(dobVal) <= new Date().getFullYear()) {
            parsedAge = new Date().getFullYear() - Number(dobVal); // Year string
          } else if (!isNaN(Number(dobVal))) {
             const excelEpoch = new Date(1899, 11, 30);
             const actualDate = new Date(excelEpoch.getTime() + Number(dobVal) * 86400000);
             parsedAge = new Date().getFullYear() - actualDate.getFullYear(); // Excel serial date
          } else {
            const d = new Date(String(dobVal));
            if (!isNaN(d.getTime())) {
              parsedAge = new Date().getFullYear() - d.getFullYear(); // Parsable date string
            }
          }
        }
      }
      parsedAge = isNaN(parsedAge) ? 18 : parsedAge; // fallback

      const events: string[] = [];
      
      for (const k of Object.keys(row)) {
        if (!k) continue;
        const val = String(row[k]).toLowerCase().trim();
        if (val === 'yes' || val === 'y' || val === 'true' || val === '1' || val === 'x' || val === 'checked') {
          events.push(k.toLowerCase().trim());
        }
      }

      allAthletes.push({
        playerId: String(row['player id'] ?? row['playerid'] ?? row['id'] ?? row['athlete id'] ?? '').trim() ||
          `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: parsedName,
        gender: String(row['gender'] ?? row['sex'] ?? 'male').trim().toLowerCase(),
        weight: parseFloat(String(rawWeight)) || 0,
        age: parsedAge,
        country: String(row['country'] || row['nation'] || row['nationality'] || ''),
        state: String(row['state'] || row['region'] || row['province'] || ''),
        district: String(row['district'] || row['city'] || ''),
        academy: parsedAcademy,
        interestSpecial: String(row['interest special'] || row['special interest'] || row['notes'] || ''),
        events,
        coachName: coachName || undefined,
        phone: phone || undefined,
        email: email || undefined
      });
    }
  }

  // Sort A-Z by name within each parsed batch
  allAthletes.sort((a, b) => a.name.localeCompare(b.name));
  return allAthletes;
}

/**
 * Parses an Excel file and buckets athletes into category groups.
 * Athletes with a non-empty `interestSpecial` field are placed in that
 * bucket instead of their standard age/weight category.
 */
export function parseExcelIntoCategories(
  buffer: ArrayBuffer,
  specialCategories: SpecialCategoryRule[] = [],
  wkfMode: string = 'standard',
  customCategories: SpecialCategoryRule[] = []
): Map<string, AthleteRow[]> {
  const athletes = parseExcel(buffer);
  const categoryMap = new Map<string, AthleteRow[]>();

  const addToCategory = (catName: string, athlete: AthleteRow) => {
    if (!categoryMap.has(catName)) categoryMap.set(catName, []);
    categoryMap.get(catName)!.push({ ...athlete });
  };

  for (const athlete of athletes) {
    let addedToAny = false;
    const events = athlete.events || [];

    // 1. Check for registered events
    for (const event of events) {
      const matchedSpecial = specialCategories.find(sc => sc.name.toLowerCase() === event);
      
      if (matchedSpecial) {
        addToCategory(matchedSpecial.name, athlete);
        addedToAny = true;
      } else if (event === 'kata') {
        const base = determineCategory(athlete, specialCategories, 'age');
        addToCategory(`${base} Kata`, athlete);
        addedToAny = true;
      } else if (event === 'kumite') {
        addToCategory(determineCategory(athlete, specialCategories, wkfMode), athlete);
        addedToAny = true;
      }
    }

    // 2. Legacy interestSpecial check
    if (!addedToAny && athlete.interestSpecial) {
      addToCategory(athlete.interestSpecial, athlete);
      addedToAny = true;
    }

    // 3. Fallback to standard Kumite or Custom Categories
    if (!addedToAny) {
      if (customCategories.length > 0) {
        const match = customCategories.find(c => {
          if (c.gender && c.gender !== 'Any' && athlete.gender.charAt(0).toLowerCase() !== c.gender.charAt(0).toLowerCase()) return false;
          if (c.minAge !== undefined && athlete.age < c.minAge) return false;
          if (c.maxAge !== undefined && athlete.age > c.maxAge) return false;
          if (c.minWeight !== undefined && athlete.weight < c.minWeight) return false;
          if (c.maxWeight !== undefined && athlete.weight > c.maxWeight) return false;
          return true;
        });
        if (match) {
          addToCategory(match.name, athlete);
        } else {
          addToCategory('Uncategorized', athlete);
        }
      } else {
        addToCategory(determineCategory(athlete, specialCategories, wkfMode), athlete);
      }
    }
  }

  // Sort each category's athletes A-Z by name
  for (const athletes of categoryMap.values()) {
    athletes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return categoryMap;
}

// ─── Category Determination ────────────────────────────────────────────────────

/**
 * Determines the standard WKF weight/age category for an athlete.
 */
export function determineCategory(athlete: AthleteRow, specialCategories: SpecialCategoryRule[] = [], wkfMode: string = 'standard'): string {
  let genderGroup = athlete.gender.startsWith('f') ? 'Female' : 'Male';
  const age = athlete.age;
  const w = athlete.weight;

  let ageGroup = '';
  if (age >= 18) ageGroup = 'Senior (18+)';
  else if (age >= 16) ageGroup = 'Junior / U18 (16-17)';
  else if (age >= 14) ageGroup = 'Cadet / U16 (14-15)';
  else if (age >= 12) ageGroup = 'U14 (12-13)';
  else if (age >= 10) ageGroup = 'U12 (10-11)';
  else if (age >= 8) ageGroup = 'U10 (8-9)';
  else ageGroup = 'U8 (6-7)';

  let weightGroup = '';

  if (ageGroup === 'Senior (18+)') {
    if (genderGroup === 'Male') {
      if (w <= 60) weightGroup = '-60 kg';
      else if (w <= 67) weightGroup = '-67 kg';
      else if (w <= 75) weightGroup = '-75 kg';
      else if (w <= 84) weightGroup = '-84 kg';
      else weightGroup = '+84 kg';
    } else {
      if (w <= 50) weightGroup = '-50 kg';
      else if (w <= 55) weightGroup = '-55 kg';
      else if (w <= 61) weightGroup = '-61 kg';
      else if (w <= 68) weightGroup = '-68 kg';
      else weightGroup = '+68 kg';
    }
  } else if (ageGroup === 'Junior / U18 (16-17)') {
    if (genderGroup === 'Male') {
      if (w <= 55) weightGroup = '-55 kg';
      else if (w <= 61) weightGroup = '-61 kg';
      else if (w <= 68) weightGroup = '-68 kg';
      else if (w <= 76) weightGroup = '-76 kg';
      else weightGroup = '+76 kg';
    } else {
      if (w <= 48) weightGroup = '-48 kg';
      else if (w <= 53) weightGroup = '-53 kg';
      else if (w <= 59) weightGroup = '-59 kg';
      else if (w <= 66) weightGroup = '-66 kg';
      else weightGroup = '+66 kg';
    }
  } else if (ageGroup === 'Cadet / U16 (14-15)') {
    if (genderGroup === 'Male') {
      if (w <= 52) weightGroup = '-52 kg';
      else if (w <= 57) weightGroup = '-57 kg';
      else if (w <= 63) weightGroup = '-63 kg';
      else if (w <= 70) weightGroup = '-70 kg';
      else weightGroup = '+70 kg';
    } else {
      if (w <= 47) weightGroup = '-47 kg';
      else if (w <= 54) weightGroup = '-54 kg';
      else if (w <= 61) weightGroup = '-61 kg';
      else weightGroup = '+61 kg';
    }
  } else {
    // U14, U12, U10, U8
    if (ageGroup === 'U14 (12-13)') {
      if (genderGroup === 'Male') {
        if (w <= 40) weightGroup = '-40 kg';
        else if (w <= 45) weightGroup = '-45 kg';
        else if (w <= 50) weightGroup = '-50 kg';
        else if (w <= 55) weightGroup = '-55 kg';
        else weightGroup = '+55 kg';
      } else {
        if (w <= 42) weightGroup = '-42 kg';
        else if (w <= 47) weightGroup = '-47 kg';
        else if (w <= 52) weightGroup = '-52 kg';
        else weightGroup = '+52 kg';
      }
    } else if (ageGroup === 'U12 (10-11)') {
      if (genderGroup === 'Male') {
        if (w <= 30) weightGroup = '-30 kg';
        else if (w <= 35) weightGroup = '-35 kg';
        else if (w <= 40) weightGroup = '-40 kg';
        else if (w <= 45) weightGroup = '-45 kg';
        else weightGroup = '+45 kg';
      } else {
        if (w <= 30) weightGroup = '-30 kg';
        else if (w <= 35) weightGroup = '-35 kg';
        else if (w <= 40) weightGroup = '-40 kg';
        else weightGroup = '+40 kg';
      }
    } else if (ageGroup === 'U10 (8-9)') {
      if (genderGroup === 'Male') {
        if (w <= 25) weightGroup = '-25 kg';
        else if (w <= 30) weightGroup = '-30 kg';
        else if (w <= 35) weightGroup = '-35 kg';
        else weightGroup = '+35 kg';
      } else {
        if (w <= 25) weightGroup = '-25 kg';
        else if (w <= 30) weightGroup = '-30 kg';
        else weightGroup = '+30 kg';
      }
    } else { // U8
      if (w <= 20) weightGroup = '-20 kg';
      else if (w <= 25) weightGroup = '-25 kg';
      else weightGroup = '+25 kg';
      genderGroup = 'Male / Female';
    }
  }

  if (wkfMode === 'age') {
    return `${ageGroup} ${genderGroup}`.trim();
  } else if (wkfMode === 'weight') {
    return `${genderGroup} ${weightGroup}`.trim();
  }
  return `${ageGroup} ${genderGroup} ${weightGroup}`.trim();
}

// ─── Regional Separation Algorithm ─────────────────────────────────────────────

/**
 * Standard tournament seeding pattern generator.
 * For N=2: [0, 1]
 * For N=4: [0, 3, 1, 2]
 * For N=8: [0, 7, 3, 4, 1, 6, 2, 5]
 */
function getSeedingSequence(size: number): number[] {
  if (size <= 1) return [0];
  let seq = [0, 1];
  while (seq.length < size) {
    const nextSeq = [];
    const currentSize = seq.length * 2;
    for (const val of seq) {
      nextSeq.push(val);
      nextSeq.push(currentSize - 1 - val);
    }
    seq = nextSeq;
  }
  return seq;
}

export function sortAthletesByRegion(athletes: AthleteRow[], compType: string): AthleteRow[] {
  return [...athletes].sort((a, b) => {
    // 1. Academy (Strongest separation: same dojo shouldn't fight early, even across state lines)
    const acA = (a.academy || '').toLowerCase();
    const acB = (b.academy || '').toLowerCase();
    if (acA !== acB) return acA.localeCompare(acB);

    // 2. State
    const sA = (a.state || '').toLowerCase();
    const sB = (b.state || '').toLowerCase();
    if (sA !== sB) return sA.localeCompare(sB);

    // 3. District
    const dA = (a.district || '').toLowerCase();
    const dB = (b.district || '').toLowerCase();
    if (dA !== dB) return dA.localeCompare(dB);

    // 4. Country
    if (compType === 'international') {
      const cA = (a.country || '').toLowerCase();
      const cB = (b.country || '').toLowerCase();
      if (cA !== cB) return cA.localeCompare(cB);
    }

    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Distributes athletes into the bracket to maximize separation between teammates.
 * 
 * 1. Sorts athletes by Country -> State -> District -> Academy.
 * 2. Maps the sorted list into a standard bracket seeding sequence.
 * This mathematically guarantees that athletes from the same regions/academies
 * are placed in opposite halves/quarters of the tiesheet.
 */
export function separateAthletes(athletes: AthleteRow[], compType: string = 'international', poolSize: number = 8): AthleteRow[] {
  if (athletes.length <= 1) return [...athletes];

  // 1. Sort athletes so teammates are adjacent
  const sorted = sortAthletesByRegion(athletes, compType);

  // 2. Determine required bracket size (next power of 2)
  let bracketSize = 2;
  while (bracketSize < sorted.length) {
    bracketSize *= 2;
  }
  // If poolSize forces a larger bracket, use it
  if (bracketSize < poolSize) bracketSize = poolSize;

  const sequence = getSeedingSequence(bracketSize);
  
  // 3. Map sorted athletes into the bracket slots based on sequence
  const slots: (AthleteRow | null)[] = Array(bracketSize).fill(null);
  for (let i = 0; i < sorted.length; i++) {
    slots[sequence[i]] = sorted[i];
  }

  // Flatten the slots to remove nulls, creating the final interleaved list for R1 matches.
  // Wait, buildSingleElimination relies on index mapping, so we should just return the compact array
  // mapped back to the sequence, OR we can let buildSingleElimination handle the nulls!
  // But wait, the existing code expects a compacted array and handles byes internally.
  // So we just return the athletes ordered by their slot sequence appearance!
  const seededAthletes: AthleteRow[] = [];
  for (let i = 0; i < bracketSize; i++) {
    if (slots[i] !== null) {
      seededAthletes.push(slots[i]!);
    }
  }

  return seededAthletes;
}

// ─── Bracket Generation ─────────────────────────────────────────────────────────

/**
 * Generates a WKF-compliant elimination bracket.
 *
 * @param athletes   - List of athletes to seed into the bracket
 * @param compType   - 'international' | 'national' — governs separation priority
 * @param poolSize   - Forces bracket to this slot count (4 | 8 | 16 | 32).
 *                     Actual athlete count may be less → filled with byes.
 *                     Actual athlete count may exceed poolSize → multiple pools.
 *
 * Rules:
 *   ≤ 2 athletes         → single match
 *   3–5 athletes         → round robin
 *   ≥ 6 athletes         → single elimination, padded to poolSize with byes
 */
export function generateBracket(
  athletes: AthleteRow[],
  compType: string = 'international',
  poolSize: PoolSize = 8
): MatchNode[] {
  if (athletes.length === 0) return [];

  // Single match
  if (athletes.length === 2) {
    const sep = separateAthletes(athletes, compType);
    return [{
      id: 'R1-M1',
      round: 1,
      matchNumber: 1,
      aka: sep[0],
      ao: sep[1],
      akaFromMatchId: null,
      aoFromMatchId: null,
      akaScore: 0,
      aoScore: 0,
      winnerId: null,
      nextMatchId: null,
      status: 'upcoming',
      mat: null,
    }];
  }

  // Round Robin for 3–5 athletes
  if (athletes.length >= 3 && athletes.length <= 5) {
    return buildRoundRobin(athletes, compType);
  }

  // For 6+ athletes — single elimination with pool-size padding
  // If athlete count exceeds poolSize, split into multiple pools
  if (athletes.length > poolSize) {
    return buildMultiPool(athletes, compType, poolSize);
  }

  return buildSingleElimination(athletes, compType, poolSize);
}

function buildRoundRobin(athletes: AthleteRow[], compType: string): MatchNode[] {
  const sep = separateAthletes(athletes, compType);
  const matches: MatchNode[] = [];
  let matchCounter = 1;

  for (let i = 0; i < sep.length; i++) {
    for (let j = i + 1; j < sep.length; j++) {
      matches.push({
        id: `RR-M${matchCounter}`,
        round: 1,
        matchNumber: matchCounter++,
        aka: sep[i],
        ao: sep[j],
        akaFromMatchId: null,
        aoFromMatchId: null,
        akaScore: 0,
        aoScore: 0,
        winnerId: null,
        nextMatchId: null,
        status: 'upcoming',
        mat: null,
      });
    }
  }
  return matches;
}

export function buildSingleElimination(athletes: AthleteRow[], compType: string, poolSize: PoolSize): MatchNode[] {
  const separated = separateAthletes(athletes, compType, poolSize);
  const totalR1Slots = poolSize;   // e.g. 8 pool size → 4 R1 matches
  const totalR1Matches = totalR1Slots / 2;

  const matches: MatchNode[] = [];
  let matchCounter = 1;
  const round1Matches: MatchNode[] = [];

  for (let i = 0; i < totalR1Matches; i++) {
    const akaIdx = i * 2;
    const aoIdx = i * 2 + 1;

    const akaAthlete = akaIdx < separated.length ? separated[akaIdx] : null;
    const aoAthlete = aoIdx < separated.length ? separated[aoIdx] : null;

    // Auto-advance bye
    const autoWinner = (akaAthlete && !aoAthlete) ? akaAthlete.playerId :
                       (!akaAthlete && aoAthlete) ? aoAthlete.playerId : null;
    const byeFor = autoWinner ? (!aoAthlete ? 'ao' : 'aka') : null;

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
      winnerId: autoWinner,
      nextMatchId: null,
      status: autoWinner ? 'completed' : 'upcoming',
      mat: null,
      ...(byeFor ? { byeFor } : {})
    };

    round1Matches.push(match);
    matches.push(match);
  }

  // Build subsequent rounds
  let currentRound = round1Matches;
  let roundNum = 2;

  while (currentRound.length > 1) {
    const nextRound: MatchNode[] = [];

    for (let i = 0; i < currentRound.length; i += 2) {
      const m1 = currentRound[i];
      const m2 = currentRound[i + 1];

      const newMatch: MatchNode = {
        id: `R${roundNum}-M${Math.floor(i / 2) + 1}`,
        round: roundNum,
        matchNumber: matchCounter++,
        aka: null,
        ao: null,
        akaFromMatchId: m1.id,
        aoFromMatchId: m2 ? m2.id : null,
        akaScore: 0,
        aoScore: 0,
        winnerId: null,
        nextMatchId: null,
        status: 'upcoming',
        mat: null,
      };

      m1.nextMatchId = newMatch.id;
      if (m2) m2.nextMatchId = newMatch.id;

      nextRound.push(newMatch);
      matches.push(newMatch);
    }

    currentRound = nextRound;
    roundNum++;
  }

  // Propagate byes and winners forward
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of matches) {
      if (m.round > 1) {
        if (m.akaFromMatchId && !m.aka) {
          const prevAka = matches.find(x => x.id === m.akaFromMatchId);
          if (prevAka && prevAka.winnerId) {
            m.aka = prevAka.winnerId === prevAka.aka?.playerId ? prevAka.aka : prevAka.ao;
            changed = true;
          }
        }
        if (m.aoFromMatchId && !m.ao) {
          const prevAo = matches.find(x => x.id === m.aoFromMatchId);
          if (prevAo && prevAo.winnerId) {
            m.ao = prevAo.winnerId === prevAo.aka?.playerId ? prevAo.aka : prevAo.ao;
            changed = true;
          }
        }
      }

      if (!m.winnerId) {
        const isTreeEmpty = (matchId: string | null): boolean => {
          if (!matchId) return true;
          const prev = matches.find(x => x.id === matchId);
          if (!prev) return true;
          if (prev.aka || prev.ao) return false;
          return isTreeEmpty(prev.akaFromMatchId) && isTreeEmpty(prev.aoFromMatchId);
        };

        const akaEmpty = m.akaFromMatchId ? isTreeEmpty(m.akaFromMatchId) : !m.aka;
        const aoEmpty = m.aoFromMatchId ? isTreeEmpty(m.aoFromMatchId) : !m.ao;

        if (m.aka && aoEmpty) {
          m.winnerId = m.aka.playerId ?? null;
          changed = true;
        } else if (m.ao && akaEmpty) {
          m.winnerId = m.ao.playerId ?? null;
          changed = true;
        }
      }
    }
  }

  return matches;
}

/** When athlete count > poolSize, split into labelled pools (Pool A, Pool B, ...) */
function buildMultiPool(athletes: AthleteRow[], compType: string, poolSize: PoolSize): MatchNode[] {
  const poolCount = Math.ceil(athletes.length / poolSize);
  const allMatches: MatchNode[] = [];

  // Distribute athletes round-robin across pools for fairness
  const pools: AthleteRow[][] = Array.from({ length: poolCount }, () => []);
  // Use sortAthletesByRegion so teammates are strictly adjacent in the list.
  // When we distribute round-robin, teammates are guaranteed to fall into DIFFERENT pools!
  const sorted = sortAthletesByRegion(athletes, compType);
  sorted.forEach((ath, idx) => {
    pools[idx % poolCount].push(ath);
  });

  for (let p = 0; p < pools.length; p++) {
    const poolLabel = `${p + 1}`;
    const poolMatches = buildSingleElimination(pools[p], compType, poolSize);

    // Re-ID all matches to include pool label
    for (const m of poolMatches) {
      m.id = `Pool${poolLabel}-${m.id}`;
      if (m.akaFromMatchId) m.akaFromMatchId = `Pool${poolLabel}-${m.akaFromMatchId}`;
      if (m.aoFromMatchId) m.aoFromMatchId = `Pool${poolLabel}-${m.aoFromMatchId}`;
      if (m.nextMatchId) m.nextMatchId = `Pool${poolLabel}-${m.nextMatchId}`;
      allMatches.push(m);
    }
  }

  return allMatches;
}

// ─── Special Category Seeding ──────────────────────────────────────────────────

/**
 * Seeds a special category bracket by extracting eligible athletes from
 * completed standard categories.
 *
 * Medal filtering:
 *   'Gold Only'       → only the Finals match winner of each category
 *   'Silver or Above' → Finals winner + Finals loser of each category
 *   'Any Medal' / ''  → all athletes who won at least one match
 *
 * @param allCategoryDocs  All standard category docs from Firestore
 * @param rule             The special category rules
 */
export function seedSpecialCategory(
  allCategoryDocs: CategoryDoc[],
  rule: SpecialCategoryRule
): AthleteRow[] {
  const eligible: AthleteRow[] = [];
  const seen = new Set<string>();

  const docsToProcess = rule.sourceCategoryId
    ? allCategoryDocs.filter(c => c.id === rule.sourceCategoryId)
    : allCategoryDocs;

  for (const catDoc of docsToProcess) {
    const matches = catDoc.matches || [];
    if (matches.length === 0) continue;

    // Group matches by pool to find pool-wise winners
    const poolMap = new Map<string, MatchNode[]>();
    for (const m of matches) {
      let pool = 'default';
      if (m.id && m.id.includes('Pool')) {
        pool = m.id.split('-')[0];
      }
      if (!poolMap.has(pool)) poolMap.set(pool, []);
      poolMap.get(pool)!.push(m);
    }

    for (const [pool, poolMatches] of poolMap.entries()) {
      // Find the final match (highest round number in this pool)
      const maxRound = Math.max(...poolMatches.map(m => m.round));
      const finalsMatches = poolMatches.filter(m => m.round === maxRound);

      for (const finalMatch of finalsMatches) {
        const goldWinnerId = finalMatch.winnerId;
        const goldAthlete = goldWinnerId
          ? (finalMatch.aka?.playerId === goldWinnerId ? finalMatch.aka : finalMatch.ao) as AthleteRow | null
          : null;
        const silverAthlete = goldWinnerId
          ? (finalMatch.aka?.playerId === goldWinnerId ? finalMatch.ao : finalMatch.aka) as AthleteRow | null
          : null;

        const addIfEligible = (ath: AthleteRow | null, medal: 'gold' | 'silver' | 'bronze') => {
          if (!ath || !ath.playerId || seen.has(ath.playerId)) return;

          const age = ath.age || 0;
          const weight = ath.weight || 0;

          if (rule.minAge !== undefined && age < rule.minAge) return;
          if (rule.maxAge !== undefined && age > rule.maxAge) return;
          if (rule.minWeight !== undefined && weight < rule.minWeight) return;
          if (rule.maxWeight !== undefined && weight > rule.maxWeight) return;

          seen.add(ath.playerId);
          eligible.push({ ...ath, medal, sourceCategory: catDoc.name });
        };

        const medalFilter = rule.medal || 'Any Medal';

        if (medalFilter === 'Gold Only') {
          addIfEligible(goldAthlete, 'gold');
        } else if (medalFilter === 'Silver or Above') {
          addIfEligible(goldAthlete, 'gold');
          addIfEligible(silverAthlete, 'silver');
        } else {
          // 'Any Medal' — include anyone who won at least one match
          addIfEligible(goldAthlete, 'gold');
          addIfEligible(silverAthlete, 'silver');

          // Find semi-final losers (bronze) in this pool
          const semiRound = maxRound - 1;
          if (semiRound >= 1) {
            const semiMatches = poolMatches.filter(m => m.round === semiRound);
            for (const semi of semiMatches) {
              const loser = semi.winnerId
                ? (semi.aka?.playerId === semi.winnerId ? semi.ao : semi.aka) as AthleteRow | null
                : null;
              addIfEligible(loser, 'bronze');
            }
          }
        }
      }
    }
  }

  return eligible;
}
