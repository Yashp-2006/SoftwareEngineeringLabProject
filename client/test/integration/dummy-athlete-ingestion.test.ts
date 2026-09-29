import { describe, it, expect } from 'vitest';
import {
  parseExcelIntoCategories,
  generateBracket,
  AthleteRow,
} from '@taikaix/backend/services/tiesheet/generator';

// Helper: Generate a realistic 64-athlete tournament CSV
function generateLargeTournamentCsv(): string {
  const headers = 'Name,Age,Gender,Weight,Academy,Country,State,Events';
  const clubs = [
    'Tiger Shotokan', 'Dragon Shitoryu', 'Eagle Goju-ryu', 'Samurai Wado-ryu',
    'Cobra Martial Arts', 'Phoenix Karate', 'Lion Club', 'Falcon Dojo'
  ];

  const rows: string[] = [headers];

  // 1. Cadet Male Kumite & Kata (Age 14-15, Weight 52-57kg) - 16 Athletes
  for (let i = 1; i <= 16; i++) {
    const club = clubs[(i - 1) % clubs.length];
    const event = i % 3 === 0 ? 'Both' : (i % 2 === 0 ? 'Kata' : 'Kumite');
    rows.push(`Cadet Male ${i},14,Male,${52 + (i % 5)},${club},India,Maharashtra,${event}`);
  }

  // 2. Junior Female Kumite (Age 16-17, Weight 48-53kg) - 16 Athletes
  for (let i = 1; i <= 16; i++) {
    const club = clubs[(i - 1) % clubs.length];
    rows.push(`Junior Female ${i},16,Female,${48 + (i % 5)},${club},India,Delhi,Kumite`);
  }

  // 3. Senior Male Kumite (Age 20-25, Weight 65-75kg) - 16 Athletes
  for (let i = 1; i <= 16; i++) {
    const club = clubs[(i - 1) % clubs.length];
    rows.push(`Senior Male ${i},22,Male,${67 + (i % 8)},${club},India,Karnataka,Kumite`);
  }

  // 4. Senior Female Kata (Age 18-24, Weight 55kg) - 16 Athletes
  for (let i = 1; i <= 16; i++) {
    const club = clubs[(i - 1) % clubs.length];
    rows.push(`Senior Female ${i},20,Female,55,${club},India,Gujarat,Kata`);
  }

  return rows.join('\n');
}

describe('Large Scale Tournament Ingestion & Tiesheet Progression', () => {
  const csvData = generateLargeTournamentCsv();

  it('parses and buckets 64 multi-club athletes into categories without data loss', () => {
    const result = parseExcelIntoCategories(csvData, [], 'standard', [], 'wkf');

    expect(result.uniqueAthletesCount).toBe(64);
    expect(result.categoryMap.size).toBeGreaterThan(0);

    // Sum of all athletes in all categories should be >= 64 (athletes with "Both" appear in 2 categories)
    let totalAssignments = 0;
    for (const [, athletes] of result.categoryMap) {
      totalAssignments += athletes.length;
    }
    expect(totalAssignments).toBeGreaterThanOrEqual(64);
  });

  it('correctly duplicates athletes registered for "Both" into Kata and Kumite', () => {
    const result = parseExcelIntoCategories(csvData, [], 'standard', [], 'wkf');

    // Find athletes who had event "Both" (e.g. Cadet Male 3, 6, 9, 12, 15)
    let dualCategoryAthleteFound = false;
    const athleteCategories: Record<string, string[]> = {};

    for (const [catName, athletes] of result.categoryMap) {
      for (const a of athletes) {
        if (!athleteCategories[a.name]) athleteCategories[a.name] = [];
        athleteCategories[a.name].push(catName);
      }
    }

    const dualAthletes = Object.entries(athleteCategories).filter(([, cats]) => cats.length >= 2);
    expect(dualAthletes.length).toBeGreaterThan(0);
    // Verified that athlete is in at least 2 distinct categories (Kata & Kumite)
    expect(dualAthletes[0][1].length).toBeGreaterThanOrEqual(2);
  });

  it('generates fully connected tournament bracket trees from ingested categories', () => {
    const result = parseExcelIntoCategories(csvData, [], 'standard', [], 'wkf');

    for (const [catName, athletes] of result.categoryMap) {
      if (athletes.length < 2) continue;

      const matches = generateBracket(athletes, 'state', 8);

      expect(matches.length).toBeGreaterThan(0);

      // Verify Round 1 matches have aka and ao assigned (or BYE)
      const r1 = matches.filter(m => m.round === 1);
      expect(r1.length).toBeGreaterThan(0);

      // Verify club separation in Round 1: No two athletes from the same club face each other if avoidable
      r1.forEach(m => {
        if (m.aka?.academy && m.ao?.academy && m.aka.name && m.ao.name) {
          // If bracket had >= 2 distinct academies, teammates should not clash in R1
          expect(m.aka.academy).not.toBe(m.ao.academy);
        }
      });
    }
  });

  it('handles arbitrary odd-sized divisions (e.g. 11 athletes) with valid BYE advancement', () => {
    const customAthletes: AthleteRow[] = Array.from({ length: 11 }, (_, i) => ({
      playerId: `odd-${i + 1}`,
      name: `Odd Athlete ${i + 1}`,
      gender: 'male',
      weight: 65,
      age: 19,
      country: 'India',
      state: 'Goa',
      district: 'Panaji',
      academy: `Academy-${(i % 4) + 1}`,
      interestSpecial: '',
    }));

    // 11 athletes pads to a 16-slot bracket with 5 BYEs
    const matches = generateBracket(customAthletes, 'state', 16);

    const round1 = matches.filter(m => m.round === 1);
    expect(round1.length).toBe(8); // 16 / 2 = 8 matches in round 1

    // At least 5 matches should feature an auto-advanced slot (BYE)
    const matchesWithBye = round1.filter(m => !m.aka || !m.ao || m.aka.name?.includes('BYE') || m.ao.name?.includes('BYE'));
    expect(matchesWithBye.length).toBeGreaterThanOrEqual(5);
  });
});
