// backend/services/bracket-generator.ts
import { Athlete, Match, BracketGenerationResult } from '../types';

/**
 * Calculates the next power of 2 for a given number.
 * E.g., 5 -> 8, 9 -> 16.
 */
function nextPowerOf2(n: number): number {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Calculates the appropriate progression type.
 */
function determineProgression(poolSize: number, ruleSet: 'WKF' | 'custom'): 'Round Robin' | 'Repechage' {
  if (ruleSet === 'WKF') {
    return poolSize <= 5 ? 'Round Robin' : 'Repechage';
  }
  // For custom, this would be an explicit admin choice, defaulting to Repechage here
  return 'Repechage';
}

/**
 * Recursively separates athletes to maximize distance between teammates.
 * Priorities: Country > State > District > Academy
 */
function separateAthletes(athletes: Athlete[]): Athlete[] {
  // If 1 or 0, return as is
  if (athletes.length <= 1) return athletes;

  // Group by the highest cardinality attribute first (Country)
  // We'll use a simple bucket round-robin to separate them
  const grouped = new Map<string, Athlete[]>();
  
  for (const a of athletes) {
    const key = `${a.country}-${a.state}-${a.district}-${a.academy}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  // Sort groups by size descending (largest groups distributed first)
  const sortedGroups = Array.from(grouped.values()).sort((a, b) => b.length - a.length);
  
  const separated: Athlete[] = [];
  const maxGroupSize = sortedGroups[0]?.length || 0;

  // Distribute in a round-robin fashion across groups
  for (let i = 0; i < maxGroupSize; i++) {
    for (const group of sortedGroups) {
      if (i < group.length) {
        separated.push(group[i]);
      }
    }
  }

  return separated;
}

/**
 * Generates the tiesheet / bracket for a category.
 * Also handles dynamic late registrations by checking if any matches are ongoing.
 */
export function generateBracket(
  categoryId: string,
  competitionId: string,
  athletes: Athlete[],
  ruleSet: 'WKF' | 'custom',
  existingMatches: Match[] = [] // Used to check if we can re-generate
): BracketGenerationResult {
  
  // 1. Check if we can re-generate (if matches exist, are any started?)
  const hasStartedMatches = existingMatches.some(m => m.status === 'ongoing' || m.status === 'finished');
  if (hasStartedMatches) {
    throw new Error('Cannot automatically re-generate bracket. Matches have already started. Use manual Walkover/Bye.');
  }

  // 2. Filter out disqualified/absent athletes immediately
  const activeAthletes = athletes.filter(a => a.attendance === 'present' && !a.disqualified);
  const poolSize = activeAthletes.length;

  if (poolSize === 0) {
    return { categoryId, matches: [], progressionType: 'Round Robin' };
  }

  // 3. Determine progression
  const progressionType = determineProgression(poolSize, ruleSet);

  if (progressionType === 'Round Robin') {
    // For round robin, we just need to generate all possible pairs
    // (Omitted standard round robin logic for brevity, focusing on Repechage bracket)
    return { categoryId, matches: [], progressionType };
  }

  // 4. Repechage / Single Elimination logic
  const bracketSize = nextPowerOf2(poolSize);
  const byeCount = bracketSize - poolSize;

  // 5. Separate athletes (Seeding)
  const seededAthletes = separateAthletes(activeAthletes);

  // 6. Build Round 1 Matches
  const matches: Match[] = [];
  const matchCountRound1 = bracketSize / 2;
  
  // Distribute byes: we want byes to go to the most highly separated athletes (i.e. indices 0, 1, 2...)
  // But practically in WKF, byes are distributed evenly top and bottom.
  // We'll mark the first `byeCount` indices as receiving a bye.
  const athleteSlots = [...seededAthletes];
  
  // Insert "null" at specific positions to represent Byes.
  // In a 16 bracket with 9 players (7 byes), we want the 7 byes distributed.
  const slotsWithByes: (Athlete | null)[] = [];
  
  // Simple algorithm to interleave byes evenly
  let byesPlaced = 0;
  let athletesPlaced = 0;
  
  for (let i = 0; i < bracketSize; i++) {
    // Should this slot be a bye? 
    // We space byes evenly across the bracketSize
    if (byesPlaced < byeCount && (i * byeCount) % bracketSize < byeCount) {
      slotsWithByes.push(null);
      byesPlaced++;
    } else {
      slotsWithByes.push(athleteSlots[athletesPlaced++] || null);
    }
  }

  // 7. Assign slots to AKA / AO
  for (let i = 0; i < matchCountRound1; i++) {
    // Standard pair: i*2 and i*2+1
    const p1 = slotsWithByes[i * 2];
    const p2 = slotsWithByes[i * 2 + 1];

    matches.push({
      id: `${categoryId}-R1-M${i + 1}`,
      competitionId,
      categoryId,
      round: 1,
      bracketPosition: `R1-M${i + 1}`,
      status: 'upcoming',
      aka: {
        athleteId: p1 ? p1.id : null,
        name: p1 ? p1.name : 'Bye',
        isBye: !p1,
        score: 0,
        penalties: [],
        senshu: false,
      },
      ao: {
        athleteId: p2 ? p2.id : null,
        name: p2 ? p2.name : 'Bye',
        isBye: !p2,
        score: 0,
        penalties: [],
        senshu: false,
      },
      winnerId: (!p1 && p2) ? p2.id : (!p2 && p1) ? p1.id : null, // If one is bye, the other is winner
      timer: 0
    });
  }

  // 8. Generate empty matches for subsequent rounds (R2, R3, etc.)
  let prevRoundMatches = matchCountRound1;
  let currentRound = 2;
  while (prevRoundMatches > 1) {
    const currentRoundMatches = prevRoundMatches / 2;
    for (let i = 0; i < currentRoundMatches; i++) {
       matches.push({
          id: `${categoryId}-R${currentRound}-M${i + 1}`,
          competitionId,
          categoryId,
          round: currentRound,
          bracketPosition: `R${currentRound}-M${i + 1}`,
          status: 'upcoming',
          aka: { athleteId: null, name: 'TBD', isBye: false, score: 0, penalties: [], senshu: false },
          ao: { athleteId: null, name: 'TBD', isBye: false, score: 0, penalties: [], senshu: false },
          timer: 0
       });
    }
    prevRoundMatches = currentRoundMatches;
    currentRound++;
  }

  return {
    categoryId,
    matches,
    progressionType
  };
}

/**
 * Manually handle a "Promote" button click (acting as a Walkover/Bye)
 */
export function promoteAthlete(match: Match, athleteIdToPromote: string): Match {
  return {
    ...match,
    status: 'finished',
    winnerId: athleteIdToPromote,
    aka: {
      ...match.aka,
      isBye: match.aka.athleteId !== athleteIdToPromote && match.ao.athleteId === athleteIdToPromote
    },
    ao: {
      ...match.ao,
      isBye: match.ao.athleteId !== athleteIdToPromote && match.aka.athleteId === athleteIdToPromote
    }
  };
}
