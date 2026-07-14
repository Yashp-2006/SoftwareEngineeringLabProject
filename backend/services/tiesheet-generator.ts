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
  sourceCategoryIds?: string[];
  medal?: string;
  medals?: string[];
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

/** Number of rows processed per JS-array slice. Keeps per-iteration work bounded. */
const PARSE_PAGE_SIZE = 500;

/**
 * Parses an Excel/CSV file and returns a flat list of athletes.
 * Reads all sheets. The raw row array is processed in PARSE_PAGE_SIZE slices
 * so each iteration stays bounded — avoids a single massive loop tick.
 * Athletes are returned sorted A-Z by name.
 */
export function parseExcel(buffer: ArrayBuffer): AthleteRow[] {
  const dataArray = new Uint8Array(buffer);
  const workbook = xlsx.read(dataArray, { type: 'array' });
  let allRows: any[] = [];

  // Read all sheets (some tournaments export one sheet per category)
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Read all rows for this sheet at once (xlsx.read is fast; sharding is at the JS array level)
    const rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
    allRows = allRows.concat(rows);
  }

  return normalizeAthleteRows(allRows);
}

/**
 * Normalizes raw JSON rows into structured AthleteRow objects.
 */
export function normalizeAthleteRows(rawData: any[]): AthleteRow[] {
  const allAthletes: AthleteRow[] = [];

  // Slice into PARSE_PAGE_SIZE pages so no single iteration processes thousands of rows
  for (let pageStart = 0; pageStart < rawData.length; pageStart += PARSE_PAGE_SIZE) {
    const pageRows = rawData.slice(pageStart, pageStart + PARSE_PAGE_SIZE);

    for (const rawRow of pageRows) {
      const row: any = {};
      for (const key in rawRow) {
        row[key.trim().toLowerCase()] = rawRow[key];
      }
      
      // Weight: try multiple header variants and fuzzy matching
      let rawWeight: any = 0;
      for (const k of Object.keys(row)) {
        if (k === 'weight' || k === 'weight (kg)' || k === 'weight(kg)' || k === 'weight (kgs)' ||
            k === 'weight(kgs)' || k === 'body weight' || k === 'wt' || k === 'wt (kg)' ||
            k === 'wt(kg)' || k === 'weight in kg' || k === 'weight kg') {
          rawWeight = row[k];
          break;
        }
      }
      // Fallback: any column containing "weight" that isn't min/max weight
      if (rawWeight === 0) {
        for (const k of Object.keys(row)) {
          if (k.includes('weight') && !k.includes('min') && !k.includes('max') && !k.includes('category')) {
            rawWeight = row[k];
            break;
          }
        }
      }
      
      let parsedName = '';
      let parsedAcademy = '';
      let parsedFirst = '';
      let parsedLast = '';
      let coachName = '';
      let phone = '';
      let email = '';

      // Pass 1: Name and Academy detection
      for (const k of Object.keys(row)) {
        if (!parsedAcademy && (k.includes('academy') || k.includes('club') || k.includes('team') || k.includes('dojo') || k.includes('school') || k.includes('organization') || k.includes('organisation') || k.includes('association') || k.includes('dojo/organization') || k.includes('institution') || k.includes('gym') || k.includes('federation') || k.includes('group') || k.includes('society') || k.includes('centre') || k.includes('center') || k.includes('sports body') || k === 'unit') && !k.includes('id')) {
          parsedAcademy = String(row[k]);
        }
        if (k.includes('first name') || k === 'first') {
          parsedFirst = String(row[k]);
        } else if (k.includes('last name') || k === 'last' || k === 'surname') {
          parsedLast = String(row[k]);
        } else if (!parsedName && (k.includes('name') || k.includes('athlete') || k.includes('player') || k.includes('participant') || k.includes('competitor'))) {
          if (!k.includes('coach') && !k.includes('instructor')) {
            parsedName = String(row[k]);
          }
        }
      }

      // Pass 2: Coach name (independent pass — avoids being swallowed by phone/email)
      for (const k of Object.keys(row)) {
        if (!coachName && (k.includes('coach') || k.includes('instructor') || k.includes('sensei') || k.includes('trainer'))) {
          coachName = String(row[k]);
          break;
        }
      }

      // Pass 3: Phone number (independent pass — broader matching)
      for (const k of Object.keys(row)) {
        if (!phone && (k.includes('phone') || k.includes('mobile') || k.includes('cell') || k.includes('telephone') || k.includes('tel no') || k === 'tel' || k.includes('contact no') || k.includes('contact number') || k === 'number' || k === 'no' || k.includes('whatsapp'))) {
          // Skip columns that are clearly not phone numbers (e.g. "contact person", "contact name")
          if (k.includes('person') || k.includes('name') || k.includes('email') || k.includes('address')) continue;
          // Phone numbers may be stored as numbers in Excel — avoid scientific notation
          const rawPhone = row[k];
          phone = (typeof rawPhone === 'number') ? rawPhone.toFixed(0) : String(rawPhone).trim();
          break;
        }
      }
      // Fallback: any column containing 'contact' that isn't name/person/email
      if (!phone) {
        for (const k of Object.keys(row)) {
          if (k.includes('contact') && !k.includes('person') && !k.includes('name') && !k.includes('email') && !k.includes('address')) {
            const rawPhone2 = row[k];
            phone = (typeof rawPhone2 === 'number') ? rawPhone2.toFixed(0) : String(rawPhone2).trim();
            break;
          }
        }
      }

      // Pass 4: Email (independent pass)
      for (const k of Object.keys(row)) {
        if (!email && (k.includes('email') || k.includes('e-mail') || k === 'mail' || k.includes('email id') || k.includes('email address'))) {
          email = String(row[k]);
          break;
        }
      }

      if (!parsedName && (parsedFirst || parsedLast)) {
        parsedName = `${parsedFirst} ${parsedLast}`.trim();
      }
      
      parsedName = parsedName.trim() || 'Unknown';
      if (parsedName.toUpperCase() === 'BYE') continue; // Skip explicit BYE rows to let generator handle empty slots
      parsedAcademy = parsedAcademy.trim() || 'Unknown';

      let parsedAge = parseInt(String(row['age'] ?? ''), 10);
      if (isNaN(parsedAge) || !row['age']) {
        let dobVal: any = null;
        for (const k of Object.keys(row)) {
          if (k.includes('dob') || k.includes('date of birth') || k.includes('birth date') || k.includes('birth') || k.includes('born') || k === 'yob' || k.includes('year of birth') || k.includes('birth year')) {
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
            const strVal = String(dobVal).trim();
            const parts = strVal.split(/[-/\s]+/);
            if (parts.length === 3) {
              const p1 = Number(parts[0]);
              const p3 = Number(parts[2]);
              
              let year = -1;
              if (p1 > 1900) year = p1; // YYYY-MM-DD
              else if (p3 > 1900) year = p3; // DD-MM-YYYY or MM/DD/YYYY
              
              if (year > 1900 && year <= new Date().getFullYear()) {
                parsedAge = new Date().getFullYear() - year;
              }
            }
            
            if (isNaN(parsedAge)) {
              const d = new Date(strVal);
              if (!isNaN(d.getTime())) {
                parsedAge = new Date().getFullYear() - d.getFullYear(); // Parsable date string fallback
              }
            }
          }
        }
      }
      parsedAge = isNaN(parsedAge) ? 18 : parsedAge; // fallback

      const events: string[] = [];
      const splitEventVal = (v: string): string[] =>
        v.split(/[,;&|/\\]+|\band\b|\bor\b/i)
          .map(p => p.trim())
          .filter(p => p.length > 0);

      for (const k of Object.keys(row)) {
        if (!k) continue;
        const lowerK = k.toLowerCase().trim();
        const val = String(row[k]).toLowerCase().trim();
        if (!val || val === 'no' || val === 'n' || val === 'false' || val === '0') continue;

        if (val === 'yes' || val === 'y' || val === 'true' || val === '1' || val === 'x' || val === 'checked') {
          const colParts = splitEventVal(lowerK);
          if (colParts.length > 1) {
            events.push(...colParts);
          } else {
            events.push(lowerK);
          }
        } else if (['events', 'event', 'category', 'categories', 'participating events', 'discipline', 'disciplines', 'competition', 'competing in'].includes(lowerK)) {
          if (val === 'both') {
            events.push('kata', 'kumite');
          } else {
            events.push(...splitEventVal(val));
          }
        } else if (lowerK.includes('kata') || lowerK.includes('kumite')) {
          const colParts = splitEventVal(lowerK);
          events.push(...colParts);
          const valParts = splitEventVal(val);
          events.push(...valParts);
        }
      }

      // Gender: try direct keys first, then fuzzy loop for headers like 'm/f', 'male/female', 'gender/sex'
      let parsedGender = '';
      if (row['gender']) parsedGender = String(row['gender']).trim().toLowerCase();
      else if (row['sex']) parsedGender = String(row['sex']).trim().toLowerCase();
      else {
        for (const k of Object.keys(row)) {
          if (k === 'm/f' || k === 'male/female' || k === 'gender/sex' || k === 'm / f' || k.startsWith('gender') || k.startsWith('sex')) {
            parsedGender = String(row[k]).trim().toLowerCase();
            break;
          }
        }
      }
      if (parsedGender === 'm' || parsedGender === 'male' || parsedGender === 'boy' || parsedGender === 'man') parsedGender = 'male';
      else if (parsedGender === 'f' || parsedGender === 'female' || parsedGender === 'girl' || parsedGender === 'woman' || parsedGender === 'w') parsedGender = 'female';
      if (!parsedGender) parsedGender = 'male'; // fallback

      allAthletes.push({
        playerId: String(row['player id'] ?? row['playerid'] ?? row['id'] ?? row['athlete id'] ?? '').trim() ||
          `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: parsedName,
        gender: parsedGender,
        weight: parseFloat(String(rawWeight).replace(/\s*(kg|kgs|lbs?|kilos?)\s*/gi, '').trim()) || 0,
        age: parsedAge,
        country: String(row['country'] || row['nation'] || row['nationality'] || ''),
        state: String(row['state'] || row['region'] || row['province'] || ''),
        district: String(row['district'] || row['city'] || ''),
        academy: parsedAcademy,
        interestSpecial: String(row['interest special'] || row['special interest'] || row['notes'] || ''),
        events,
        coachName: coachName ? coachName.trim() : undefined,
        phone: phone || undefined,
        email: email ? email.trim() : undefined
      });
    }
  }

  allAthletes.sort((a, b) => a.name.localeCompare(b.name));
  return allAthletes;
}

/**
 * Parses an Excel file and buckets athletes into category groups.
 */
export function parseExcelIntoCategories(
  buffer: ArrayBuffer,
  specialCategories: SpecialCategoryRule[] = [],
  wkfMode: string = 'standard',
  customCategories: SpecialCategoryRule[] = []
): { categoryMap: Map<string, AthleteRow[]>, uniqueAthletesCount: number } {
  const athletes = parseExcel(buffer);
  return { ...bucketAthletes(athletes, specialCategories, wkfMode, customCategories), uniqueAthletesCount: athletes.length };
}

/**
 * Buckets an already-parsed list of AthleteRow objects into category groups.
 * Accepts pre-parsed athletes so callers don't need to re-encode to xlsx.
 */
export function bucketAthletes(
  athletes: AthleteRow[],
  specialCategories: SpecialCategoryRule[] = [],
  wkfMode: string = 'standard',
  customCategories: SpecialCategoryRule[] = []
): { categoryMap: Map<string, AthleteRow[]>, uniqueAthletesCount: number } {
  const categoryMap = new Map<string, AthleteRow[]>();

  const addToCategory = (catName: string, athlete: AthleteRow) => {
    if (!categoryMap.has(catName)) categoryMap.set(catName, []);
    categoryMap.get(catName)!.push({ ...athlete });
  };

  for (const athlete of athletes) {
    let addedToAny = false;
    const events = athlete.events || [];

    // 1. Check for registered events
    // First, normalise the events list: expand any combined tokens like "kata/kumite" into two separate entries
    const expandedEvents: string[] = [];
    for (const event of events) {
      const hasKata   = event.includes('kata');
      const hasKumite = event.includes('kumite');
      if (hasKata && hasKumite) {
        // A single token encodes both disciplines
        expandedEvents.push('kata', 'kumite');
      } else if (event === 'both') {
        expandedEvents.push('kata', 'kumite');
      } else {
        expandedEvents.push(event);
      }
    }
    // Deduplicate
    const uniqueEvents = [...new Set(expandedEvents)];

    for (const event of uniqueEvents) {
      const matchedSpecial = specialCategories.find(sc => sc.name.toLowerCase() === event);
      const matchedCustom = customCategories.find(cc => cc.name.toLowerCase() === event);
      
      if (matchedSpecial) {
        addToCategory(matchedSpecial.name, athlete);
        addedToAny = true;
      } else if (matchedCustom) {
        addToCategory(matchedCustom.name, athlete);
        addedToAny = true;
      } else if (event.includes('kata') && !event.includes('kumite')) {
        const base = determineCategory(athlete, specialCategories, 'age');
        addToCategory(`${base} Kata`, athlete);
        addedToAny = true;
      } else if (event.includes('kumite') && !event.includes('kata')) {
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
          if (c.maxAge !== undefined && athlete.age >= c.maxAge) return false;
          if (c.minWeight !== undefined && athlete.weight < c.minWeight) return false;
          if (c.maxWeight !== undefined && athlete.weight >= c.maxWeight) return false;
          return true;
        });
        if (match) {
          addToCategory(match.name, athlete);
        } else {
          addToCategory('Uncategorized', athlete);
        }
      } else {
        // Automatically enroll in both Kumite and Kata if no events were explicitly specified
        addToCategory(determineCategory(athlete, specialCategories, wkfMode), athlete);
        const baseKata = determineCategory(athlete, specialCategories, 'age');
        addToCategory(`${baseKata} Kata`, athlete);
      }
    }
  }

  // Sort each category's athletes A-Z by name
  for (const athletes of categoryMap.values()) {
    athletes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { categoryMap, uniqueAthletesCount: athletes.length };
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
export function separateAthletes(
  athletes: AthleteRow[], 
  compType: string = 'international', 
  poolSize: number = 8,
  padToBracketSize: boolean = false
): (AthleteRow | null)[] {
  if (athletes.length <= 1) return padToBracketSize ? [athletes[0] || null, null] : [...athletes];

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
  if (padToBracketSize) {
    return slots;
  }

  // Flatten the slots to remove nulls, creating the final interleaved list for R1 matches.
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
  poolSize: PoolSize = 8,
  options?: { useRoundRobin?: boolean }
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

  // Round Robin for exactly 3 athletes ONLY if explicitly allowed
  if (athletes.length === 3 && options?.useRoundRobin) {
    return buildRoundRobin(athletes, compType);
  }

  // If we have more athletes than poolSize, we split into labeled pools (e.g. Pool 1, Pool 2)
  if (athletes.length > poolSize) {
    return buildMultiPool(athletes, compType, poolSize, options);
  }

  // Determine the next power of 2 for single elimination
  let targetPoolSize = poolSize;
  while (targetPoolSize < athletes.length) {
    targetPoolSize *= 2;
  }

  // We no longer build multi-pools automatically just because it exceeds the requested poolSize.
  // Instead, we just pad to the target power of 2 to keep everyone in a single elimination bracket.
  // We explicitly use targetPoolSize to prevent multi-pool fragmentation.
  return buildSingleElimination(athletes, compType, targetPoolSize as PoolSize);
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
  const separated = separateAthletes(athletes, compType, poolSize, true);
  const totalR1Slots = Math.max(poolSize, separated.length);   // e.g. 8 pool size → 4 R1 matches
  const totalR1Matches = totalR1Slots / 2;

  const matches: MatchNode[] = [];
  let matchCounter = 1;
  const round1Matches: MatchNode[] = [];

  for (let i = 0; i < totalR1Matches; i++) {
    const akaIdx = i * 2;
    const aoIdx = i * 2 + 1;

    const akaAthlete = akaIdx < separated.length ? separated[akaIdx] : null;
    const aoAthlete = aoIdx < separated.length ? separated[aoIdx] : null;

    // Skip ghost matches — if BOTH slots are empty, no match should exist.
    // This happens when athlete count << poolSize (e.g. 6 athletes in pool of 16).
    if (!akaAthlete && !aoAthlete) continue;

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

  // Edge case: only 1 R1 match was generated (e.g. 1-2 athletes in a large pool)
  // — it is already the final, no further rounds needed.
  if (round1Matches.length <= 1) {
    propagateByesAndWinners(matches);
    return matches;
  }

  // Build subsequent rounds
  let currentRound = round1Matches;
  let roundNum = 2;

  while (currentRound.length > 1) {
    const nextRound: MatchNode[] = [];

    for (let i = 0; i < currentRound.length; i += 2) {
      const m1 = currentRound[i];
      const m2 = currentRound[i + 1]; // undefined when currentRound.length is odd

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
  propagateByesAndWinners(matches);

  return matches;
}

/** When athlete count > poolSize, split into labelled pools.
 * Pools are filled SEQUENTIALLY — Pool 1 is filled to capacity first,
 * then Pool 2 gets the remainder. This avoids thin pools with many ghost slots.
 */
function buildMultiPool(athletes: AthleteRow[], compType: string, poolSize: PoolSize, options?: { useRoundRobin?: boolean }): MatchNode[] {
  const allMatches: MatchNode[] = [];

  // ── Step 1: Sort by region so teammates end up adjacent ──────────────────
  const sorted = sortAthletesByRegion(athletes, compType);

  // ── Step 2: Interleaved (round-robin) distribution ───────────────────────
  // athlete[0] → pool 0, athlete[1] → pool 1, ... , athlete[N] → pool 0
  // This keeps pool sizes as equal as possible and spreads same-region
  // athletes evenly — they're never both clumped in the same pool.
  const poolCount = Math.ceil(athletes.length / poolSize);
  const pools: AthleteRow[][] = Array.from({ length: poolCount }, () => []);
  sorted.forEach((ath, idx) => pools[idx % poolCount].push(ath));

  // ── Step 3: Merge under-2 pools (prevents BYE-only athletes) ─────────────
  // A pool with 0 or 1 athlete cannot generate a real match.
  // Merge those athletes into the nearest pool that still has room.
  // We iterate repeatedly until no singleton pools remain.
  let changed = true;
  while (changed) {
    changed = false;
    for (let p = pools.length - 1; p >= 0; p--) {
      if (pools[p].length <= 1) {
        changed = true;
        const overflow = pools.splice(p, 1)[0]; // remove this pool
        if (overflow.length === 1) {
          // Donate the lone athlete to the largest remaining pool.
          // They will then have enough partners for real matches.
          let largestIdx = 0;
          for (let q = 1; q < pools.length; q++) {
            if (pools[q].length > pools[largestIdx].length) largestIdx = q;
          }
          if (pools.length > 0) pools[largestIdx].push(...overflow);
          // else: only 1 pool left — this athlete joins the only pool
        }
        break; // restart scan since indices shifted
      }
    }
  }

  // ── Step 4: Build matches per pool ───────────────────────────────────────
  // Use the most appropriate generator for each pool's actual size:
  //   2 athletes          → direct match
  //   3–5 athletes        → round robin (everyone faces everyone once)
  //   ≥6 athletes         → single elimination (padded to poolSize with byes)
  for (let p = 0; p < pools.length; p++) {
    const pool = pools[p];
    if (pool.length === 0) continue;

    const poolLabel = `${p + 1}`;
    let poolMatches: MatchNode[];

    if (pool.length === 2) {
      const sep = separateAthletes(pool, compType);
      poolMatches = [{
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
    } else if (pool.length <= 5 && options?.useRoundRobin) {
      poolMatches = buildRoundRobin(pool, compType);
    } else {
      poolMatches = buildSingleElimination(pool, compType, poolSize);
    }

    // Re-ID all matches to include pool label
    for (const m of poolMatches) {
      m.id = `Pool${poolLabel}-${m.id}`;
      if (m.akaFromMatchId) m.akaFromMatchId = `Pool${poolLabel}-${m.akaFromMatchId}`;
      if (m.aoFromMatchId)  m.aoFromMatchId  = `Pool${poolLabel}-${m.aoFromMatchId}`;
      if (m.nextMatchId)    m.nextMatchId    = `Pool${poolLabel}-${m.nextMatchId}`;
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

  const docsToProcess = rule.sourceCategoryIds && rule.sourceCategoryIds.length > 0
    ? allCategoryDocs.filter(c => rule.sourceCategoryIds!.includes(c.id))
    : rule.sourceCategoryId
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

        const medalsArray = rule.medals || [];
        const medalFilter = rule.medal || (medalsArray.length === 0 ? 'Any Medal' : null);

        const includeGold = medalsArray.includes('Gold') || medalFilter === 'Gold' || medalFilter === 'Gold Only' || medalFilter === 'Silver or Above' || medalFilter === 'Any Medal';
        const includeSilver = medalsArray.includes('Silver') || medalFilter === 'Silver' || medalFilter === 'Silver or Above' || medalFilter === 'Any Medal';
        const includeBronze = medalsArray.includes('Bronze') || medalFilter === 'Bronze' || medalFilter === 'Any Medal';

        if (includeGold) {
          addIfEligible(goldAthlete, 'gold');
        }
        if (includeSilver) {
          addIfEligible(silverAthlete, 'silver');
        }
        if (includeBronze) {
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

export function propagateByesAndWinners(matches: MatchNode[]): void {
  const matchMap = new Map<string, MatchNode>();
  for (const m of matches) {
    matchMap.set(m.id, m);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of matches) {
      if (m.round > 1) {
        if (m.akaFromMatchId && !m.aka) {
          const prevAka = matchMap.get(m.akaFromMatchId);
          if (prevAka && prevAka.winnerId) {
            const winner = String(prevAka.winnerId);
            const akaId = prevAka.aka ? String(prevAka.aka.playerId) : '';
            const aoId = prevAka.ao ? String(prevAka.ao.playerId) : '';
            if (winner === akaId && prevAka.aka) {
              m.aka = prevAka.aka;
              changed = true;
            } else if (winner === aoId && prevAka.ao) {
              m.aka = prevAka.ao;
              changed = true;
            }
          }
        }
        if (m.aoFromMatchId && !m.ao) {
          const prevAo = matchMap.get(m.aoFromMatchId);
          if (prevAo && prevAo.winnerId) {
            const winner = String(prevAo.winnerId);
            const akaId = prevAo.aka ? String(prevAo.aka.playerId) : '';
            const aoId = prevAo.ao ? String(prevAo.ao.playerId) : '';
            if (winner === akaId && prevAo.aka) {
              m.ao = prevAo.aka;
              changed = true;
            } else if (winner === aoId && prevAo.ao) {
              m.ao = prevAo.ao;
              changed = true;
            }
          }
        }
      }

      if (!m.winnerId && m.status !== 'completed') {
        const isTreeEmpty = (matchId: string | null): boolean => {
          if (!matchId) return true;
          const prev = matchMap.get(matchId);
          if (!prev) return true;
          if (prev.aka || prev.ao) return false;
          return isTreeEmpty(prev.akaFromMatchId) && isTreeEmpty(prev.aoFromMatchId);
        };

        const akaEmpty = m.akaFromMatchId ? isTreeEmpty(m.akaFromMatchId) : !m.aka;
        const aoEmpty = m.aoFromMatchId ? isTreeEmpty(m.aoFromMatchId) : !m.ao;

        if (m.aka && aoEmpty) {
          m.winnerId = m.aka.playerId ?? null;
          m.status = 'completed';
          (m as any).byeFor = 'ao'; // ao side is empty
          changed = true;
        } else if (m.ao && akaEmpty) {
          m.winnerId = m.ao.playerId ?? null;
          m.status = 'completed';
          (m as any).byeFor = 'aka'; // aka side is empty
          changed = true;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// KATA BRACKET GENERATION
// Gate: isKata === true on the Firestore category document.
// All code below is strictly additive — zero modifications to Kumite logic above.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Kata Types ────────────────────────────────────────────────────────────────

export interface KataMatchNode {
  matchId:           string;
  round:             number;
  /** "Round of 16" | "QF" | "SF" | "Final" | "Bronze" | "Group Stage" | "Repechage" */
  roundLabel:        string;
  slot:              number;       // 1-based position within the round
  groupId?:          string;       // round-robin only — e.g. "G1", "G2"
  aka:               string | null; // athleteId or teamId
  ao:                string | null;
  isMedalMatch:      boolean;
  isBronze:          boolean;
  requiresBunkai:    boolean;      // true only for team medal matches
  isTieBreaker:      boolean;
  isReperformance:   boolean;
  isBye:             boolean;
  winnerAdvancesTo:  string | null; // matchId the winner feeds into
  loserAdvancesTo:   string | null; // "repechage_pool_1" | "repechage_pool_2" | matchId
  result?: {
    winner: 'aka' | 'ao';
    votes:  { aka: number; ao: number };
  };
}

export interface KataCategoryConfig {
  kataFormat:      'elimination' | 'round-robin' | 'two-pool';
  numberOfJudges:  number;
  allowedKataList: number[];   // kata numbers from KATA_LIST
  isTeam?:         boolean;
  isU14?:          boolean;
  seeds?:          string[];   // athleteIds in seed order (1 = best)
}

export interface KataGroupResult {
  athleteId:     string;
  groupId:       string;
  victoryPoints: number;
  wins:          number;
  losses:        number;
  votesFor:      number;      // total judge votes won across all group bouts
  votesAgainst:  number;      // total judge votes lost across all group bouts
  netVoteDiff:   number;      // votesFor - votesAgainst
  rank:          number;      // 1 = group winner
}

// ─── WKF Group Allocation Table (Article 3.7.9) ────────────────────────────────

interface KataGroupConfig {
  numGroups:  number;
  groupSizes: number[];
}

function getWKFGroupConfig(n: number): KataGroupConfig {
  if (n <= 0) return { numGroups: 0, groupSizes: [] };
  // 1 group (2–5)
  if (n <= 5)  return { numGroups: 1, groupSizes: [n] };
  // 2 groups (6–8)
  if (n <= 8) {
    const base = Math.floor(n / 2), rem = n % 2;
    return { numGroups: 2, groupSizes: rem ? [base, base + 1] : [base, base] };
  }
  // 3 groups (9–11)
  if (n <= 11) {
    const base = Math.floor(n / 3), rem = n % 3;
    const s = [base, base, base];
    for (let i = 2; i >= 3 - rem; i--) s[i]++;
    return { numGroups: 3, groupSizes: s };
  }
  // 4 groups (12–16)
  if (n <= 16) {
    const base = Math.floor(n / 4), rem = n % 4;
    const s = [base, base, base, base];
    for (let i = 3; i >= 4 - rem; i--) s[i]++;
    return { numGroups: 4, groupSizes: s };
  }
  // 5 groups (17)
  if (n === 17) return { numGroups: 5, groupSizes: [3, 3, 3, 4, 4] };
  // 6 groups (18–23)
  if (n <= 23) {
    const base = Math.floor(n / 6), rem = n % 6;
    const s = Array(6).fill(base);
    for (let i = 5; i >= 6 - rem; i--) s[i]++;
    return { numGroups: 6, groupSizes: s };
  }
  // 8 groups (24–32)
  const base = Math.floor(n / 8), rem = n % 8;
  const s = Array(8).fill(base);
  for (let i = 7; i >= 8 - rem; i--) s[i]++;
  return { numGroups: 8, groupSizes: s };
}

// WKF seed placement: seed 1 → G4, seed 2 → G2, seed 3 → G1, seed 4 → G3
// (0-indexed group indices for seeds 0..3)
const WKF_SEED_GROUP_ORDER: number[] = [3, 1, 0, 2];

// ─── Utilities ─────────────────────────────────────────────────────────────────

function kataPow2(n: number): number {
  let p = 1; while (p < n) p <<= 1; return p;
}

function kataRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'SF';
  if (fromEnd === 2) return 'QF';
  return `Round of ${Math.pow(2, fromEnd + 1)}`;
}

function mkKataId(prefix: string, round: number, slot: number): string {
  return `${prefix}-R${round}-S${slot}`;
}

function stubNode(
  matchId:      string,
  round:        number,
  roundLabel:   string,
  slot:         number,
  isMedal:      boolean,
  isBronze:     boolean,
  needsBunkai:  boolean
): KataMatchNode {
  return {
    matchId, round, roundLabel, slot,
    aka: null, ao: null,
    isMedalMatch: isMedal, isBronze, requiresBunkai: needsBunkai,
    isTieBreaker: false, isReperformance: false, isBye: false,
    winnerAdvancesTo: null, loserAdvancesTo: null,
  };
}

// ─── Format A — Elimination with Repechage ─────────────────────────────────────

function buildKataElimination(
  athletes: string[],
  seeds: string[],
  isTeam: boolean
): KataMatchNode[] {
  // Pool split: seeds 1&4 → Pool 1, seeds 2&3 → Pool 2 (so #1 vs #2 only in Grand Final)
  const pool1: (string | null)[] = [];
  const pool2: (string | null)[] = [];
  const seeded4 = seeds.slice(0, 4);

  if (seeded4[0]) pool1.push(seeded4[0]);
  if (seeded4[1]) pool2.push(seeded4[1]);
  if (seeded4[2]) pool2.push(seeded4[2]);
  if (seeded4[3]) pool1.push(seeded4[3]);

  const unseeded = athletes.filter(id => !seeded4.includes(id));
  for (let i = 0; i < unseeded.length; i++) {
    (pool1.length <= pool2.length ? pool1 : pool2).push(unseeded[i]);
  }

  const all: KataMatchNode[] = [];

  const buildPool = (pool: (string | null)[], label: '1' | '2'): KataMatchNode => {
    const size = kataPow2(pool.length);
    const totalR = Math.log2(size);
    const padded = [...pool];
    while (padded.length < size) padded.push(null);

    const nodes: KataMatchNode[] = [];
    const prefix = `P${label}`;
    const r1Count = size / 2;
    const r1: KataMatchNode[] = [];

    for (let s = 0; s < r1Count; s++) {
      const akaId = padded[s * 2] ?? null;
      const aoId  = padded[s * 2 + 1] ?? null;
      const isBye = (akaId !== null && aoId === null) || (akaId === null && aoId !== null);
      const m: KataMatchNode = {
        matchId:         mkKataId(prefix, 1, s + 1),
        round:           1,
        roundLabel:      kataRoundLabel(1, totalR),
        slot:            s + 1,
        aka:             akaId,
        ao:              aoId,
        isMedalMatch:    false,
        isBronze:        false,
        requiresBunkai:  false,
        isTieBreaker:    false,
        isReperformance: false,
        isBye,
        winnerAdvancesTo: null,
        loserAdvancesTo:  `repechage_pool_${label}`,
        result: isBye ? { winner: akaId ? 'aka' : 'ao', votes: { aka: 0, ao: 0 } } : undefined,
      };
      r1.push(m); nodes.push(m);
    }

    let cur = r1; let rn = 2;
    while (cur.length > 1) {
      const next: KataMatchNode[] = [];
      for (let s = 0; s < cur.length; s += 2) {
        const matchId = mkKataId(prefix, rn, Math.floor(s / 2) + 1);
        const isPoolFinal = cur.length === 2;
        const m: KataMatchNode = {
          matchId,
          round:           rn,
          roundLabel:      isPoolFinal ? `Pool ${label} Final` : kataRoundLabel(rn, totalR),
          slot:            Math.floor(s / 2) + 1,
          aka:             null, ao: null,
          isMedalMatch:    false,
          isBronze:        false,
          requiresBunkai:  false,
          isTieBreaker:    false,
          isReperformance: false,
          isBye:           false,
          winnerAdvancesTo: null,
          loserAdvancesTo:  `repechage_pool_${label}`,
        };
        cur[s].winnerAdvancesTo = matchId;
        if (cur[s + 1]) cur[s + 1].winnerAdvancesTo = matchId;
        next.push(m); nodes.push(m);
      }
      cur = next; rn++;
    }

    all.push(...nodes);
    return cur[0]; // Pool final node
  };

  const p1Final = buildPool(pool1.map(a => a), '1');
  const p2Final = buildPool(pool2.map(a => a), '2');

  const grandFinal = stubNode('FINAL',
    Math.max(p1Final.round, p2Final.round) + 1,
    'Final', 1, true, false, isTeam);

  p1Final.winnerAdvancesTo = 'FINAL';
  p2Final.winnerAdvancesTo = 'FINAL';

  all.push(grandFinal);
  return all;
}

// ─── Format B — Round-Robin Groups + Elimination ───────────────────────────────

function buildRRGroupFixtures(
  athletes: string[],
  groupId:  string,
  startSlot: number
): KataMatchNode[] {
  const nodes: KataMatchNode[] = [];
  let slot = startSlot;
  const list = [...athletes];
  if (list.length % 2 === 1) list.push('__BYE__');

  const rounds = list.length - 1;
  const half   = list.length / 2;

  for (let r = 0; r < rounds; r++) {
    for (let m = 0; m < half; m++) {
      const rawAka = list[m];
      const rawAo  = list[list.length - 1 - m];
      const akaId  = rawAka === '__BYE__' ? null : rawAka;
      const aoId   = rawAo  === '__BYE__' ? null : rawAo;
      const isBye  = akaId === null || aoId === null;

      nodes.push({
        matchId:          `${groupId}-RR-S${slot}`,
        round:            1,
        roundLabel:       'Group Stage',
        slot,
        groupId,
        aka:              akaId,
        ao:               aoId,
        isMedalMatch:     false,
        isBronze:         false,
        requiresBunkai:   false,
        isTieBreaker:     false,
        isReperformance:  false,
        isBye,
        winnerAdvancesTo: null,
        loserAdvancesTo:  null,
        result: isBye
          ? { winner: akaId ? 'aka' : 'ao', votes: { aka: 0, ao: 0 } }
          : undefined,
      });
      slot++;
    }
    const last = list.pop()!;
    list.splice(1, 0, last);
  }
  return nodes;
}

function buildKataEliminationStubs(
  numGroups: number,
  isTeam:    boolean
): KataMatchNode[] {
  const advSlots = advancementSlots(numGroups);
  const nodes: KataMatchNode[] = [];
  if (advSlots <= 1) return nodes;

  if (advSlots === 2) {
    nodes.push(stubNode('FINAL',  2, 'Final',  1, true, false, isTeam));
    nodes.push(stubNode('BRONZE', 2, 'Bronze', 2, true, true,  false));
    return nodes;
  }

  const totalR = Math.ceil(Math.log2(advSlots));
  const r1Count = advSlots / 2;

  const r1: KataMatchNode[] = [];
  for (let s = 0; s < r1Count; s++) {
    const n = stubNode(`ELIM-R1-S${s + 1}`, 2, kataRoundLabel(1, totalR), s + 1, false, false, false);
    r1.push(n); nodes.push(n);
  }

  let cur = r1; let rn = 3;
  while (cur.length > 1) {
    const next: KataMatchNode[] = [];
    for (let s = 0; s < cur.length; s += 2) {
      const isFinal = cur.length === 2;
      const n = stubNode(
        isFinal ? 'FINAL' : `ELIM-R${rn}-S${Math.floor(s / 2) + 1}`,
        rn,
        isFinal ? 'Final' : kataRoundLabel(rn - 1, totalR),
        Math.floor(s / 2) + 1,
        isFinal, false, isTeam && isFinal
      );
      cur[s].winnerAdvancesTo = n.matchId;
      if (cur[s + 1]) cur[s + 1].winnerAdvancesTo = n.matchId;
      if (isFinal) {
        cur[s].loserAdvancesTo     = 'BRONZE';
        if (cur[s + 1]) cur[s + 1].loserAdvancesTo = 'BRONZE';
      }
      next.push(n); nodes.push(n);
    }
    cur = next; rn++;
  }

  nodes.push(stubNode('BRONZE', rn, 'Bronze', 1, true, true, false));
  return nodes;
}

function advancementSlots(numGroups: number): number {
  switch (numGroups) {
    case 8: return 8;
    case 6: return 8;
    case 5: return 8;
    case 4: return 8;
    case 3: return 8;
    case 2: return 4;
    case 1: return 2;
    default: return numGroups;
  }
}

function worldCupGroupConfig(n: number): KataGroupConfig {
  const numGroups = Math.max(1, Math.ceil(n / 5));
  const base = Math.floor(n / numGroups), rem = n % numGroups;
  const sizes = Array(numGroups).fill(base);
  for (let i = 0; i < rem; i++) sizes[numGroups - 1 - i]++;
  return { numGroups, groupSizes: sizes };
}

function buildKataRoundRobin(
  athletes:  string[],
  seeds:     string[],
  isTeam:    boolean,
  isWorldCup: boolean
): KataMatchNode[] {
  const n   = athletes.length;
  const cfg = isWorldCup ? worldCupGroupConfig(n) : getWKFGroupConfig(n);
  if (cfg.numGroups === 0) return [];

  // Allocate groups
  const groups: string[][] = Array.from({ length: cfg.numGroups }, () => []);
  const seeded4 = seeds.slice(0, 4);
  for (let si = 0; si < seeded4.length; si++) {
    const gi = WKF_SEED_GROUP_ORDER[si];
    if (gi < cfg.numGroups) groups[gi].push(seeded4[si]);
  }
  const unseeded = athletes.filter(id => !seeded4.includes(id));
  let pool = [...unseeded];
  for (let gi = 0; gi < cfg.numGroups; gi++) {
    const target = cfg.groupSizes[gi];
    while (groups[gi].length < target && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      groups[gi].push(pool.splice(idx, 1)[0]);
    }
  }

  const all: KataMatchNode[] = [];
  let slot = 1;
  for (let gi = 0; gi < cfg.numGroups; gi++) {
    const gNodes = buildRRGroupFixtures(groups[gi], `G${gi + 1}`, slot);
    slot += gNodes.length;
    all.push(...gNodes);
  }

  all.push(...buildKataEliminationStubs(cfg.numGroups, isTeam));
  return all;
}

// ─── Format C — Two-Pool Round-Robin ──────────────────────────────────────────

function buildKataTwoPool(
  athletes: string[],
  seeds:    string[],
  isTeam:   boolean
): KataMatchNode[] {
  const poolA: string[] = [];
  const poolB: string[] = [];
  const seeded4 = seeds.slice(0, 4);

  if (seeded4[0]) poolA.push(seeded4[0]);
  if (seeded4[1]) poolB.push(seeded4[1]);
  if (seeded4[2]) poolA.push(seeded4[2]);
  if (seeded4[3]) poolB.push(seeded4[3]);

  const unseeded = athletes.filter(id => !seeded4.includes(id));
  for (let i = 0; i < unseeded.length; i++) {
    (poolA.length <= poolB.length ? poolA : poolB).push(unseeded[i]);
  }

  const all: KataMatchNode[] = [];
  let slot = 1;
  const aNodes = buildRRGroupFixtures(poolA, 'PA', slot); slot += aNodes.length;
  const bNodes = buildRRGroupFixtures(poolB, 'PB', slot);
  all.push(...aNodes, ...bNodes);

  all.push({
    matchId: 'FINAL', round: 2, roundLabel: 'Final', slot: 1,
    aka: null, ao: null, isMedalMatch: true, isBronze: false,
    requiresBunkai: isTeam, isTieBreaker: false, isReperformance: false,
    isBye: false, winnerAdvancesTo: null, loserAdvancesTo: null,
  });
  all.push({
    matchId: 'BRONZE', round: 2, roundLabel: 'Bronze', slot: 2,
    aka: null, ao: null, isMedalMatch: true, isBronze: true,
    requiresBunkai: false, isTieBreaker: false, isReperformance: false,
    isBye: false, winnerAdvancesTo: null, loserAdvancesTo: null,
  });

  return all;
}

// ─── Runner-Up Comparison ─────────────────────────────────────────────────────

/**
 * Compares runner-up athletes by net vote differential (votesFor − votesAgainst).
 * Used at runtime to determine which runners-up advance from group stage.
 *
 * Returns sorted list (best first) and any still-tied pairs that need
 * an extra kata bout scheduled.
 */
export function compareRunnerUps(results: KataGroupResult[]): {
  ranked:    KataGroupResult[];
  tiedPairs: [string, string][];
} {
  const sorted = [...results].sort((a, b) => {
    if (b.netVoteDiff  !== a.netVoteDiff)  return b.netVoteDiff  - a.netVoteDiff;
    if (b.votesFor     !== a.votesFor)     return b.votesFor     - a.votesFor;
    return a.votesAgainst - b.votesAgainst;
  });

  const tiedPairs: [string, string][] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (
      a.netVoteDiff  === b.netVoteDiff &&
      a.votesFor     === b.votesFor    &&
      a.votesAgainst === b.votesAgainst
    ) {
      tiedPairs.push([a.athleteId, b.athleteId]);
    }
  }
  return { ranked: sorted, tiedPairs };
}

// ─── DQ in Round-Robin ────────────────────────────────────────────────────────

/**
 * Records a DQ result on a round-robin match node.
 * WKF: opponent wins 3 VP; DQ'd athlete stays in draw.
 * Mutates and returns the node.
 */
export function applyKataRRDQ(node: KataMatchNode, dqSide: 'aka' | 'ao'): KataMatchNode {
  const winner = dqSide === 'aka' ? 'ao' : 'aka';
  node.result = { winner, votes: { aka: dqSide === 'ao' ? 3 : 0, ao: dqSide === 'aka' ? 3 : 0 } };
  return node;
}

// ─── Repechage Bracket Builder (called at runtime) ────────────────────────────

/**
 * Builds a mini single-elimination repechage sub-tree from athletes who
 * lost to the finalist at any round. Winner gets Bronze.
 * Call this once a pool finalist is confirmed.
 */
export function buildRepechageBracket(
  poolLabel: '1' | '2',
  losers:    string[]
): KataMatchNode[] {
  if (losers.length === 0) return [];
  const prefix  = `REP${poolLabel}`;

  if (losers.length === 1) {
    return [{
      matchId: `${prefix}-BRONZE`, round: 1, roundLabel: 'Bronze', slot: 1,
      aka: losers[0], ao: null,
      isMedalMatch: true, isBronze: true, requiresBunkai: false,
      isTieBreaker: false, isReperformance: false, isBye: true,
      winnerAdvancesTo: null, loserAdvancesTo: null,
      result: { winner: 'aka', votes: { aka: 0, ao: 0 } },
    }];
  }

  const size   = kataPow2(losers.length);
  const padded = [...losers, ...Array(size - losers.length).fill(null)];
  const totalR = Math.log2(size);
  const nodes: KataMatchNode[] = [];

  const r1: KataMatchNode[] = [];
  for (let s = 0; s < size / 2; s++) {
    const akaId = padded[s * 2]     ?? null;
    const aoId  = padded[s * 2 + 1] ?? null;
    const isBye = (akaId !== null && aoId === null) || (akaId === null && aoId !== null);
    const m: KataMatchNode = {
      matchId:          mkKataId(prefix, 1, s + 1),
      round:            1,
      roundLabel:       kataRoundLabel(1, totalR),
      slot:             s + 1,
      aka:              akaId, ao: aoId,
      isMedalMatch:     false, isBronze: false, requiresBunkai: false,
      isTieBreaker:     false, isReperformance: false, isBye,
      winnerAdvancesTo: null, loserAdvancesTo: null,
      result: isBye ? { winner: akaId ? 'aka' : 'ao', votes: { aka: 0, ao: 0 } } : undefined,
    };
    r1.push(m); nodes.push(m);
  }

  let cur = r1; let rn = 2;
  while (cur.length > 1) {
    const next: KataMatchNode[] = [];
    for (let s = 0; s < cur.length; s += 2) {
      const isFinal = cur.length === 2;
      const matchId = isFinal ? `${prefix}-BRONZE` : mkKataId(prefix, rn, Math.floor(s / 2) + 1);
      const m: KataMatchNode = {
        matchId, round: rn,
        roundLabel: isFinal ? 'Bronze' : kataRoundLabel(rn, totalR),
        slot: Math.floor(s / 2) + 1,
        aka: null, ao: null,
        isMedalMatch: isFinal, isBronze: isFinal, requiresBunkai: false,
        isTieBreaker: false, isReperformance: false, isBye: false,
        winnerAdvancesTo: null, loserAdvancesTo: null,
      };
      cur[s].winnerAdvancesTo = matchId;
      if (cur[s + 1]) cur[s + 1].winnerAdvancesTo = matchId;
      next.push(m); nodes.push(m);
    }
    cur = next; rn++;
  }
  return nodes;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generates a complete Kata bracket for a category.
 *
 * @param athletes  Ordered list of athleteIds / teamIds (seeds first if known).
 * @param config    Kata category configuration from Firestore.
 * @returns         Flat array of KataMatchNode to store at
 *                  competitions/{id}/categories/{catId}/matches/{matchId}.
 */
export function generateKataBracket(
  athletes: string[],
  config:   KataCategoryConfig
): KataMatchNode[] {
  if (!athletes || athletes.length === 0) return [];

  const { kataFormat, seeds = [], isTeam = false } = config;

  // Deduplicate while preserving order
  const uniq   = Array.from(new Set(athletes));
  const seeded = seeds.filter(s => uniq.includes(s));

  switch (kataFormat) {
    case 'elimination':
      return buildKataElimination(uniq, seeded, isTeam);

    case 'round-robin':
      return buildKataRoundRobin(uniq, seeded, isTeam, /* isWorldCup= */ isTeam);

    case 'two-pool':
      return buildKataTwoPool(uniq, seeded, isTeam);

    default:
      return [];
  }
}
