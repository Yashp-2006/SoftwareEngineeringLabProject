import { describe, it, expect } from 'vitest';
import { 
  getNormalizedRole, 
  checkRouteAccess, 
  getSubNavVisibility, 
  canPerformAction,
  type RbacAction 
} from '@/modules/auth/rbac';
import type { UserRole } from '@taikaix/backend/types';

describe('TaikaiX Role-Based Access Control (RBAC) Specification', () => {

  describe('1. Role Normalization & DB Aliases', () => {
    it('normalizes valid primary role strings', () => {
      expect(getNormalizedRole('admin')).toBe('admin');
      expect(getNormalizedRole('guest_viewer')).toBe('guest_viewer');
      expect(getNormalizedRole('mat_operator')).toBe('mat_operator');
      expect(getNormalizedRole('attendance_volunteer')).toBe('attendance_volunteer');
      expect(getNormalizedRole('medal_distributor')).toBe('medal_distributor');
      expect(getNormalizedRole('judge')).toBe('judge');
      expect(getNormalizedRole('viewer')).toBe('viewer');
      expect(getNormalizedRole('audience')).toBe('viewer');
    });

    it('correctly maps staff sub-collection and UI aliases', () => {
      expect(getNormalizedRole('score')).toBe('mat_operator');
      expect(getNormalizedRole('mat')).toBe('mat_operator');
      expect(getNormalizedRole('operator')).toBe('mat_operator');
      expect(getNormalizedRole('attendance')).toBe('attendance_volunteer');
      expect(getNormalizedRole('medal')).toBe('medal_distributor');
      expect(getNormalizedRole('viewer')).toBe('viewer');
      expect(getNormalizedRole('guest_viewer')).toBe('guest_viewer');
      expect(getNormalizedRole('kata_judge')).toBe('judge');
    });

    it('distinguishes guest_viewer from normal viewer (audience)', () => {
      expect(getNormalizedRole('guest_viewer')).toBe('guest_viewer');
      expect(getNormalizedRole('viewer')).toBe('viewer');
      expect(getNormalizedRole('guest_viewer')).not.toBe(getNormalizedRole('viewer'));
    });

    it('handles case-insensitivity, whitespace and fallback for unknown roles', () => {
      expect(getNormalizedRole('  ADMIN  ')).toBe('admin');
      expect(getNormalizedRole('Score')).toBe('mat_operator');
      expect(getNormalizedRole('ATTENDANCE')).toBe('attendance_volunteer');
      // Unknown roles fallback safely to viewer (normal audience viewer)
      expect(getNormalizedRole('random_intruder')).toBe('viewer');
      // Empty or null defaults to viewer
      expect(getNormalizedRole(null)).toBe('viewer');
      expect(getNormalizedRole('')).toBe('viewer');
    });
  });

  describe('2. Global Route Authorization & Route Protection', () => {
    const mockUser = { uid: 'user_123' };

    describe('Unauthenticated Users (user === null)', () => {
      it('blocks access to strict admin routes and redirects to /login', () => {
        expect(checkRouteAccess('/setup/comp-1', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/users', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/profile', null, null)).toEqual({ allowed: false, redirect: '/login' });
      });

      it('blocks unauthenticated access to protected competition sub-pages', () => {
        expect(checkRouteAccess('/competitions/comp-1/staff', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/competitions/comp-1/judge', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/competitions/comp-1/athletes', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/competitions/comp-1/categories', null, null)).toEqual({ allowed: false, redirect: '/login' });
        expect(checkRouteAccess('/competitions/comp-1/records', null, null)).toEqual({ allowed: false, redirect: '/login' });
      });

      it('permits unauthenticated viewers onto public competition pages', () => {
        expect(checkRouteAccess('/competitions', null, null)).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-1', null, null)).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-1/bracket', null, null)).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-1/mats', null, null)).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-1/schedule', null, null)).toEqual({ allowed: true });
      });
    });

    describe('Authenticated Users & Redirections', () => {
      it('redirects admin and guest_viewer from /login to /dashboard', () => {
        expect(checkRouteAccess('/login', mockUser, 'admin')).toEqual({ allowed: false, redirect: '/dashboard' });
        expect(checkRouteAccess('/login', mockUser, 'guest_viewer')).toEqual({ allowed: false, redirect: '/dashboard' });
      });

      it('redirects staff and audience from /login to /competitions', () => {
        expect(checkRouteAccess('/login', mockUser, 'audience')).toEqual({ allowed: false, redirect: '/competitions' });
        expect(checkRouteAccess('/login', mockUser, 'mat_operator')).toEqual({ allowed: false, redirect: '/competitions' });
        expect(checkRouteAccess('/login', mockUser, 'attendance_volunteer')).toEqual({ allowed: false, redirect: '/competitions' });
        expect(checkRouteAccess('/login', mockUser, 'medal_distributor')).toEqual({ allowed: false, redirect: '/competitions' });
        expect(checkRouteAccess('/login', mockUser, 'judge')).toEqual({ allowed: false, redirect: '/competitions' });
      });

      it('prohibits non-admins from accessing /setup and /users', () => {
        const staffRoles: UserRole[] = ['mat_operator', 'attendance_volunteer', 'medal_distributor', 'judge', 'audience'];
        for (const role of staffRoles) {
          expect(checkRouteAccess('/setup/comp-1', mockUser, role)).toEqual({ allowed: false, redirect: '/competitions' });
          expect(checkRouteAccess('/users', mockUser, role)).toEqual({ allowed: false, redirect: '/competitions' });
        }
      });

      it('permits admin and guest_viewer on /setup and /users', () => {
        expect(checkRouteAccess('/setup/comp-1', mockUser, 'admin')).toEqual({ allowed: true });
        expect(checkRouteAccess('/setup/comp-1', mockUser, 'guest_viewer')).toEqual({ allowed: true });
        expect(checkRouteAccess('/users', mockUser, 'admin')).toEqual({ allowed: true });
        expect(checkRouteAccess('/users', mockUser, 'guest_viewer')).toEqual({ allowed: true });
      });

      it('prohibits audience role from entering /judge and redirects to competition overview', () => {
        expect(checkRouteAccess('/competitions/comp-42/judge', mockUser, 'audience')).toEqual({
          allowed: false,
          redirect: '/competitions/comp-42'
        });
      });

      it('allows judge and admin onto /judge', () => {
        expect(checkRouteAccess('/competitions/comp-42/judge', mockUser, 'judge')).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-42/judge', mockUser, 'admin')).toEqual({ allowed: true });
        expect(checkRouteAccess('/competitions/comp-42/judge', mockUser, 'guest_viewer')).toEqual({ allowed: true });
      });
    });
  });

  describe('3. Competition Sub-Navigation Tab Visibility Matrix', () => {
    it('shows public tabs (Overview, Tiesheet, Mats, Schedule) to EVERY role', () => {
      const allRoles: (UserRole | null)[] = [
        'admin',
        'guest_viewer',
        'mat_operator',
        'attendance_volunteer',
        'medal_distributor',
        'judge',
        'viewer',
        'audience',
        null
      ];

      for (const role of allRoles) {
        const nav = getSubNavVisibility(role);
        expect(nav.showOverview, `Overview failed for ${role}`).toBe(true);
        expect(nav.showTiesheet, `Tiesheet failed for ${role}`).toBe(true);
        expect(nav.showMats, `Mats failed for ${role}`).toBe(true);
        expect(nav.showSchedule, `Schedule failed for ${role}`).toBe(true);
      }
    });

    it('enforces Admin full tab visibility', () => {
      const nav = getSubNavVisibility('admin');
      expect(nav.showCategories).toBe(true);
      expect(nav.showStaff).toBe(true);
      expect(nav.showRecords).toBe(true);
      expect(nav.showAthletes).toBe(true);
      expect(nav.showMedals).toBe(true);
      expect(nav.showOperator).toBe(true);
      expect(nav.showJudge).toBe(true);
    });

    it('enforces Guest Viewer visibility matching Admin', () => {
      const nav = getSubNavVisibility('guest_viewer');
      expect(nav.showCategories).toBe(true);
      expect(nav.showStaff).toBe(true);
      expect(nav.showRecords).toBe(true);
      expect(nav.showAthletes).toBe(true);
      expect(nav.showMedals).toBe(true);
      expect(nav.showOperator).toBe(true);
      expect(nav.showJudge).toBe(true);
    });

    it('enforces Mat Operator tab isolation', () => {
      const nav = getSubNavVisibility('mat_operator');
      expect(nav.showOperator).toBe(true);
      expect(nav.showCategories).toBe(false);
      expect(nav.showStaff).toBe(false);
      expect(nav.showRecords).toBe(false);
      expect(nav.showAthletes).toBe(false);
      expect(nav.showMedals).toBe(false);
      expect(nav.showJudge).toBe(false);
    });

    it('enforces Attendance Volunteer tab isolation', () => {
      const nav = getSubNavVisibility('attendance_volunteer');
      expect(nav.showAthletes).toBe(true);
      expect(nav.showCategories).toBe(false);
      expect(nav.showStaff).toBe(false);
      expect(nav.showRecords).toBe(false);
      expect(nav.showOperator).toBe(false);
      expect(nav.showMedals).toBe(false);
      expect(nav.showJudge).toBe(false);
    });

    it('enforces Medal Distributor tab isolation', () => {
      const nav = getSubNavVisibility('medal_distributor');
      expect(nav.showMedals).toBe(true);
      expect(nav.showCategories).toBe(false);
      expect(nav.showStaff).toBe(false);
      expect(nav.showRecords).toBe(false);
      expect(nav.showAthletes).toBe(false);
      expect(nav.showOperator).toBe(false);
      expect(nav.showJudge).toBe(false);
    });

    it('enforces Judge tab isolation', () => {
      const nav = getSubNavVisibility('judge');
      expect(nav.showJudge).toBe(true);
      expect(nav.showCategories).toBe(false);
      expect(nav.showStaff).toBe(false);
      expect(nav.showRecords).toBe(false);
      expect(nav.showAthletes).toBe(false);
      expect(nav.showMedals).toBe(false);
      expect(nav.showOperator).toBe(false);
    });

    it('enforces Audience / Unauthenticated tab restriction (all staff tabs hidden)', () => {
      for (const role of ['audience', null] as const) {
        const nav = getSubNavVisibility(role);
        expect(nav.showCategories).toBe(false);
        expect(nav.showStaff).toBe(false);
        expect(nav.showRecords).toBe(false);
        expect(nav.showAthletes).toBe(false);
        expect(nav.showMedals).toBe(false);
        expect(nav.showOperator).toBe(false);
        expect(nav.showJudge).toBe(false);
      }
    });

    it('resolves tournament-specific staff assignments when global role is audience', () => {
      // User is globally audience, but assigned 'score' staff role for this competition
      const scoreStaff = getSubNavVisibility('audience', 'score');
      expect(scoreStaff.showOperator).toBe(true);
      expect(scoreStaff.showCategories).toBe(false);

      // User assigned 'attendance'
      const attendanceStaff = getSubNavVisibility('audience', 'attendance');
      expect(attendanceStaff.showAthletes).toBe(true);

      // User assigned 'medal'
      const medalStaff = getSubNavVisibility('audience', 'medal');
      expect(medalStaff.showMedals).toBe(true);

      // User assigned 'judge'
      const judgeStaff = getSubNavVisibility('audience', 'judge');
      expect(judgeStaff.showJudge).toBe(true);
    });
  });

  describe('4. Action-Level Operational Permissions Matrix', () => {
    it('restricts bracket re-seeding and drag-and-drop to Admin only', () => {
      expect(canPerformAction('drag_and_drop_tiesheet', 'admin')).toBe(true);
      expect(canPerformAction('drag_and_drop_tiesheet', 'guest_viewer')).toBe(false);
      expect(canPerformAction('drag_and_drop_tiesheet', 'mat_operator')).toBe(false);
      expect(canPerformAction('drag_and_drop_tiesheet', 'judge')).toBe(false);
      expect(canPerformAction('drag_and_drop_tiesheet', 'audience')).toBe(false);
    });

    it('restricts mat takeover/override and mat config to Admin only', () => {
      expect(canPerformAction('seize_mat_override', 'admin')).toBe(true);
      expect(canPerformAction('seize_mat_override', 'mat_operator')).toBe(false);
      expect(canPerformAction('seize_mat_override', 'guest_viewer')).toBe(false);

      expect(canPerformAction('configure_mats', 'admin')).toBe(true);
      expect(canPerformAction('configure_mats', 'guest_viewer')).toBe(false);
    });

    it('allows Kata Flag voting only to Judge, Admin, or assigned Judge staff', () => {
      expect(canPerformAction('submit_kata_vote', 'judge')).toBe(true);
      expect(canPerformAction('submit_kata_vote', 'admin')).toBe(true);
      expect(canPerformAction('submit_kata_vote', 'audience', 'judge')).toBe(true);

      // Guest viewer is view-only, cannot vote
      expect(canPerformAction('submit_kata_vote', 'guest_viewer')).toBe(false);
      // Other roles cannot vote
      expect(canPerformAction('submit_kata_vote', 'mat_operator')).toBe(false);
      expect(canPerformAction('submit_kata_vote', 'attendance_volunteer')).toBe(false);
      expect(canPerformAction('submit_kata_vote', 'audience')).toBe(false);
    });

    it('allows athlete attendance and DQ only to Attendance Volunteer, Admin, or assigned staff', () => {
      expect(canPerformAction('mark_athlete_attendance', 'admin')).toBe(true);
      expect(canPerformAction('mark_athlete_attendance', 'attendance_volunteer')).toBe(true);
      expect(canPerformAction('mark_athlete_attendance', 'audience', 'attendance')).toBe(true);

      expect(canPerformAction('disqualify_athlete', 'admin')).toBe(true);
      expect(canPerformAction('disqualify_athlete', 'attendance_volunteer')).toBe(true);
      expect(canPerformAction('disqualify_athlete', 'audience', 'attendance')).toBe(true);

      expect(canPerformAction('mark_athlete_attendance', 'guest_viewer')).toBe(false);
      expect(canPerformAction('mark_athlete_attendance', 'mat_operator')).toBe(false);
      expect(canPerformAction('mark_athlete_attendance', 'audience')).toBe(false);
    });

    it('allows medal distribution only to Medal Distributor, Admin, or assigned staff', () => {
      expect(canPerformAction('mark_medal_received', 'admin')).toBe(true);
      expect(canPerformAction('mark_medal_received', 'medal_distributor')).toBe(true);
      expect(canPerformAction('mark_medal_received', 'audience', 'medal')).toBe(true);

      expect(canPerformAction('mark_medal_received', 'guest_viewer')).toBe(false);
      expect(canPerformAction('mark_medal_received', 'judge')).toBe(false);
      expect(canPerformAction('mark_medal_received', 'audience')).toBe(false);
    });
  });

  describe('5. Zero-Write Safety for Guest Viewer', () => {
    it('guarantees Guest Viewer cannot perform ANY write actions despite broad viewing permissions', () => {
      const allActions: RbacAction[] = [
        'drag_and_drop_tiesheet',
        'seize_mat_override',
        'submit_kata_vote',
        'mark_athlete_attendance',
        'disqualify_athlete',
        'mark_medal_received',
        'configure_mats'
      ];

      for (const action of allActions) {
        expect(canPerformAction(action, 'guest_viewer'), `Action ${action} should be prohibited for guest_viewer`).toBe(false);
      }
    });
  });
});
