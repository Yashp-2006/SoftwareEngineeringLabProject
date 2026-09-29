import { describe, it, expect } from 'vitest';

export interface AcademyMedalStats {
  academy: string;
  gold: number;
  silver: number;
  bronze: number;
  points: number;
}

export function computeLeaderboard(
  categories: Array<{
    athletes?: Array<{ academy?: string; medal?: 'gold' | 'silver' | 'bronze' | null }>;
  }>
): AcademyMedalStats[] {
  const map: Record<string, { gold: number; silver: number; bronze: number; points: number }> = {};

  categories.forEach(cat => {
    (cat.athletes || []).forEach(ath => {
      if (ath.medal) {
        const academy = ath.academy || 'Independent';
        if (!map[academy]) {
          map[academy] = { gold: 0, silver: 0, bronze: 0, points: 0 };
        }
        if (ath.medal === 'gold') {
          map[academy].gold += 1;
          map[academy].points += 3;
        } else if (ath.medal === 'silver') {
          map[academy].silver += 1;
          map[academy].points += 2;
        } else if (ath.medal === 'bronze') {
          map[academy].bronze += 1;
          map[academy].points += 1;
        }
      }
    });
  });

  const leaderboard: AcademyMedalStats[] = Object.entries(map).map(([academy, stats]) => ({
    academy,
    ...stats,
  }));

  leaderboard.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (b.silver !== a.silver) return b.silver - a.silver;
    return b.bronze - a.bronze;
  });

  return leaderboard;
}

describe('Tournament Medal Standings & Leaderboard', () => {
  it('accurately computes 3pts for Gold, 2pts for Silver, and 1pt for Bronze', () => {
    const mockCategories = [
      {
        athletes: [
          { academy: 'Tiger Dojo', medal: 'gold' as const },
          { academy: 'Eagle Club', medal: 'silver' as const },
          { academy: 'Dragon Club', medal: 'bronze' as const },
        ],
      },
    ];

    const standings = computeLeaderboard(mockCategories);

    expect(standings).toHaveLength(3);
    expect(standings[0].academy).toBe('Tiger Dojo');
    expect(standings[0].points).toBe(3);
    expect(standings[1].academy).toBe('Eagle Club');
    expect(standings[1].points).toBe(2);
    expect(standings[2].academy).toBe('Dragon Club');
    expect(standings[2].points).toBe(1);
  });

  it('breaks ties using medal quality (Gold count > Silver count > Bronze count)', () => {
    // Academy A: 1 Gold (3 pts)
    // Academy B: 1 Silver + 1 Bronze = 3 pts
    const mockCategories = [
      {
        athletes: [
          { academy: 'Academy Alpha', medal: 'gold' as const },
          { academy: 'Academy Beta', medal: 'silver' as const },
          { academy: 'Academy Beta', medal: 'bronze' as const },
        ],
      },
    ];

    const standings = computeLeaderboard(mockCategories);

    expect(standings[0].points).toBe(3);
    expect(standings[1].points).toBe(3);
    // Academy Alpha ranks 1st because it has 1 Gold vs 0 Gold
    expect(standings[0].academy).toBe('Academy Alpha');
    expect(standings[1].academy).toBe('Academy Beta');
  });
});
