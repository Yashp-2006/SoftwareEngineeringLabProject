import { describe, it, expect } from 'vitest';
import { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';
import { KATA_LIST } from '@/lib/kata-list';

// Helper: Calculate trimmed score (WKF 5-judge / 7-judge system dropping highest & lowest)
export function calculateTrimmedScore(scores: number[]): { trimmed: number[]; finalScore: number } {
  if (scores.length < 3) {
    const sum = scores.reduce((a, b) => a + b, 0);
    return { trimmed: scores, finalScore: +(sum.toFixed(2)) };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  // Drop lowest and highest
  const trimmed = sorted.slice(1, sorted.length - 1);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return { trimmed, finalScore: +(sum.toFixed(2)) };
}

// Helper: Kata Repetition Validator
export function validateKataRepetition(
  athletePastKatas: number[],
  attemptedKataNumber: number
): { allowed: boolean; error?: string } {
  if (athletePastKatas.includes(attemptedKataNumber)) {
    const kataName = KATA_LIST.find(k => k.number === attemptedKataNumber)?.name || `Kata #${attemptedKataNumber}`;
    return {
      allowed: false,
      error: `Rule Violation: ${kataName} has already been performed by this athlete in a previous round.`,
    };
  }
  return { allowed: true };
}

describe('Kata Judging Engine & WKF Rules', () => {
  describe('deriveJudgeVotes (3 and 5 Judges Flag Evaluation)', () => {
    it('determines 3-judge majority decision (2-1 Aka)', () => {
      const kataScores = {
        aka: { '0': 8.5, '1': 8.2, '2': 7.9 },
        ao:  { '0': 8.1, '1': 8.4, '2': 7.5 },
      };

      const result = deriveJudgeVotes(kataScores, 3);
      expect(result.akaFlags).toBe(2);
      expect(result.aoFlags).toBe(1);
      expect(result.judgeVotes).toEqual(['aka', 'ao', 'aka']);
    });

    it('determines 5-judge unanimous decision (5-0 Ao)', () => {
      const kataScores = {
        aka: { '0': 7.0, '1': 7.2, '2': 7.1, '3': 6.9, '4': 7.0 },
        ao:  { '0': 8.0, '1': 8.2, '2': 8.1, '3': 8.0, '4': 8.3 },
      };

      const result = deriveJudgeVotes(kataScores, 5);
      expect(result.akaFlags).toBe(0);
      expect(result.aoFlags).toBe(5);
      expect(result.judgeVotes).toEqual(['ao', 'ao', 'ao', 'ao', 'ao']);
    });

    it('handles incomplete voting without declaring phantom flags', () => {
      // Judge 0 submitted, judges 1 & 2 have not submitted yet
      const kataScores = {
        aka: { '0': 8.0, '1': null, '2': null },
        ao:  { '0': 7.5, '1': null, '2': null },
      };

      const result = deriveJudgeVotes(kataScores, 3);
      expect(result.akaFlags).toBe(1);
      expect(result.aoFlags).toBe(0);
      expect(result.judgeVotes).toEqual(['aka', null, null]);
    });

    it('identifies tie votes correctly', () => {
      const kataScores = {
        aka: { '0': 8.0, '1': 8.0, '2': 8.0 },
        ao:  { '0': 8.0, '1': 8.0, '2': 8.0 },
      };

      const result = deriveJudgeVotes(kataScores, 3);
      expect(result.judgeVotes).toEqual(['tie', 'tie', 'tie']);
      expect(result.akaFlags).toBe(0);
      expect(result.aoFlags).toBe(0);
    });
  });

  describe('Outlier Trimming (Dropping Highest & Lowest Score)', () => {
    it('drops highest and lowest score from 5 judges and calculates sum', () => {
      const judgeScores = [8.0, 9.2, 7.5, 8.4, 8.6]; // min: 7.5, max: 9.2
      const result = calculateTrimmedScore(judgeScores);

      expect(result.trimmed).toEqual([8.0, 8.4, 8.6]);
      expect(result.finalScore).toBe(25.0);
    });
  });

  describe('Kata Repetition Prohibition', () => {
    it('prohibits an athlete from repeating a previously performed kata', () => {
      const pastKatas = [6]; // 6: Bassai Dai
      const attemptRepeat = validateKataRepetition(pastKatas, 6);

      expect(attemptRepeat.allowed).toBe(false);
      expect(attemptRepeat.error).toContain('Bassai Dai');
    });

    it('allows an athlete to perform a fresh, unrepeated kata', () => {
      const pastKatas = [6]; // 6: Bassai Dai
      const attemptFresh = validateKataRepetition(pastKatas, 40); // 40: Kanku Dai

      expect(attemptFresh.allowed).toBe(true);
      expect(attemptFresh.error).toBeUndefined();
    });
  });
});
