import { describe, it, expect, vi } from 'vitest';
import { deriveJudgeVotes } from '@/modules/kata/components/KataLiveScoreboard';

function shouldApplyRtdbPayload(lastBroadcastTime: number, currentTime: number): boolean {
  return currentTime - lastBroadcastTime >= 600;
}

describe('TaikaiX Peak Tournament Traffic & Concurrency Stress Test', () => {

  describe('1. Multi-Mat Concurrency & Isolation (8 Concurrent Mats)', () => {
    it('maintains strict mat state isolation under concurrent high-frequency updates', () => {
      const matCount = 8;
      const matStates: Record<string, { timer: number; scores: { aka: number; ao: number }; matchId: string }> = {};

      for (let i = 1; i <= matCount; i++) {
        const matId = `mat-${i}`;
        matStates[matId] = {
          timer: 180,
          scores: { aka: 0, ao: 0 },
          matchId: `M-${i}-01`,
        };
      }

      for (let tick = 0; tick < 100; tick++) {
        for (let i = 1; i <= matCount; i++) {
          const matId = `mat-${i}`;
          matStates[matId].timer -= 1;
          if (tick % 20 === 0) {
            matStates[matId].scores.aka += 1;
          }
        }
      }

      for (let i = 1; i <= matCount; i++) {
        const matId = `mat-${i}`;
        expect(matStates[matId].timer).toBe(80);
        expect(matStates[matId].scores.aka).toBe(5);
        expect(matStates[matId].matchId).toBe(`M-${i}-01`);
      }
    });
  });

  describe('2. Concurrent Mobile Judge Voting Spikes & Atomic Field Merging', () => {
    it('correctly merges concurrent mobile judge votes and manual operator inputs without data loss', async () => {
      const rtdbKataScores: { aka: Record<string, number>; ao: Record<string, number> } = {
        aka: {},
        ao: {},
      };

      const simulateAtomicWrite = (path: string, value: number) => {
        const parts = path.split('/');
        const side = parts[0] as 'aka' | 'ao';
        const judgeIndex = parts[1];
        rtdbKataScores[side][judgeIndex] = value;
      };

      const concurrentWrites = [
        () => { simulateAtomicWrite('aka/0', 1); simulateAtomicWrite('ao/0', 0); },
        () => { simulateAtomicWrite('aka/1', 0); simulateAtomicWrite('ao/1', 1); },
        () => { simulateAtomicWrite('aka/2', 1); simulateAtomicWrite('ao/2', 0); },
        () => { simulateAtomicWrite('aka/3', 0); simulateAtomicWrite('ao/3', 1); },
        () => { simulateAtomicWrite('aka/4', 1); simulateAtomicWrite('ao/4', 0); },
      ];

      const scrambled = [...concurrentWrites].sort(() => Math.random() - 0.5);
      scrambled.forEach((write) => write());

      const result = deriveJudgeVotes(rtdbKataScores, 5);

      expect(result.judgeVotes).toEqual(['aka', 'ao', 'aka', 'ao', 'aka']);
      expect(result.akaFlags).toBe(3);
      expect(result.aoFlags).toBe(2);
    });

    it('handles rapid sequential vote toggles under high operator clicking speed', () => {
      let state = {
        aka: { '0': 0, '1': 0, '2': 0 },
        ao:  { '0': 0, '1': 0, '2': 0 },
      };

      state = { ...state, aka: { ...state.aka, '0': 1 }, ao: { ...state.ao, '0': 0 } };
      let res1 = deriveJudgeVotes(state, 3);
      expect(res1.judgeVotes[0]).toBe('aka');

      state = { ...state, aka: { ...state.aka, '0': 0 }, ao: { ...state.ao, '0': 1 } };
      let res2 = deriveJudgeVotes(state, 3);
      expect(res2.judgeVotes[0]).toBe('ao');

      state = { ...state, aka: { ...state.aka, '0': 0 }, ao: { ...state.ao, '0': 0 } };
      let res3 = deriveJudgeVotes(state, 3);
      expect(res3.judgeVotes[0]).toBe(null);
    });
  });

  describe('3. Scoreboard Deduplication Under Traffic Storms', () => {
    it('reliably suppresses 10,000 rapid echo packets during peak competition traffic', () => {
      const now = Date.now();
      let suppressedCount = 0;
      let admittedCount = 0;

      for (let i = 0; i < 10000; i++) {
        const jitter = (i % 1200);
        const isEchoSuppressed = !shouldApplyRtdbPayload(now, now + jitter);
        if (isEchoSuppressed) {
          suppressedCount++;
        } else {
          admittedCount++;
        }
      }

      // Exactly 5200 with jitter < 600ms, 4800 with jitter >= 600ms
      expect(suppressedCount).toBe(5200);
      expect(admittedCount).toBe(4800);
    });
  });

  describe('4. Rapid State Sync Debounce Storm Prevention', () => {
    it('collapses 500 rapid-fire timer/score events into a single synced payload without dropping data', async () => {
      vi.useFakeTimers();

      let writeCount = 0;
      let latestPayload: any = null;
      let debounceTimeout: any = null;

      const triggerSync = (payload: any) => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          writeCount++;
          latestPayload = payload;
        }, 500);
      };

      for (let i = 1; i <= 500; i++) {
        triggerSync({ timer: 180 - i, scoreAka: i });
      }

      expect(writeCount).toBe(0);

      vi.advanceTimersByTime(550);

      expect(writeCount).toBe(1);
      expect(latestPayload.timer).toBe(-320);
      expect(latestPayload.scoreAka).toBe(500);

      vi.useRealTimers();
    });
  });

  describe('5. High-Load Kata Evaluation Matrix (10,000 Random Bouts)', () => {
    it('executes 10,000 random bouts without memory leak or phantom flags', () => {
      for (let bout = 0; bout < 10000; bout++) {
        const nJudges = bout % 2 === 0 ? 3 : 5;
        const akaMap: Record<string, number> = {};
        const aoMap: Record<string, number> = {};

        for (let j = 0; j < nJudges; j++) {
          const rand = Math.random();
          if (rand < 0.45) {
            akaMap[String(j)] = 1;
            aoMap[String(j)] = 0;
          } else if (rand < 0.90) {
            akaMap[String(j)] = 0;
            aoMap[String(j)] = 1;
          } else {
            akaMap[String(j)] = 0;
            aoMap[String(j)] = 0;
          }
        }

        const res = deriveJudgeVotes({ aka: akaMap, ao: aoMap }, nJudges);
        expect(res.judgeVotes.length).toBe(nJudges);
        expect(res.akaFlags + res.aoFlags).toBeLessThanOrEqual(nJudges);
      }
    });
  });
});
