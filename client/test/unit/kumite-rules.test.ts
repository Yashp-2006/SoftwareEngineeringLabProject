import { describe, it, expect } from 'vitest';

interface KumiteFighterState {
  name: string;
  score: number;
  yuko: number;
  waza: number;
  ippon: number;
  senshu: boolean;
  c1: number;
  c2: number;
  c3: number;
  hc: number;
  h: number;
}

// Pure Kumite Rules Engine Functions (Mirroring operator & WKF 2024 regulations)
export function addPoints(fighter: KumiteFighterState, delta: 1 | 2 | 3 | -1 | -2 | -3): KumiteFighterState {
  const newScore = Math.max(0, fighter.score + delta);
  let { yuko, waza, ippon } = fighter;

  if (delta === 1) yuko += 1;
  else if (delta === -1 && yuko > 0) yuko -= 1;
  else if (delta === 2) waza += 1;
  else if (delta === -2 && waza > 0) waza -= 1;
  else if (delta === 3) ippon += 1;
  else if (delta === -3 && ippon > 0) ippon -= 1;

  return { ...fighter, score: newScore, yuko, waza, ippon };
}

export function evaluateSenshu(
  prevAka: KumiteFighterState,
  prevAo: KumiteFighterState,
  akaScored: boolean,
  aoScored: boolean
): { akaSenshu: boolean; aoSenshu: boolean } {
  // If either already had Senshu, Senshu remains with that fighter
  if (prevAka.senshu || prevAo.senshu) {
    return { akaSenshu: prevAka.senshu, aoSenshu: prevAo.senshu };
  }

  // Simultaneous scoring: neither gets Senshu
  if (akaScored && aoScored) {
    return { akaSenshu: false, aoSenshu: false };
  }

  // First uncontested score earns Senshu
  if (akaScored && prevAka.score === 0 && prevAo.score === 0) {
    return { akaSenshu: true, aoSenshu: false };
  }
  if (aoScored && prevAka.score === 0 && prevAo.score === 0) {
    return { akaSenshu: false, aoSenshu: true };
  }

  return { akaSenshu: false, aoSenshu: false };
}

export function checkEightPointGap(akaScore: number, aoScore: number): { isOver: boolean; winnerColor: 'aka' | 'ao' | null } {
  if (akaScore - aoScore >= 8) {
    return { isOver: true, winnerColor: 'aka' };
  }
  if (aoScore - akaScore >= 8) {
    return { isOver: true, winnerColor: 'ao' };
  }
  return { isOver: false, winnerColor: null };
}

export function checkDisqualification(fighter: KumiteFighterState): boolean {
  return fighter.h > 0 || (fighter.c1 + fighter.c2 + fighter.c3 + fighter.hc) >= 4;
}

export function determineMatchWinner(
  aka: KumiteFighterState,
  ao: KumiteFighterState,
  isTimeExpired: boolean
): { winner: 'aka' | 'ao' | 'tie' | null; reason: string } {
  // 1. Disqualification checks
  const akaDq = checkDisqualification(aka);
  const aoDq = checkDisqualification(ao);

  if (akaDq && !aoDq) return { winner: 'ao', reason: 'Aka Hansoku (Disqualification)' };
  if (aoDq && !akaDq) return { winner: 'aka', reason: 'Ao Hansoku (Disqualification)' };
  if (akaDq && aoDq) return { winner: 'tie', reason: 'Double Hansoku' };

  // 2. 8-Point Gap
  const gap = checkEightPointGap(aka.score, ao.score);
  if (gap.isOver) {
    return { winner: gap.winnerColor, reason: '8-Point Technical Superiority' };
  }

  // 3. Time Expired Checks
  if (isTimeExpired) {
    if (aka.score > ao.score) return { winner: 'aka', reason: 'Higher Score' };
    if (ao.score > aka.score) return { winner: 'ao', reason: 'Higher Score' };

    // Tied scores -> Senshu
    if (aka.senshu) return { winner: 'aka', reason: 'Senshu (First Score Advantage)' };
    if (ao.senshu) return { winner: 'ao', reason: 'Senshu (First Score Advantage)' };

    // Unresolved tie -> Hantei (Judges decision)
    return { winner: 'tie', reason: 'Tied Score - Pending Hantei' };
  }

  return { winner: null, reason: 'Match in progress' };
}

describe('Kumite Rules & Scoring Engine', () => {
  const initialFighter = (name: string): KumiteFighterState => ({
    name,
    score: 0,
    yuko: 0,
    waza: 0,
    ippon: 0,
    senshu: false,
    c1: 0,
    c2: 0,
    c3: 0,
    hc: 0,
    h: 0,
  });

  describe('Point Additions & Subtractions', () => {
    it('accurately increments Yuko (+1), Waza-ari (+2), and Ippon (+3)', () => {
      let f = initialFighter('Aka');
      f = addPoints(f, 1);
      expect(f.score).toBe(1);
      expect(f.yuko).toBe(1);

      f = addPoints(f, 2);
      expect(f.score).toBe(3);
      expect(f.waza).toBe(1);

      f = addPoints(f, 3);
      expect(f.score).toBe(6);
      expect(f.ippon).toBe(1);
    });

    it('decrements points correctly and prevents negative scores', () => {
      let f = initialFighter('Aka');
      f = addPoints(f, 2); // score: 2
      f = addPoints(f, -1); // score: 1
      expect(f.score).toBe(1);

      f = addPoints(f, -3); // Attempt to go negative
      expect(f.score).toBe(0);
    });
  });

  describe('Senshu Advantage (WKF First Score Rule)', () => {
    it('awards Senshu to the first uncontested scorer', () => {
      const aka = initialFighter('Aka');
      const ao = initialFighter('Ao');

      const result = evaluateSenshu(aka, ao, true, false);
      expect(result.akaSenshu).toBe(true);
      expect(result.aoSenshu).toBe(false);
    });

    it('denies Senshu if both fighters score simultaneously (Ai-uchi)', () => {
      const aka = initialFighter('Aka');
      const ao = initialFighter('Ao');

      const result = evaluateSenshu(aka, ao, true, true);
      expect(result.akaSenshu).toBe(false);
      expect(result.aoSenshu).toBe(false);
    });

    it('resolves tied score matches by awarding victory to the Senshu holder', () => {
      const aka = { ...initialFighter('Aka'), score: 3, senshu: true };
      const ao = { ...initialFighter('Ao'), score: 3, senshu: false };

      const outcome = determineMatchWinner(aka, ao, true);
      expect(outcome.winner).toBe('aka');
      expect(outcome.reason).toContain('Senshu');
    });
  });

  describe('8-Point Gap (Technical Superiority)', () => {
    it('triggers technical victory as soon as gap reaches 8 points', () => {
      const aka = { ...initialFighter('Aka'), score: 8 };
      const ao = { ...initialFighter('Ao'), score: 0 };

      const outcome = determineMatchWinner(aka, ao, false);
      expect(outcome.winner).toBe('aka');
      expect(outcome.reason).toContain('8-Point');
    });

    it('does not trigger victory if gap is less than 8 points', () => {
      const aka = { ...initialFighter('Aka'), score: 7 };
      const ao = { ...initialFighter('Ao'), score: 0 };

      const outcome = determineMatchWinner(aka, ao, false);
      expect(outcome.winner).toBeNull();
    });
  });

  describe('Penalties & Disqualification (Hansoku)', () => {
    it('disqualifies a fighter when Hansoku (h: 1) is given', () => {
      const aka = { ...initialFighter('Aka'), h: 1, score: 5 };
      const ao = { ...initialFighter('Ao'), score: 2 };

      const outcome = determineMatchWinner(aka, ao, false);
      expect(outcome.winner).toBe('ao');
      expect(outcome.reason).toContain('Hansoku');
    });

    it('disqualifies a fighter when accumulated penalties reach 4', () => {
      const aka = { ...initialFighter('Aka'), c1: 1, c2: 1, c3: 1, hc: 1 }; // 4 penalties
      const ao = { ...initialFighter('Ao'), score: 1 };

      const outcome = determineMatchWinner(aka, ao, false);
      expect(outcome.winner).toBe('ao');
    });
  });
});
