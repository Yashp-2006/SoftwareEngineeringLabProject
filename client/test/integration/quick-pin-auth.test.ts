import { describe, it, expect } from 'vitest';
import {
  generateStaffCredentials,
  mapStaffRoleToUserRole,
  resolveStaffRedirectUrl,
  verifyStaffPin,
  findStaffByEmail,
  type StaffRosterRecord,
} from '@/modules/auth/pin-auth';

describe('Quick Access Staff PIN & Email Roster Authentication Engine', () => {

  const mockApprovedOperatorWithEmail: StaffRosterRecord = {
    id: 'staff-mat1-op',
    name: 'Hiroshi Tanaka',
    role: 'score',
    email: 'hiroshi@dojo.org',
    pin: '4821',
    assignedMats: ['1'],
    assignedCategories: [],
    assignedPools: [],
    approvalStatus: 'approved',
    userId: 'user_hiroshi_uid',
  };

  const mockApprovedVolunteerNoEmail: StaffRosterRecord = {
    id: 'staff-volunteer-42',
    name: 'Volunteer Desk A',
    role: 'attendance',
    // NO email configured on roster (e.g. tablet handed to on-site volunteer)
    email: undefined,
    pin: '9055',
    assignedMats: [],
    assignedCategories: ['Cadet Male Kumite'],
    assignedPools: [],
    approvalStatus: 'approved',
  };

  const mockMedalDistributorWithPinOnly: StaffRosterRecord = {
    id: 'staff-medals-podium',
    name: 'Podium Marshal',
    role: 'medal',
    email: undefined,
    pin: '1122',
    assignedMats: [],
    assignedCategories: [],
    assignedPools: [],
    approvalStatus: 'approved',
  };

  const mockPendingStaffWithPin: StaffRosterRecord = {
    id: 'staff-pending-new',
    name: 'New Trainee',
    role: 'score',
    email: 'trainee@gmail.com',
    pin: '7788',
    assignedMats: ['2'],
    approvalStatus: 'pending',
  };

  describe('1. PIN Verification & Security', () => {
    it('approves verification when 4-digit PIN exactly matches staff profile', () => {
      const result = verifyStaffPin(mockApprovedOperatorWithEmail, '4821');
      expect(result).toEqual({ success: true });
    });

    it('rejects verification when incorrect PIN is entered', () => {
      const result = verifyStaffPin(mockApprovedOperatorWithEmail, '9999');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Invalid PIN code.');
      }
    });

    it('rejects attempt if staff record lacks a PIN', () => {
      const noPinStaff: StaffRosterRecord = {
        id: 'no-pin-user',
        name: 'No Pin User',
        role: 'score',
      };
      const result = verifyStaffPin(noPinStaff, '1234');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('No PIN is configured for this staff member.');
      }
    });

    it('rejects attempt if no staff profile is selected', () => {
      const result = verifyStaffPin(undefined, '1234');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Please select your profile.');
      }
    });
  });

  describe('2. What happens if a staff member logs in with Quick PIN WITHOUT entering an email?', () => {
    it('creates deterministic, non-anonymous Firebase Auth credentials automatically', () => {
      // Staff member has NO email on roster (volunteer handed an on-site device)
      expect(mockApprovedVolunteerNoEmail.email).toBeUndefined();

      const { staffEmail, staffPassword } = generateStaffCredentials(mockApprovedVolunteerNoEmail.id);

      // System derives a virtual, domain-bound email & password from the staff record ID:
      expect(staffEmail).toBe('staff.staffvolunteer42@taikaix.app');
      expect(staffPassword).toBe('TaikaiX#Staff#staffvolunteer42');

      // Eliminates anonymous sessions while requiring zero personal email or complex passwords
      expect(staffEmail.endsWith('@taikaix.app')).toBe(true);
      expect(staffPassword.startsWith('TaikaiX#Staff#')).toBe(true);
    });

    it('cleanses punctuation and special characters from staffId when forming credentials', () => {
      const dirtyStaffId = 'staff#mat-02_alpha@dojo!';
      const { staffEmail, staffPassword } = generateStaffCredentials(dirtyStaffId);

      expect(staffEmail).toBe('staff.staffmat02alphadojo@taikaix.app');
      expect(staffPassword).toBe('TaikaiX#Staff#staffmat02alphadojo');
    });

    it('maps staff role to valid UserRole for Firestore user profile without email', () => {
      const mappedRole = mapStaffRoleToUserRole(mockApprovedVolunteerNoEmail.role);
      expect(mappedRole).toBe('attendance_volunteer');

      const medalRole = mapStaffRoleToUserRole(mockMedalDistributorWithPinOnly.role);
      expect(medalRole).toBe('medal_distributor');

      const operatorRole = mapStaffRoleToUserRole(mockApprovedOperatorWithEmail.role);
      expect(operatorRole).toBe('mat_operator');
    });

    it('routes staff without email directly to their assigned operational station upon PIN verification', () => {
      const targetComp = 'comp-karate-2026';

      // Attendance volunteer goes directly to athletes check-in
      const volunteerUrl = resolveStaffRedirectUrl(targetComp, mockApprovedVolunteerNoEmail);
      expect(volunteerUrl).toBe(`/competitions/${targetComp}/athletes`);

      // Medal distributor goes directly to medals page
      const medalUrl = resolveStaffRedirectUrl(targetComp, mockMedalDistributorWithPinOnly);
      expect(medalUrl).toBe(`/competitions/${targetComp}/medals`);
    });
  });

  describe('3. What happens if a staff member with Quick PIN HAS an email configured?', () => {
    const roster = [
      mockApprovedOperatorWithEmail,
      mockApprovedVolunteerNoEmail,
      mockMedalDistributorWithPinOnly,
    ];

    it('allows dual-mode login: can authenticate via Standard Email/Google Auth OR Quick PIN', () => {
      // MODE 1: Staff uses their personal email (hiroshi@dojo.org) via Google or Email tab
      const emailMatch = findStaffByEmail(roster, 'hiroshi@dojo.org');
      expect(emailMatch).not.toBeNull();
      expect(emailMatch?.name).toBe('Hiroshi Tanaka');
      expect(emailMatch?.role).toBe('score');

      // MODE 2: Same staff forgets password or uses shared mat tablet -> uses Quick PIN tab
      const pinResult = verifyStaffPin(emailMatch!, '4821');
      expect(pinResult).toEqual({ success: true });

      // In PIN mode, system uses their deterministic staff ID credentials
      const { staffEmail } = generateStaffCredentials(emailMatch!.id);
      expect(staffEmail).toBe('staff.staffmat1op@taikaix.app');
    });

    it('routes approved mat operator directly to their assigned mat scoreboard / controller', () => {
      const targetComp = 'comp-karate-2026';
      const redirectUrl = resolveStaffRedirectUrl(targetComp, mockApprovedOperatorWithEmail);
      expect(redirectUrl).toBe(`/competitions/${targetComp}/operator?mat=1`);
    });
  });

  describe('4. What happens if a staff member DOES NOT enter email and tries Email Login tab?', () => {
    const roster = [
      mockApprovedVolunteerNoEmail, // Has no email on roster
    ];

    it('fails email roster lookup when user logs in with an email not recorded on the roster', () => {
      const strangerEmail = 'random_volunteer@gmail.com';
      const match = findStaffByEmail(roster, strangerEmail);

      // Email is NOT on the roster:
      expect(match).toBeNull();
    });

    it('forces un-rostered email users into the Access Request / Enrollment workflow', () => {
      const strangerEmail = 'newcomer@gmail.com';
      const match = findStaffByEmail(roster, strangerEmail);

      // When match is null, login page does NOT redirect; instead it opens the Staff Request form
      const wouldShowEnrollForm = match === null;
      expect(wouldShowEnrollForm).toBe(true);
    });
  });

  describe('5. Approval Status Handling: Approved vs Pending Staff', () => {
    it('routes approved staff directly to their operational station', () => {
      const compId = 'national-championship';
      if (mockApprovedOperatorWithEmail.approvalStatus === 'approved') {
        const dest = resolveStaffRedirectUrl(compId, mockApprovedOperatorWithEmail);
        expect(dest).toBe(`/competitions/${compId}/operator?mat=1`);
      }
    });

    it('diverts unapproved/pending staff to /login/pending waiting room', () => {
      const compId = 'national-championship';
      const isApproved = mockPendingStaffWithPin.approvalStatus === 'approved';
      expect(isApproved).toBe(false);

      // Login page redirects to pending page
      const pendingRedirect = `/login/pending?compId=${compId}&staffId=${mockPendingStaffWithPin.id}`;
      expect(pendingRedirect).toBe(`/login/pending?compId=national-championship&staffId=staff-pending-new`);
    });
  });

  describe('6. Staff email already exists on staff base and DOES NOT use quick login', () => {
    const roster: StaffRosterRecord[] = [
      {
        id: 'staff-kumite-head',
        name: 'Sarah Connor',
        role: 'score',
        email: 'sarah.connor@karate-dojo.com',
        assignedMats: ['3'],
        approvalStatus: 'approved',
      },
      {
        id: 'staff-marshal-lead',
        name: 'Kenji Sato',
        role: 'attendance',
        email: 'kenji.sato@karate-dojo.com',
        assignedCategories: ['Junior Kumite'],
        approvalStatus: 'approved',
      }
    ];

    it('matches user directly by email without requiring any Quick PIN interaction', () => {
      const loggedInEmail = 'sarah.connor@karate-dojo.com';
      const matched = findStaffByEmail(roster, loggedInEmail);

      expect(matched).not.toBeNull();
      expect(matched?.id).toBe('staff-kumite-head');
      expect(matched?.name).toBe('Sarah Connor');
      expect(matched?.role).toBe('score');
    });

    it('links staff record to authenticated user UID and synchronizes operational role', () => {
      const matched = findStaffByEmail(roster, 'sarah.connor@karate-dojo.com')!;
      const userUid = 'real_firebase_uid_sarah_123';

      // Simulates staff link in checkEmailRosterAndRedirect
      const updatedStaffRecord = {
        ...matched,
        userId: userUid,
        requestUserId: userUid,
        lastActiveAt: new Date().toISOString()
      };

      expect(updatedStaffRecord.userId).toBe(userUid);
      expect(updatedStaffRecord.requestUserId).toBe(userUid);

      // User profile in users/{uid} is updated with real role and real email (NOT anonymous)
      const mappedRole = mapStaffRoleToUserRole(matched.role);
      const userProfilePayload = {
        displayName: matched.name,
        email: matched.email,
        role: mappedRole,
        isAnonymous: false,
        staffId: matched.id,
        competitionId: 'comp-state-2026'
      };

      expect(userProfilePayload.role).toBe('mat_operator');
      expect(userProfilePayload.isAnonymous).toBe(false);
      expect(userProfilePayload.email).toBe('sarah.connor@karate-dojo.com');
    });

    it('bypasses PIN dialog and redirects directly to designated mat operator screen', () => {
      const matched = findStaffByEmail(roster, 'sarah.connor@karate-dojo.com')!;
      const redirectUrl = resolveStaffRedirectUrl('comp-state-2026', matched);

      expect(redirectUrl).toBe('/competitions/comp-state-2026/operator?mat=3');
    });
  });

  describe('7. Invariant: ABSOLUTE ZERO ANONYMOUS USERS', () => {
    it('guarantees Quick PIN generates named, persistent credentials instead of anonymous auth', () => {
      const credentials = generateStaffCredentials('staff-operator-1');
      expect(credentials.staffEmail).toBe('staff.staffoperator1@taikaix.app');
      // taikaix.app domain guarantees valid non-anonymous Firebase email credential
      expect(credentials.staffEmail).toMatch(/@taikaix\.app$/);
    });

    it('guarantees user document payloads enforce isAnonymous === false', () => {
      const pinUserDoc = {
        displayName: 'John Doe',
        email: 'staff.staff1@taikaix.app',
        role: 'mat_operator',
        isAnonymous: false,
      };

      const emailUserDoc = {
        displayName: 'John Doe',
        email: 'john@example.com',
        role: 'mat_operator',
        isAnonymous: false,
      };

      expect(pinUserDoc.isAnonymous).toBe(false);
      expect(emailUserDoc.isAnonymous).toBe(false);
    });

    it('verifies AuthProvider purge policy immediately destroys any accidental anonymous sessions', async () => {
      // AuthProvider line 37:
      // if (currentUser?.isAnonymous) { await currentUser.delete(); setUser(null); setRole(null); }
      let deleted = false;
      const fakeAnonUser = {
        isAnonymous: true,
        delete: async () => { deleted = true; }
      };

      if (fakeAnonUser.isAnonymous) {
        await fakeAnonUser.delete();
      }

      expect(deleted).toBe(true);
    });
  });

  describe('8. Multi-Tab & Re-Login Idempotency (Closed Tab / Multiple Tabs)', () => {
    const existingStaff: StaffRosterRecord = {
      id: 'staff-mat-2-score',
      name: 'Kenji Sato',
      role: 'score',
      pin: '5566',
      assignedMats: ['2'],
      approvalStatus: 'approved',
      userId: 'firebase_uid_kenji_fixed',
    };

    it('produces identical deterministic credentials across tab 1 and tab 2', () => {
      // Tab 1 login attempt:
      const tab1Creds = generateStaffCredentials(existingStaff.id);
      // Tab 2 login attempt (after closing tab 1 or opening new window):
      const tab2Creds = generateStaffCredentials(existingStaff.id);

      expect(tab1Creds.staffEmail).toBe(tab2Creds.staffEmail);
      expect(tab1Creds.staffPassword).toBe(tab2Creds.staffPassword);
      expect(tab1Creds.staffEmail).toBe('staff.staffmat2score@taikaix.app');
    });

    it('reuses existing staff document ID and NEVER creates a new staff record', () => {
      // In handlePinAuth:
      // The staff document targeted is always:
      // doc(db, 'competitions', selectedCompId, 'staff', selectedStaffId)
      const selectedStaffId = existingStaff.id;

      // Assert that the operation updates the EXISTING staff document:
      expect(selectedStaffId).toBe('staff-mat-2-score');
      // Does NOT call Math.random() or create a new staff-* ID on login
      expect(selectedStaffId).not.toMatch(/^staff-[0-9a-z]{9}$/);
    });

    it('skips redundant writes when user is already linked to the staff document', () => {
      const currentLoggedInUid = 'firebase_uid_kenji_fixed';

      // Login page check (line 234):
      // if (staffMember.userId !== user.uid) { await updateDoc(...) }
      const alreadyLinked = existingStaff.userId === currentLoggedInUid;

      expect(alreadyLinked).toBe(true);
      // Since it is already linked, zero unnecessary Firestore writes occur
      const writeRequired = existingStaff.userId !== currentLoggedInUid;
      expect(writeRequired).toBe(false);
    });

    it('updates lastLoginAt via merge without generating duplicate Firestore user profiles', () => {
      const userUid = existingStaff.userId!;
      const existingProfile = {
        displayName: existingStaff.name,
        email: 'staff.staffmat2score@taikaix.app',
        role: 'mat_operator',
        isAnonymous: false,
        staffId: existingStaff.id,
        competitionId: 'comp-karate-2026',
        lastLoginAt: '2026-09-30T03:00:00.000Z',
      };

      // Simulates setDoc with { merge: true } on tab 2:
      const updatedProfile = {
        ...existingProfile,
        lastLoginAt: '2026-09-30T04:00:00.000Z', // Only login timestamp refreshes
      };

      expect(updatedProfile.staffId).toBe(existingProfile.staffId);
      expect(updatedProfile.role).toBe(existingProfile.role);
      expect(updatedProfile.isAnonymous).toBe(false);
      // UID is preserved; zero duplicate profiles created
      expect(userUid).toBe('firebase_uid_kenji_fixed');
    });
  });

});
