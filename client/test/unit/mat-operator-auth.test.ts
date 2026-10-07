import { describe, it, expect } from 'vitest';
import {
  normalizeMatKey,
  isMatSessionAuthorized,
  verifyMatStationPassword,
  canBypassMatGateway,
  generateMatStorageKeys,
} from '@/modules/auth/operator-auth';
import { hashPassword } from '@/lib/hash';

describe('Mat Operator Authentication & Station Password Gateway Specification', () => {

  describe('1. Mat Key & URL Parameter Normalization', () => {
    it('normalizes single digit "1" to "mat-1" and generates all storage aliases', () => {
      const result = normalizeMatKey('1');
      expect(result.normalizedMatId).toBe('mat-1');
      expect(result.matNum).toBe(1);
      expect(result.displayMatName).toBe('Mat 01');
    });

    it('normalizes "mat-1" and padded "mat-01"', () => {
      expect(normalizeMatKey('mat-1').normalizedMatId).toBe('mat-1');
      expect(normalizeMatKey('mat-01').normalizedMatId).toBe('mat-1');
      expect(normalizeMatKey('MAT 03').normalizedMatId).toBe('mat-3');
    });

    it('defaults to mat-1 when parameter is empty, null, or undefined', () => {
      expect(normalizeMatKey(null).normalizedMatId).toBe('mat-1');
      expect(normalizeMatKey(undefined).normalizedMatId).toBe('mat-1');
      expect(normalizeMatKey('').normalizedMatId).toBe('mat-1');
    });

    it('generates consistent storage keys across both operator portal and password gateway', () => {
      const keys = generateMatStorageKeys('comp-123', '1');
      expect(keys).toContain('auth_comp-123');
      expect(keys).toContain('auth_comp-123_mat-1');
      expect(keys).toContain('auth_comp-123_1');
      expect(keys).toContain('auth_comp-123_mat-01');
    });
  });

  describe('2. Session Authorization State Detection', () => {
    it('recognizes authorization when normalized key exists in storage', () => {
      const mockStorage: Record<string, string> = {
        'auth_comp-100_mat-1': 'true',
      };
      const isAuth = isMatSessionAuthorized('comp-100', '1', (k) => mockStorage[k] || null);
      expect(isAuth).toBe(true);
    });

    it('recognizes authorization when raw key "1" exists in storage', () => {
      const mockStorage: Record<string, string> = {
        'auth_comp-100_1': 'true',
      };
      const isAuth = isMatSessionAuthorized('comp-100', 'mat-1', (k) => mockStorage[k] || null);
      expect(isAuth).toBe(true);
    });

    it('recognizes authorization when competition master key exists in storage', () => {
      const mockStorage: Record<string, string> = {
        'auth_comp-100': 'true',
      };
      const isAuth = isMatSessionAuthorized('comp-100', 'mat-2', (k) => mockStorage[k] || null);
      expect(isAuth).toBe(true);
    });

    it('rejects authorization when storage is empty or false', () => {
      const mockStorage: Record<string, string> = {};
      const isAuth = isMatSessionAuthorized('comp-100', '1', (k) => mockStorage[k] || null);
      expect(isAuth).toBe(false);
    });
  });

  describe('3. Mat Operator Role & Assignment Gateway Bypass', () => {
    it('bypasses password prompt for admin and guest_viewer', () => {
      expect(canBypassMatGateway('admin')).toBe(true);
      expect(canBypassMatGateway('guest_viewer')).toBe(true);
    });

    it('bypasses password prompt for mat_operator role', () => {
      expect(canBypassMatGateway('mat_operator')).toBe(true);
    });

    it('bypasses password prompt when user has staff role "score"', () => {
      expect(canBypassMatGateway('viewer', 'score')).toBe(true);
    });

    it('requires password prompt for regular viewer or audience without staff assignment', () => {
      expect(canBypassMatGateway('viewer', null)).toBe(false);
      expect(canBypassMatGateway(null, null)).toBe(false);
    });
  });

  describe('4. Station Password Verification & Fallbacks', () => {
    it('accepts correct plain-text mat password', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'mat1password',
        matData: { password: 'mat1password', displayPassword: 'mat1password' },
      });
      expect(result.authorized).toBe(true);
    });

    it('accepts correct SHA-256 hashed mat password', async () => {
      const hash = await hashPassword('secureMat99');
      const result = await verifyMatStationPassword({
        enteredPassword: 'secureMat99',
        matData: { password: hash },
      });
      expect(result.authorized).toBe(true);
    });

    it('falls back to competition password if mat has no password configured', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'tournamentMaster2026',
        matData: { password: null, displayPassword: null }, // mat doc exists but has no password
        compData: { displayPassword: 'tournamentMaster2026' },
      });
      expect(result.authorized).toBe(true);
    });

    it('falls back to competition password if mat document is completely missing', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'tournamentMaster2026',
        matData: null,
        compData: { displayPassword: 'tournamentMaster2026' },
      });
      expect(result.authorized).toBe(true);
    });

    it('falls back to competition password if entered password matches tournament master password', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'tournamentMaster2026',
        matData: { password: 'matOnlyPass', displayPassword: 'matOnlyPass' },
        compData: { displayPassword: 'tournamentMaster2026' },
      });
      expect(result.authorized).toBe(true);
    });

    it('accepts 4-digit Staff PIN of assigned score operator', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: '4821',
        matData: null,
        compData: null,
        matNum: 1,
        assignedStaff: [
          { role: 'score', pin: '4821', assignedMats: ['1', 'mat-1'] },
          { role: 'attendance', pin: '9999', assignedMats: [] },
        ],
      });
      expect(result.authorized).toBe(true);
    });

    it('rejects incorrect password with informative error message', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'wrongPassword',
        matData: { displayPassword: 'correctPassword' },
        compData: { displayPassword: 'compPassword' },
      });
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('Incorrect password');
    });

    it('informs user if no password at all has been configured for tournament or mat', async () => {
      const result = await verifyMatStationPassword({
        enteredPassword: 'anyPassword',
        matData: null,
        compData: null,
        assignedStaff: [],
      });
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('No password has been set');
    });
  });
});
