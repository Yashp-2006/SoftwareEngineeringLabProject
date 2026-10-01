import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { db, rtdb } from '@/lib/firebase';
import { generateBracket, AthleteRow, MatchNode } from '@taikaix/backend/services/tiesheet/generator';

export interface DemoStaffPreset {
  id: string;
  name: string;
  role: 'score' | 'attendance' | 'judge' | 'medal';
  pin: string;
  email: string;
  assignedMats: string[];
  assignedCategories: string[];
}

export const DEMO_STAFF_PRESETS: DemoStaffPreset[] = [
  {
    id: 'staff-demo-mat-op',
    name: 'Hiroshi Tanaka (Mat Op)',
    role: 'score',
    pin: '1234',
    email: 'op.hiroshi@demo.local',
    assignedMats: ['1', '2'],
    assignedCategories: [],
  },
  {
    id: 'staff-demo-attendance',
    name: 'Kenji Sato (Attendance)',
    role: 'attendance',
    pin: '2345',
    email: 'vol.kenji@demo.local',
    assignedMats: [],
    assignedCategories: ['Male Cadet Kumite -57kg', 'Female Junior Kumite -53kg'],
  },
  {
    id: 'staff-demo-judge',
    name: 'Sensei Takeshi (Judge)',
    role: 'judge',
    pin: '3456',
    email: 'judge.takeshi@demo.local',
    assignedMats: [],
    assignedCategories: ['Male Senior Individual Kata', 'Female Cadet Kata'],
  },
  {
    id: 'staff-demo-medals',
    name: 'Aoi Yamada (Medals)',
    role: 'medal',
    pin: '4567',
    email: 'medals.aoi@demo.local',
    assignedMats: ['1', '2', '3', '4'],
    assignedCategories: [],
  },
];

// Reusable clubs and seed generator
const CLUBS = ['Tiger Shotokan Dojo', 'Dragon Shitoryu Club', 'Eagle Goju-ryu Academy', 'Samurai Wado-ryu'];

function createDemoAthletes(names: string[], gender: 'male' | 'female', minWeight: number, age: number): AthleteRow[] {
  return names.map((name, i) => ({
    playerId: `ath-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    gender,
    weight: minWeight + (i % 4) * 2,
    age,
    country: 'India',
    state: 'Maharashtra',
    district: 'Mumbai',
    academy: CLUBS[i % CLUBS.length],
    interestSpecial: '',
  }));
}

export function getSharedAthleteSeeds() {
  const cadetMaleKumiteAthletes = createDemoAthletes([
    'Rohan Sharma', 'Aditya Verma', 'Vikram Patil', 'Karan Mehta',
    'Arjun Nair', 'Devansh Gupta', 'Sahil Shinde', 'Tanmay Joshi'
  ], 'male', 52, 15);

  const juniorFemaleKumiteAthletes = createDemoAthletes([
    'Ananya Sen', 'Priya Kulkarni', 'Diya Chawla', 'Meera Rao',
    'Sneha Deshmukh', 'Ritika Bhatt', 'Kavya Pillai', 'Pooja Hegde'
  ], 'female', 49, 17);

  const seniorMaleKataAthletes = createDemoAthletes([
    'Kenji Murata', 'Tatsuya Sato', 'Daiki Takahashi', 'Haruto Tanaka',
    'Kazuki Ito', 'Ren Suzuki', 'Yuto Watanabe', 'Sora Kobayashi'
  ], 'male', 70, 22);

  const cadetFemaleKataAthletes = createDemoAthletes([
    'Aoi Nakamura', 'Hina Kato', 'Yui Yoshida', 'Sakura Yamada',
    'Rin Sasaki', 'Mio Yamaguchi', 'Emi Inoue', 'Mai Takahashi'
  ], 'female', 48, 14);

  return {
    cadetMaleKumiteAthletes,
    juniorFemaleKumiteAthletes,
    seniorMaleKataAthletes,
    cadetFemaleKataAthletes,
  };
}

async function attachDemoStaff(compId: string, currentUserId?: string, userEmail?: string) {
  // Pre-seed standardized staff profiles for PIN authentication demonstration
  for (const staff of DEMO_STAFF_PRESETS) {
    try {
      const staffDocRef = doc(db, 'competitions', compId, 'staff', staff.id);
      await setDoc(staffDocRef, {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        pin: staff.pin,
        email: staff.email,
        assignedMats: staff.assignedMats,
        assignedCategories: staff.assignedCategories,
        assignedPools: [],
        approvalStatus: 'approved',
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to seed staff:', staff.name, e);
    }
  }

  // Also assign current logged-in user so they have instant access
  if (currentUserId) {
    try {
      const currentStaffRef = doc(db, 'competitions', compId, 'staff', currentUserId);
      await setDoc(currentStaffRef, {
        userId: currentUserId,
        email: userEmail || '',
        name: userEmail?.split('@')[0] || 'Tournament Admin',
        role: 'score',
        approvalStatus: 'approved',
        assignedMats: ['1', '2', '3', '4'],
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Current user staff assignment note:', e);
    }
  }
}

/**
 * 1. Setup Mode Scenario ([Setup] Khel Karate Championship 2026)
 * - Status: 'upcoming'
 * - Categories: all status 'upcoming'
 * - Athletes: all attendance 'pending', checkedIn false
 * - Matches: generated but unplayed
 */
async function seedSetupTournament(currentUserId?: string, userEmail?: string): Promise<string> {
  const seeds = getSharedAthleteSeeds();
  const compRef = await addDoc(collection(db, 'competitions'), {
    name: '[Setup] Khel Karate Championship 2026',
    type: 'national',
    rules: 'wkf',
    ruleSet: 'WKF',
    status: 'upcoming',
    mats: 4,
    matsCount: 4,
    poolSize: 8,
    wkfKataJudgeCount: 5,
    location: 'Balewadi Sports Complex, Pune',
    venue: 'Balewadi Sports Complex, Pune',
    dates: 'Nov 15, 2026 – Nov 17, 2026',
    startDate: '2026-11-15',
    endDate: '2026-11-17',
    createdAt: new Date().toISOString(),
    description: 'Setup Mode Demo: Bracket generation, mat assignments, staff onboarding, and unplayed tournament brackets.',
  });

  const compId = compRef.id;
  const categoriesCollection = collection(db, 'competitions', compId, 'categories');

  // Cat 1: Male Cadet Kumite
  const cat1Matches = generateBracket(seeds.cadetMaleKumiteAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Male Cadet Kumite -57kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'male',
    minAge: 14,
    maxAge: 15,
    minWeight: 52,
    maxWeight: 57,
    mat: 'MAT 01',
    status: 'upcoming',
    athletes: seeds.cadetMaleKumiteAthletes.map(a => ({ ...a, attendance: 'pending', checkedIn: false, isReady: false })),
    matches: cat1Matches,
    poolSize: 8,
    order: 1,
  });

  // Cat 2: Female Junior Kumite
  const cat2Matches = generateBracket(seeds.juniorFemaleKumiteAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Female Junior Kumite -53kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'female',
    minAge: 16,
    maxAge: 17,
    minWeight: 48,
    maxWeight: 53,
    mat: 'MAT 02',
    status: 'upcoming',
    athletes: seeds.juniorFemaleKumiteAthletes.map(a => ({ ...a, attendance: 'pending', checkedIn: false, isReady: false })),
    matches: cat2Matches,
    poolSize: 8,
    order: 2,
  });

  // Cat 3: Male Senior Individual Kata
  const cat3Matches = generateBracket(seeds.seniorMaleKataAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Male Senior Individual Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'male',
    minAge: 18,
    maxAge: 35,
    mat: 'MAT 03',
    status: 'upcoming',
    athletes: seeds.seniorMaleKataAthletes.map(a => ({ ...a, attendance: 'pending', checkedIn: false, isReady: false })),
    matches: cat3Matches,
    numberOfJudges: 5,
    wkfKataJudgeCount: 5,
    poolSize: 8,
    order: 3,
  });

  // Cat 4: Female Cadet Kata
  const cat4Matches = generateBracket(seeds.cadetFemaleKataAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Female Cadet Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'female',
    minAge: 14,
    maxAge: 15,
    mat: 'MAT 04',
    status: 'upcoming',
    athletes: seeds.cadetFemaleKataAthletes.map(a => ({ ...a, attendance: 'pending', checkedIn: false, isReady: false })),
    matches: cat4Matches,
    numberOfJudges: 3,
    wkfKataJudgeCount: 3,
    poolSize: 8,
    order: 4,
  });

  await attachDemoStaff(compId, currentUserId, userEmail);
  return compId;
}

/**
 * 2. Live Mode Scenario ([Live] Khel Karate Championship 2026)
 * - Status: 'live'
 * - Cat 1 Kumite is live on Mat 01 with live match, active RTDB timer, scores, penalties, senshu
 * - Cat 3 Kata is live on Mat 03 with flags and 5 judge votes
 * - Attendance has present/ready athletes and 1 DQ athlete
 * - Cat 2 & 4 are upcoming
 */
async function seedLiveTournament(currentUserId?: string, userEmail?: string): Promise<string> {
  const seeds = getSharedAthleteSeeds();
  const compRef = await addDoc(collection(db, 'competitions'), {
    name: '[Live] Khel Karate Championship 2026',
    type: 'national',
    rules: 'wkf',
    ruleSet: 'WKF',
    status: 'live',
    mats: 4,
    matsCount: 4,
    poolSize: 8,
    wkfKataJudgeCount: 5,
    location: 'Balewadi Sports Complex, Pune',
    venue: 'Balewadi Sports Complex, Pune',
    dates: 'Oct 01, 2026 – Oct 03, 2026',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
    createdAt: new Date().toISOString(),
    description: 'Live Mode Demo: Live Kumite scoreboard on Mat 01, Live Kata on Mat 03, real-time judge voting, and attendance DQ tracking.',
  });

  const compId = compRef.id;
  const categoriesCollection = collection(db, 'competitions', compId, 'categories');

  // Cat 1 Kumite matches: Round 1 finished, Semi-final 1 is live!
  const kumiteAthletes = seeds.cadetMaleKumiteAthletes.map((a, idx) => ({
    ...a,
    attendance: idx === 6 ? 'absent' : 'present',
    checkedIn: idx !== 6,
    isReady: idx < 6,
    disqualified: idx === 6, // 1 athlete disqualified to show attendance DQ
  }));

  const kumiteMatches = generateBracket(kumiteAthletes, 'national', 8);
  // Mark Round 1 as completed with scores
  kumiteMatches[0].status = 'completed';
  kumiteMatches[0].akaScore = 4;
  kumiteMatches[0].aoScore = 1;
  kumiteMatches[0].winnerId = kumiteMatches[0].aka?.playerId || null;

  kumiteMatches[1].status = 'completed';
  kumiteMatches[1].akaScore = 2;
  kumiteMatches[1].aoScore = 3;
  kumiteMatches[1].winnerId = kumiteMatches[1].ao?.playerId || null;

  kumiteMatches[2].status = 'completed';
  kumiteMatches[2].akaScore = 5;
  kumiteMatches[2].aoScore = 2;
  kumiteMatches[2].winnerId = kumiteMatches[2].aka?.playerId || null;

  kumiteMatches[3].status = 'completed';
  kumiteMatches[3].akaScore = 1;
  kumiteMatches[3].aoScore = 0;
  kumiteMatches[3].winnerId = kumiteMatches[3].aka?.playerId || null;

  // Semi-final 1 (match index 4) is LIVE
  if (kumiteMatches[4]) {
    kumiteMatches[4].status = 'live';
    kumiteMatches[4].aka = kumiteMatches[0].aka;
    kumiteMatches[4].ao = kumiteMatches[1].ao;
    kumiteMatches[4].akaScore = 3;
    kumiteMatches[4].aoScore = 2;
  }
  // Semi-final 2 (match index 5) has finalists ready
  if (kumiteMatches[5]) {
    kumiteMatches[5].aka = kumiteMatches[2].aka;
    kumiteMatches[5].ao = kumiteMatches[3].aka;
  }

  const cat1Ref = await addDoc(categoriesCollection, {
    name: 'Male Cadet Kumite -57kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'male',
    minAge: 14,
    maxAge: 15,
    minWeight: 52,
    maxWeight: 57,
    mat: 'MAT 01',
    status: 'live',
    athletes: kumiteAthletes,
    matches: kumiteMatches,
    poolSize: 8,
    order: 1,
  });

  // Cat 2 Kumite (Upcoming)
  const cat2Matches = generateBracket(seeds.juniorFemaleKumiteAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Female Junior Kumite -53kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'female',
    minAge: 16,
    maxAge: 17,
    minWeight: 48,
    maxWeight: 53,
    mat: 'MAT 02',
    status: 'upcoming',
    athletes: seeds.juniorFemaleKumiteAthletes.map(a => ({ ...a, attendance: 'present', checkedIn: true, isReady: true })),
    matches: cat2Matches,
    poolSize: 8,
    order: 2,
  });

  // Cat 3 Kata: Live on Mat 03
  const kataAthletes = seeds.seniorMaleKataAthletes.map(a => ({
    ...a,
    attendance: 'present',
    checkedIn: true,
    isReady: true,
  }));
  const kataMatches = generateBracket(kataAthletes, 'national', 8);
  kataMatches[0].status = 'completed';
  kataMatches[0].akaScore = 4;
  kataMatches[0].aoScore = 1;
  kataMatches[0].winnerId = kataMatches[0].aka?.playerId || null;

  kataMatches[1].status = 'completed';
  kataMatches[1].akaScore = 2;
  kataMatches[1].aoScore = 3;
  kataMatches[1].winnerId = kataMatches[1].ao?.playerId || null;

  if (kataMatches[4]) {
    kataMatches[4].status = 'live';
    kataMatches[4].aka = kataMatches[0].aka;
    kataMatches[4].ao = kataMatches[1].ao;
    kataMatches[4].akaScore = 3;
    kataMatches[4].aoScore = 2;
  }

  const cat3Ref = await addDoc(categoriesCollection, {
    name: 'Male Senior Individual Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'male',
    minAge: 18,
    maxAge: 35,
    mat: 'MAT 03',
    status: 'live',
    athletes: kataAthletes,
    matches: kataMatches,
    numberOfJudges: 5,
    wkfKataJudgeCount: 5,
    poolSize: 8,
    order: 3,
  });

  // Cat 4 Kata (Upcoming)
  const cat4Matches = generateBracket(seeds.cadetFemaleKataAthletes, 'national', 8);
  await addDoc(categoriesCollection, {
    name: 'Female Cadet Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'female',
    minAge: 14,
    maxAge: 15,
    mat: 'MAT 04',
    status: 'upcoming',
    athletes: seeds.cadetFemaleKataAthletes.map(a => ({ ...a, attendance: 'pending', checkedIn: false, isReady: false })),
    matches: cat4Matches,
    numberOfJudges: 3,
    wkfKataJudgeCount: 3,
    poolSize: 8,
    order: 4,
  });

  // Seed RTDB Live Kumite Scoreboard on Mat 01
  const rtdbSetWithTimeout = (refObj: any, val: any, timeoutMs = 4000) => {
    return Promise.race([
      set(refObj, val),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RTDB write timed out')), timeoutMs))
    ]);
  };

  try {
    const liveMat1Ref = ref(rtdb, `live_scores/${compId}/mats/mat-1`);
    await rtdbSetWithTimeout(liveMat1Ref, {
      status: 'live',
      matchStatus: 'LIVE',
      currentCategory: 'Male Cadet Kumite -57kg',
      categoryId: cat1Ref.id,
      isKata: false,
      currentMatch: 'R2-M1',
      matchId: 'R2-M1',
      matchDisplayId: 'Semi-Final 1',
      akaName: kumiteMatches[4]?.aka?.name || 'Rohan Sharma',
      akaCountry: 'India',
      akaAcademy: kumiteMatches[4]?.aka?.academy || 'Tiger Shotokan Dojo',
      aoName: kumiteMatches[4]?.ao?.name || 'Karan Mehta',
      aoCountry: 'India',
      aoAcademy: kumiteMatches[4]?.ao?.academy || 'Dragon Shitoryu Club',
      scores: { aka: 3, ao: 2 },
      akaStats: { yuko: 3, waza: 0, ippon: 0, senshu: true },
      aoStats: { yuko: 2, waza: 0, ippon: 0, senshu: false },
      akaPenalties: { c1: 1, c2: 0, c3: 0, hc: 0, h: 0 },
      aoPenalties: { c1: 2, c2: 0, c3: 0, hc: 0, h: 0 },
      timeRemaining: '01:24',
      timerSeconds: 84,
      timerRunning: true,
      adminOverride: { active: false },
    });
  } catch (err) {
    console.warn('Live Mat 01 RTDB seed note:', err);
  }

  // Seed RTDB Live Kata Scoreboard on Mat 03
  try {
    const liveMat3Ref = ref(rtdb, `live_scores/${compId}/mats/mat-3`);
    await rtdbSetWithTimeout(liveMat3Ref, {
      status: 'live',
      matchStatus: 'LIVE',
      currentCategory: 'Male Senior Individual Kata',
      categoryId: cat3Ref.id,
      isKata: true,
      currentMatch: 'R2-M1',
      matchId: 'R2-M1',
      matchDisplayId: 'Semi-Final 1 (Kata)',
      akaName: kataMatches[4]?.aka?.name || 'Kenji Murata',
      akaCountry: 'India',
      akaAcademy: kataMatches[4]?.aka?.academy || 'Tiger Shotokan Dojo',
      akaKataName: 'Anan',
      aoName: kataMatches[4]?.ao?.name || 'Daiki Takahashi',
      aoCountry: 'India',
      aoAcademy: kataMatches[4]?.ao?.academy || 'Eagle Goju-ryu Academy',
      aoKataName: 'Chatanyara Kushanku',
      scores: { aka: 3, ao: 2 },
      kataScores: { akaFlags: 3, aoFlags: 2 },
      judgesCount: 5,
      judges: {
        judge1: 'aka',
        judge2: 'aka',
        judge3: 'ao',
        judge4: 'aka',
        judge5: 'ao',
      },
      timeRemaining: '02:00',
      timerSeconds: 120,
      timerRunning: false,
      adminOverride: { active: false },
    });
  } catch (err) {
    console.warn('Live Mat 03 RTDB seed note:', err);
  }

  await attachDemoStaff(compId, currentUserId, userEmail);
  return compId;
}

/**
 * 3. Archived Mode Scenario ([Archived] Khel Karate Championship 2026)
 * - Status: 'done'
 * - All categories completed with full match histories
 * - Medals assigned: Gold, Silver, Bronze (2 bronzes)
 * - Mixed medalReceived flags to demo medal distributor hand-off
 * - Academy leaderboard populated
 */
async function seedArchivedTournament(currentUserId?: string, userEmail?: string): Promise<string> {
  const seeds = getSharedAthleteSeeds();
  const compRef = await addDoc(collection(db, 'competitions'), {
    name: '[Archived] Khel Karate Championship 2026',
    type: 'national',
    rules: 'wkf',
    ruleSet: 'WKF',
    status: 'done',
    mats: 4,
    matsCount: 4,
    poolSize: 8,
    wkfKataJudgeCount: 5,
    location: 'Balewadi Sports Complex, Pune',
    venue: 'Balewadi Sports Complex, Pune',
    dates: 'Aug 10, 2026 – Aug 12, 2026',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    createdAt: new Date().toISOString(),
    description: 'Archived Mode Demo: Completed tournament with full bracket histories, medal podiums, and academy rankings.',
  });

  const compId = compRef.id;
  const categoriesCollection = collection(db, 'competitions', compId, 'categories');

  // Complete bracket helper: marks all 7 matches completed with realistic results and returns podium athletes
  function buildCompletedCategory(athletes: AthleteRow[], isKataCat: boolean) {
    const matches = generateBracket(athletes, 'national', 8);

    // Round 1
    matches[0].status = 'completed'; matches[0].akaScore = 4; matches[0].aoScore = 2; matches[0].winnerId = matches[0].aka?.playerId || null;
    matches[1].status = 'completed'; matches[1].akaScore = 1; matches[1].aoScore = 3; matches[1].winnerId = matches[1].ao?.playerId || null;
    matches[2].status = 'completed'; matches[2].akaScore = 5; matches[2].aoScore = 0; matches[2].winnerId = matches[2].aka?.playerId || null;
    matches[3].status = 'completed'; matches[3].akaScore = 2; matches[3].aoScore = 1; matches[3].winnerId = matches[3].aka?.playerId || null;

    // Semi-Finals
    matches[4].status = 'completed';
    matches[4].aka = matches[0].aka;
    matches[4].ao = matches[1].ao;
    matches[4].akaScore = 3;
    matches[4].aoScore = 1;
    matches[4].winnerId = matches[4].aka?.playerId || null;

    matches[5].status = 'completed';
    matches[5].aka = matches[2].aka;
    matches[5].ao = matches[3].aka;
    matches[5].akaScore = 2;
    matches[5].aoScore = 4;
    matches[5].winnerId = matches[5].ao?.playerId || null;

    // Final
    matches[6].status = 'completed';
    matches[6].aka = matches[4].aka; // Finalist 1
    matches[6].ao = matches[5].ao;  // Finalist 2
    matches[6].akaScore = isKataCat ? 4 : 5;
    matches[6].aoScore = isKataCat ? 1 : 2;
    matches[6].winnerId = matches[6].aka?.playerId || null;

    // Medals:
    // Gold: winner of final (matches[6].aka)
    // Silver: loser of final (matches[6].ao)
    // Bronze 1: loser of semi-final 1 (matches[4].ao)
    // Bronze 2: loser of semi-final 2 (matches[5].aka)
    const goldId = matches[6].aka?.playerId;
    const silverId = matches[6].ao?.playerId;
    const bronze1Id = matches[4].ao?.playerId;
    const bronze2Id = matches[5].aka?.playerId;

    const decoratedAthletes = athletes.map(a => {
      if (a.playerId === goldId) {
        return { ...a, medal: 'gold' as const, medalReceived: true, attendance: 'present', checkedIn: true };
      }
      if (a.playerId === silverId) {
        return { ...a, medal: 'silver' as const, medalReceived: true, attendance: 'present', checkedIn: true };
      }
      if (a.playerId === bronze1Id) {
        return { ...a, medal: 'bronze' as const, medalReceived: true, attendance: 'present', checkedIn: true };
      }
      if (a.playerId === bronze2Id) {
        // Leave one medal unreceived to demonstrate medal distributor action
        return { ...a, medal: 'bronze' as const, medalReceived: false, attendance: 'present', checkedIn: true };
      }
      return { ...a, medal: null, medalReceived: null, attendance: 'present', checkedIn: true };
    });

    return { matches, decoratedAthletes };
  }

  // 1. Male Cadet Kumite Completed
  const cat1Data = buildCompletedCategory(seeds.cadetMaleKumiteAthletes, false);
  await addDoc(categoriesCollection, {
    name: 'Male Cadet Kumite -57kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'male',
    minAge: 14,
    maxAge: 15,
    minWeight: 52,
    maxWeight: 57,
    mat: 'MAT 01',
    status: 'done',
    athletes: cat1Data.decoratedAthletes,
    matches: cat1Data.matches,
    poolSize: 8,
    order: 1,
  });

  // 2. Female Junior Kumite Completed
  const cat2Data = buildCompletedCategory(seeds.juniorFemaleKumiteAthletes, false);
  await addDoc(categoriesCollection, {
    name: 'Female Junior Kumite -53kg',
    discipline: 'kumite',
    isKata: false,
    gender: 'female',
    minAge: 16,
    maxAge: 17,
    minWeight: 48,
    maxWeight: 53,
    mat: 'MAT 02',
    status: 'done',
    athletes: cat2Data.decoratedAthletes,
    matches: cat2Data.matches,
    poolSize: 8,
    order: 2,
  });

  // 3. Male Senior Individual Kata Completed
  const cat3Data = buildCompletedCategory(seeds.seniorMaleKataAthletes, true);
  await addDoc(categoriesCollection, {
    name: 'Male Senior Individual Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'male',
    minAge: 18,
    maxAge: 35,
    mat: 'MAT 03',
    status: 'done',
    athletes: cat3Data.decoratedAthletes,
    matches: cat3Data.matches,
    numberOfJudges: 5,
    wkfKataJudgeCount: 5,
    poolSize: 8,
    order: 3,
  });

  // 4. Female Cadet Kata Completed
  const cat4Data = buildCompletedCategory(seeds.cadetFemaleKataAthletes, true);
  await addDoc(categoriesCollection, {
    name: 'Female Cadet Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'female',
    minAge: 14,
    maxAge: 15,
    mat: 'MAT 04',
    status: 'done',
    athletes: cat4Data.decoratedAthletes,
    matches: cat4Data.matches,
    numberOfJudges: 3,
    wkfKataJudgeCount: 3,
    poolSize: 8,
    order: 4,
  });

  await attachDemoStaff(compId, currentUserId, userEmail);
  return compId;
}

/**
 * Seeds all 3 tournament scenarios concurrently and returns their IDs
 */
export async function seedAllDemoTournaments(currentUserId?: string, userEmail?: string): Promise<{
  setupId: string;
  liveId: string;
  doneId: string;
}> {
  const [setupId, liveId, doneId] = await Promise.all([
    seedSetupTournament(currentUserId, userEmail),
    seedLiveTournament(currentUserId, userEmail),
    seedArchivedTournament(currentUserId, userEmail),
  ]);

  return { setupId, liveId, doneId };
}

/**
 * Backward compatibility wrapper
 */
export async function createFullDummyTournament(currentUserId?: string, userEmail?: string): Promise<string> {
  const { liveId } = await seedAllDemoTournaments(currentUserId, userEmail);
  return liveId;
}
