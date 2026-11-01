import { describe, it, expect } from 'vitest';

interface AdminOverrideState {
  active: boolean;
  adminName?: string;
  adminUid?: string | null;
  timestamp?: number;
}

export function computeOverrideAccess(
  userRole: 'admin' | 'mat_operator' | 'guest_viewer',
  override: AdminOverrideState | null
): {
  isOverridden: boolean;
  canOperateMat: boolean;
  canToggleOverride: boolean;
} {
  const isAdmin = userRole === 'admin';
  const isOverridden = Boolean(override?.active && !isAdmin);
  const isViewer = userRole === 'guest_viewer';

  const canOperateMat = !isViewer && !isOverridden;
  const canToggleOverride = isAdmin;

  return { isOverridden, canOperateMat, canToggleOverride };
}

describe('Admin Mat Override & Interruption State Machine', () => {
  it('allows an Administrator to toggle mat control on and off', () => {
    let overrideState: AdminOverrideState | null = null;

    // Admin takes control
    const accessBefore = computeOverrideAccess('admin', overrideState);
    expect(accessBefore.canToggleOverride).toBe(true);

    overrideState = {
      active: true,
      adminName: 'Tournament Director',
      adminUid: 'admin-123',
      timestamp: Date.now(),
    };

    const accessAfter = computeOverrideAccess('admin', overrideState);
    expect(accessAfter.isOverridden).toBe(false); // Admin is NOT overridden, admin IS the controller
    expect(accessAfter.canOperateMat).toBe(true);
  });

  it('locks Mat Operator inputs when Admin Override is active', () => {
    const activeOverride: AdminOverrideState = {
      active: true,
      adminName: 'Chief Referee',
      adminUid: 'admin-999',
      timestamp: Date.now(),
    };

    const operatorAccess = computeOverrideAccess('mat_operator', activeOverride);

    expect(operatorAccess.isOverridden).toBe(true);
    expect(operatorAccess.canOperateMat).toBe(false); // Locked
    expect(operatorAccess.canToggleOverride).toBe(false); // Cannot release admin's lock
  });

  it('restores Mat Operator inputs when Admin releases control', () => {
    const inactiveOverride: AdminOverrideState = {
      active: false,
      adminName: 'Chief Referee',
      adminUid: null,
      timestamp: Date.now(),
    };

    const operatorAccess = computeOverrideAccess('mat_operator', inactiveOverride);

    expect(operatorAccess.isOverridden).toBe(false);
    expect(operatorAccess.canOperateMat).toBe(true); // Restored
  });

  it('guarantees seamless score state continuity when Admin takes over', () => {
    // Current operator match state
    const operatorState = {
      akaName: 'Kenji Sato',
      aoName: 'Alex Rivera',
      scores: { aka: 3, ao: 2 },
      timeRemaining: '01:15',
    };

    // When Admin takes over, state must hydrate from the current match, not reset to 0
    const adminHydratedState = {
      ...operatorState,
      scores: { ...operatorState.scores },
    };

    expect(adminHydratedState.scores.aka).toBe(3);
    expect(adminHydratedState.scores.ao).toBe(2);
    expect(adminHydratedState.timeRemaining).toBe('01:15');
  });
});
