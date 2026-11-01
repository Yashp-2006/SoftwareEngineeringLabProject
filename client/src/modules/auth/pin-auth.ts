import type { UserRole } from '@taikaix/backend/types';

export interface StaffRosterRecord {
  id: string;
  name: string;
  role: 'score' | 'attendance' | 'medal' | 'judge' | string;
  pin?: string;
  email?: string;
  assignedMats?: string[];
  assignedCategories?: string[];
  assignedPools?: string[];
  approvalStatus?: 'approved' | 'pending' | 'declined' | null;
  userId?: string;
}

/**
 * Generates deterministic Firebase Auth credentials for a PIN-authenticated staff member.
 * Eliminates anonymous sessions while requiring zero personal email or complex passwords.
 */
export function generateStaffCredentials(staffId: string): { staffEmail: string; staffPassword: string } {
  const cleanStaffId = staffId.replace(/[^a-zA-Z0-9]/g, '');
  return {
    staffEmail: `staff.${cleanStaffId}@taikaix.app`,
    staffPassword: `TaikaiX#Staff#${cleanStaffId}`,
  };
}

/**
 * Maps competition staff sub-collection role identifiers to application UserRoles
 */
export function mapStaffRoleToUserRole(role?: string | null): UserRole {
  if (!role) return 'viewer';
  const lower = role.toLowerCase().trim();
  switch (lower) {
    case 'score':
    case 'mat':
    case 'mat_operator':
      return 'mat_operator';
    case 'attendance':
    case 'attendance_volunteer':
      return 'attendance_volunteer';
    case 'medal':
    case 'medal_distributor':
      return 'medal_distributor';
    case 'judge':
    case 'kata_judge':
      return 'judge';
    case 'guest':
    case 'guest_viewer':
      return 'guest_viewer';
    case 'viewer':
    case 'audience':
      return 'viewer';
    default:
      return 'viewer';
  }
}

/**
 * Resolves the destination URL for a staff member based on role & assignments
 */
export function resolveStaffRedirectUrl(
  compId: string,
  staffMember: Pick<StaffRosterRecord, 'role' | 'assignedMats'>
): string {
  if (staffMember.role === 'score' && staffMember.assignedMats && staffMember.assignedMats.length > 0) {
    return `/competitions/${compId}/operator?mat=${staffMember.assignedMats[0]}`;
  }
  if (staffMember.role === 'attendance') {
    return `/competitions/${compId}/athletes`;
  }
  if (staffMember.role === 'judge') {
    return `/competitions/${compId}/judge`;
  }
  if (staffMember.role === 'medal') {
    return `/competitions/${compId}/medals`;
  }
  return `/competitions/${compId}`;
}

/**
 * Validates PIN verification attempt against roster record
 */
export function verifyStaffPin(
  staffMember: StaffRosterRecord | undefined,
  inputPin: string
): { success: true } | { success: false; error: string } {
  if (!staffMember) {
    return { success: false, error: 'Please select your profile.' };
  }
  if (!staffMember.pin) {
    return { success: false, error: 'No PIN is configured for this staff member.' };
  }
  if (staffMember.pin !== inputPin) {
    return { success: false, error: 'Invalid PIN code.' };
  }
  return { success: true };
}

/**
 * Checks email match across roster
 */
export function findStaffByEmail(
  staffList: StaffRosterRecord[],
  email: string | null | undefined
): StaffRosterRecord | null {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  return staffList.find(s => s.email && s.email.toLowerCase().trim() === cleanEmail) || null;
}
