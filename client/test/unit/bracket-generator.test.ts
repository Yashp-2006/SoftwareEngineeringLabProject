import { describe, it, expect } from 'vitest';
import {
  generateBracket,
  normalizeAthleteRows,
  AthleteRow,
  PoolSize,
} from '@taikaix/backend/services/tiesheet/generator';

describe('Bracket Generator & Tiesheet Engine', () => {
  const createMockAthletes = (count: number, academyPrefix = 'Dojo'): AthleteRow[] => {
    return Array.from({ length: count }, (_, i) => ({
      playerId: `ath-${i + 1}`,
      name: `Athlete ${i + 1}`,
      gender: i % 2 === 0 ? 'male' : 'female',
      weight: 60 + (i % 10),
      age: 18 + (i % 5),
      country: i % 3 === 0 ? 'Japan' : (i % 3 === 1 ? 'France' : 'USA'),
      state: 'State-A',
      district: 'District-1',
      academy: `${academyPrefix}-${(i % 3) + 1}`,
      interestSpecial: '',
    }));
  };

  it('generates a direct final match for exactly 2 athletes', () => {
    const athletes = createMockAthletes(2);
    const matches = generateBracket(athletes, 'international', 8);

    expect(matches).toHaveLength(1);
    expect(matches[0].round).toBe(1);
    expect(matches[0].aka?.name).toBeDefined();
    expect(matches[0].ao?.name).toBeDefined();
    expect(matches[0].status).toBe('upcoming');
  });

  it('generates 4-slot single elimination bracket for 4 athletes', () => {
    const athletes = createMockAthletes(4);
    const matches = generateBracket(athletes, 'international', 4);

    // 4 athletes -> 2 semifinals + 1 final = 3 matches
    expect(matches.length).toBeGreaterThanOrEqual(3);
    const r1Matches = matches.filter(m => m.round === 1);
    expect(r1Matches).toHaveLength(2);
    const r2Matches = matches.filter(m => m.round === 2);
    expect(r2Matches).toHaveLength(1);
  });

  it('allocates BYEs correctly for odd participant numbers (e.g. 5 athletes)', () => {
    const athletes = createMockAthletes(5);
    // 5 athletes in an 8-slot bracket requires 3 BYEs
    const matches = generateBracket(athletes, 'international', 8);

    expect(matches.length).toBeGreaterThanOrEqual(4);
    // In round 1, some matches should have an empty slot (BYE) or be auto-advanced
    const round1 = matches.filter(m => m.round === 1);
    const byeMatches = round1.filter(m => !m.aka || !m.ao || m.aka.name?.includes('BYE') || m.ao.name?.includes('BYE'));
    expect(round1.length).toBe(4);
    expect(byeMatches.length).toBeGreaterThan(0);
  });

  it('separates athletes from the same academy into opposite bracket halves', () => {
    // 4 athletes: 2 from Dojo-A, 2 from Dojo-B
    const athletes: AthleteRow[] = [
      { playerId: '1', name: 'Aka-1', gender: 'male', weight: 65, age: 20, country: 'USA', state: '', district: '', academy: 'Dojo-Alpha', interestSpecial: '' },
      { playerId: '2', name: 'Aka-2', gender: 'male', weight: 65, age: 20, country: 'USA', state: '', district: '', academy: 'Dojo-Alpha', interestSpecial: '' },
      { playerId: '3', name: 'Ao-1', gender: 'male', weight: 65, age: 20, country: 'USA', state: '', district: '', academy: 'Dojo-Beta', interestSpecial: '' },
      { playerId: '4', name: 'Ao-2', gender: 'male', weight: 65, age: 20, country: 'USA', state: '', district: '', academy: 'Dojo-Beta', interestSpecial: '' },
    ];

    const matches = generateBracket(athletes, 'international', 4);
    const r1 = matches.filter(m => m.round === 1);

    // Neither R1 match should have two athletes from the exact same academy
    for (const match of r1) {
      if (match.aka?.academy && match.ao?.academy) {
        expect(match.aka.academy).not.toBe(match.ao.academy);
      }
    }
  });

  it('generates a round robin schedule for 3 athletes when requested', () => {
    const athletes = createMockAthletes(3);
    const matches = generateBracket(athletes, 'international', 4, { useRoundRobin: true });

    // 3 athletes round robin = n*(n-1)/2 = 3 matches
    expect(matches).toHaveLength(3);
    matches.forEach(m => {
      expect(m.id).toContain('RR');
    });
  });

  it('splits into multi-pools when athletes exceed pool size', () => {
    // 16 athletes with poolSize = 8 -> 2 pools (Pool 1 and Pool 2) + Finals
    const athletes = createMockAthletes(16);
    const matches = generateBracket(athletes, 'international', 8);

    expect(matches.length).toBeGreaterThan(8);
  });
});
