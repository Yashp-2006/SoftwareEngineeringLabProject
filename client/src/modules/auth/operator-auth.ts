import { verifyPassword } from '@/lib/hash';

export interface MatKeyInfo {
  normalizedMatId: string; // e.g. 'mat-1'
  matNum: number;          // e.g. 1
  displayMatName: string;  // e.g. 'Mat 01'
  rawParam: string;
}

/**
 * Normalizes any mat parameter representation ('1', 'mat-1', 'mat-01', 'MAT 01', null)
 * into a canonical, predictable format.
 */
export function normalizeMatKey(matParam: string | null | undefined): MatKeyInfo {
  const rawParam = (matParam || '').trim();
  const digits = rawParam.replace(/\D/g, '');
  const matNum = digits ? parseInt(digits, 10) : 1;
  const safeNum = Math.max(1, isNaN(matNum) ? 1 : matNum);
  const normalizedMatId = `mat-${safeNum}`;
  const displayMatName = `Mat ${String(safeNum).padStart(2, '0')}`;

  return {
    normalizedMatId,
    matNum: safeNum,
    displayMatName,
    rawParam,
  };
}

/**
 * Generates all compatible storage keys for a competition mat session.
 * Guarantees that regardless of whether a page wrote 'auth_comp_1',
 * 'auth_comp_mat-1', or 'auth_comp', any component will find the auth state.
 */
export function generateMatStorageKeys(compId: string, matParam: string | null | undefined): string[] {
  const { normalizedMatId, matNum, rawParam } = normalizeMatKey(matParam);
  const keys = new Set<string>();

  // Master competition authorization
  keys.add(`auth_${compId}`);

  // Normalized key
  keys.add(`auth_${compId}_${normalizedMatId}`);

  // Raw parameter key (if provided)
  if (rawParam) {
    keys.add(`auth_${compId}_${rawParam}`);
  }

  // Integer key ('auth_comp_1')
  keys.add(`auth_${compId}_${matNum}`);

  // Padded key ('auth_comp_mat-01')
  keys.add(`auth_${compId}_mat-${String(matNum).padStart(2, '0')}`);

  return Array.from(keys);
}

/**
 * Checks if the mat session has been authorized in sessionStorage.
 */
export function isMatSessionAuthorized(
  compId: string,
  matParam: string | null | undefined,
  storageGetter: (key: string) => string | null
): boolean {
  if (!compId) return false;
  const keys = generateMatStorageKeys(compId, matParam);
  return keys.some((k) => storageGetter(k) === 'true');
}

/**
 * Persists authorization across all key aliases into storage.
 */
export function persistMatSessionAuthorization(
  compId: string,
  matParam: string | null | undefined,
  storageSetter: (key: string, value: string) => void
): void {
  const keys = generateMatStorageKeys(compId, matParam);
  for (const k of keys) {
    storageSetter(k, 'true');
  }
}

/**
 * Determines if user's role or staff assignment allows direct entry without password prompt.
 */
export function canBypassMatGateway(
  userRole?: string | null,
  staffRole?: string | null
): boolean {
  const role = (userRole || '').toLowerCase().trim();
  const sRole = (staffRole || '').toLowerCase().trim();

  // Full administrative or viewer bypass
  if (role === 'admin' || role === 'guest_viewer') return true;

  // Dedicated mat operator global role
  if (role === 'mat_operator' || role === 'score') return true;

  // Staff assignment role
  if (sRole === 'score' || sRole === 'mat_operator') return true;

  return false;
}

export interface MatPasswordVerificationParams {
  enteredPassword: string;
  matData?: {
    password?: string | null;
    displayPassword?: string | null;
  } | null;
  compData?: {
    password?: string | null;
    displayPassword?: string | null;
    matPasswords?: Record<string, string> | null;
  } | null;
  matNum?: number | null;
  assignedStaff?: Array<{
    pin?: string | null;
    role?: string | null;
    assignedMats?: string[];
  }> | null;
}

/**
 * Verifies entered password against mat, competition, or staff credentials with graceful fallbacks.
 */
export async function verifyMatStationPassword(
  params: MatPasswordVerificationParams
): Promise<{ authorized: boolean; reason?: string }> {
  const entered = (params.enteredPassword || '').trim();
  if (!entered) {
    return { authorized: false, reason: 'Please enter the password.' };
  }

  const { matData, compData, assignedStaff, matNum } = params;

  // 1. Check mat-specific password (plain text or hash)
  if (matData) {
    const raw = matData.password;
    const display = matData.displayPassword;
    const actual = display || raw;

    if (actual !== undefined && actual !== null && String(actual).trim() !== '') {
      const actStr = String(actual).trim();
      if (entered === actStr || (display && entered === String(display).trim())) {
        return { authorized: true };
      }
      if (raw && (await verifyPassword(entered, raw))) {
        return { authorized: true };
      }
    }
  }

  // 2. Check competition-level dictionary of mat passwords (e.g. compData.matPasswords)
  if (compData?.matPasswords && matNum !== null && matNum !== undefined) {
    const dictPass =
      compData.matPasswords[`mat-${matNum}`] ||
      compData.matPasswords[String(matNum)] ||
      compData.matPasswords[`mat-${String(matNum).padStart(2, '0')}`];
    if (dictPass) {
      if (entered === String(dictPass).trim() || (await verifyPassword(entered, dictPass))) {
        return { authorized: true };
      }
    }
  }

  // 3. Fallback: Check general tournament / competition password
  if (compData) {
    const compRaw = compData.password;
    const compDisplay = compData.displayPassword;
    const compActual = compDisplay || compRaw;

    if (compActual !== undefined && compActual !== null && String(compActual).trim() !== '') {
      const compStr = String(compActual).trim();
      if (entered === compStr || (compDisplay && entered === String(compDisplay).trim())) {
        return { authorized: true };
      }
      if (compRaw && (await verifyPassword(entered, compRaw))) {
        return { authorized: true };
      }
    }
  }

  // 4. Fallback: Check assigned staff PIN for this mat
  if (assignedStaff && assignedStaff.length > 0) {
    const matIdStr = matNum !== null && matNum !== undefined ? String(matNum) : '1';
    const matKeyNorm = `mat-${matIdStr}`;

    const matchingStaff = assignedStaff.find((s) => {
      const isScore = s.role === 'score' || s.role === 'mat_operator';
      const isAssigned =
        !s.assignedMats ||
        s.assignedMats.length === 0 ||
        s.assignedMats.some(
          (m) =>
            m === matIdStr ||
            m === matKeyNorm ||
            parseInt(m.replace(/\D/g, '') || '0', 10) === matNum
        );
      return isScore && isAssigned && s.pin === entered;
    });

    if (matchingStaff) {
      return { authorized: true };
    }
  }

  // 5. If no passwords configured anywhere
  const hasAnyPassword =
    Boolean(matData?.displayPassword || matData?.password) ||
    Boolean(compData?.displayPassword || compData?.password) ||
    Boolean(assignedStaff && assignedStaff.some((s) => s.pin));

  if (!hasAnyPassword) {
    return {
      authorized: false,
      reason: 'No password has been set for this mat or tournament yet. Configure it in Mats Setup.',
    };
  }

  return {
    authorized: false,
    reason: 'Incorrect password for this mat.',
  };
}
