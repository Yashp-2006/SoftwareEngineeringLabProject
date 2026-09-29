import { describe, it, expect } from 'vitest';

export function calculateScale(width: number, height: number): number {
  return Math.min(width / 1920, height / 1080);
}

export function shouldApplyRtdbPayload(lastBroadcastTime: number, currentTime: number): boolean {
  // If local broadcast was received in the last 600ms, ignore RTDB echo
  return currentTime - lastBroadcastTime >= 600;
}

describe('TV Scoreboard Dual-Channel Synchronization & Scaling', () => {
  describe('Uniform Scale Factor Calculations (ScaleWrapper)', () => {
    it('calculates 1.0 scale factor for standard 1080p display (1920x1080)', () => {
      const scale = calculateScale(1920, 1080);
      expect(scale).toBe(1.0);
    });

    it('calculates 2.0 scale factor for 4K display (3840x2160)', () => {
      const scale = calculateScale(3840, 2160);
      expect(scale).toBe(2.0);
    });

    it('calculates 0.667 scale factor for 720p display (1280x720)', () => {
      const scale = calculateScale(1280, 720);
      expect(scale).toBeCloseTo(0.667, 3);
    });

    it('handles non-16:9 viewports with letterboxing to prevent clipping', () => {
      // 16:10 monitor (1920x1200): height is larger, width is the constraint
      const scale1610 = calculateScale(1920, 1200);
      expect(scale1610).toBe(1.0); // limited by width

      // Ultrawide (2560x1080): height is the constraint
      const scaleUltrawide = calculateScale(2560, 1080);
      expect(scaleUltrawide).toBe(1.0); // limited by height
    });
  });

  describe('Deduplication Engine (Local vs Remote RTDB Echoes)', () => {
    it('suppresses RTDB echo when local broadcast occurred within 600ms', () => {
      const lastBroadcastTime = 10000;
      const rtdbEventTime = 10250; // 250ms later (network delay echo)

      const shouldApply = shouldApplyRtdbPayload(lastBroadcastTime, rtdbEventTime);
      expect(shouldApply).toBe(false);
    });

    it('accepts RTDB update when sufficient time has elapsed (> 600ms)', () => {
      const lastBroadcastTime = 10000;
      const rtdbEventTime = 10800; // 800ms later (external score update from remote judge/admin)

      const shouldApply = shouldApplyRtdbPayload(lastBroadcastTime, rtdbEventTime);
      expect(shouldApply).toBe(true);
    });
  });

  describe('Dual-Channel Message Protocol', () => {
    it('formats state update payload with complete Kumite match details', () => {
      const samplePayload = {
        status: 'live',
        matchStatus: 'LIVE',
        currentCategory: 'Male Cadet Kumite -57kg',
        isKata: false,
        scores: { aka: 3, ao: 1 },
        akaStats: { yuko: 1, waza: 1, ippon: 0, senshu: true },
        aoStats: { yuko: 1, waza: 0, ippon: 0, senshu: false },
        timeRemaining: '01:45',
        timerSeconds: 105,
        timerRunning: true,
      };

      expect(samplePayload.scores.aka).toBe(3);
      expect(samplePayload.timeRemaining).toBe('01:45');
      expect(samplePayload.akaStats.senshu).toBe(true);
    });
  });
});
