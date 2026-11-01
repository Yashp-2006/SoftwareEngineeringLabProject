import type { UserRole } from '@taikaix/backend/types';

export const ROLE_ALIASES: Record<string, UserRole> = {
  admin: 'admin',
  score: 'mat_operator',
  mat: 'mat_operator',
  mat_operator: 'mat_operator',
  operator: 'mat_operator',
  attendance: 'attendance_volunteer',
  attendance_volunteer: 'attendance_volunteer',
  medal: 'medal_distributor',
  medal_distributor: 'medal_distributor',
  judge: 'judge',
  kata_judge: 'judge',
  guest_viewer: 'guest_viewer',
  guest: 'guest_viewer',
  viewer: 'viewer',
  audience: 'viewer',
};

/**
 * Normalizes any role string / alias into canonical UserRole
 */
export function getNormalizedRole(rawRole?: string | null): UserRole {
  if (!rawRole) return 'viewer';
  const lower = rawRole.toLowerCase().trim();
  return ROLE_ALIASES[lower] || 'viewer';
}

export interface SubNavVisibility {
  showOverview: boolean;
  showTiesheet: boolean;
  showMats: boolean;
  showSchedule: boolean;
  showCategories: boolean;
  showStaff: boolean;
  showAthletes: boolean;
  showRecords: boolean;
  showMedals: boolean;
  showOperator: boolean;
  showJudge: boolean;
}

/**
 * Determines competition sub-navigation tab visibility based on global role & competition staff assignment
 */
export function getSubNavVisibility(
  role: UserRole | string | null,
  staffRole?: string | null
): SubNavVisibility {
  const normRole = role ? getNormalizedRole(role) : null;
  const isAdminOrGuest = normRole === 'admin' || normRole === 'guest_viewer';

  return {
    showOverview: true,
    showTiesheet: true,
    showMats: true,
    showSchedule: true,
    showCategories: isAdminOrGuest,
    showStaff: isAdminOrGuest,
    showRecords: isAdminOrGuest,
    showAthletes: isAdminOrGuest || normRole === 'attendance_volunteer' || staffRole === 'attendance',
    showMedals: isAdminOrGuest || normRole === 'medal_distributor' || staffRole === 'medal',
    showOperator: isAdminOrGuest || normRole === 'mat_operator' || staffRole === 'score',
    showJudge: isAdminOrGuest || normRole === 'judge' || staffRole === 'judge',
  };
}

export type RouteAccessResult = 
  | { allowed: true }
  | { allowed: false; redirect: string };

/**
 * Pure route authorization checker mirroring AuthProvider logic
 */
export function checkRouteAccess(
  pathname: string,
  user: { uid: string } | null,
  rawRole: UserRole | string | null
): RouteAccessResult {
  const isStrictAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users') || pathname.startsWith('/profile');
  const isProtectedCompetitionRoute = 
    pathname.includes('/staff') || 
    pathname.includes('/judge') || 
    pathname.includes('/athletes') || 
    pathname.includes('/records') || 
    pathname.includes('/categories');

  // 1. Unauthenticated users
  if (!user) {
    if (isStrictAdminRoute || isProtectedCompetitionRoute) {
      return { allowed: false, redirect: '/login' };
    }
    return { allowed: true };
  }

  // 2. Authenticated users
  const role = getNormalizedRole(rawRole);
  const isAdminOrGuest = role === 'admin' || role === 'guest_viewer';

  // Login page redirect for logged-in users
  if (pathname === '/login') {
    const destination = isAdminOrGuest ? '/dashboard' : '/competitions';
    return { allowed: false, redirect: destination };
  }

  // Strict admin routes (/setup, /users)
  const isAdminRoute = pathname.startsWith('/setup') || pathname.startsWith('/users');
  if (isAdminRoute && !isAdminOrGuest) {
    return { allowed: false, redirect: '/competitions' };
  }

  // Pure route authorization check for viewer / audience on /judge
  if (pathname.includes('/judge') && role === 'viewer') {
    const compMatch = pathname.match(/\/competitions\/([^/]+)/);
    const compId = compMatch ? compMatch[1] : '';
    return { allowed: false, redirect: compId ? `/competitions/${compId}` : '/competitions' };
  }

  return { allowed: true };
}

export type RbacAction = 
  | 'drag_and_drop_tiesheet'
  | 'seize_mat_override'
  | 'submit_kata_vote'
  | 'mark_athlete_attendance'
  | 'disqualify_athlete'
  | 'mark_medal_received'
  | 'configure_mats';

/**
 * Checks if user has permission to execute specific operational actions
 */
export function canPerformAction(
  action: RbacAction,
  role: UserRole | string | null,
  staffRole?: string | null
): boolean {
  const normRole = role ? getNormalizedRole(role) : null;
  const isAdmin = normRole === 'admin';

  switch (action) {
    case 'drag_and_drop_tiesheet':
    case 'seize_mat_override':
    case 'configure_mats':
      return isAdmin;

    case 'submit_kata_vote':
      // Judges and Admins can vote; guest_viewer has zero writes
      return isAdmin || normRole === 'judge' || staffRole === 'judge';

    case 'mark_athlete_attendance':
    case 'disqualify_athlete':
      return isAdmin || normRole === 'attendance_volunteer' || staffRole === 'attendance';

    case 'mark_medal_received':
      return isAdmin || normRole === 'medal_distributor' || staffRole === 'medal';

    default:
      return false;
  }
}
