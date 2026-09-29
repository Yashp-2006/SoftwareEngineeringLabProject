import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';
import { db, rtdb } from '@/lib/firebase';
import { generateBracket, AthleteRow } from '@taikaix/backend/services/tiesheet/generator';

export async function createFullDummyTournament(currentUserId?: string, userEmail?: string): Promise<string> {
  // 1. Create main Competition document
  const compRef = await addDoc(collection(db, 'competitions'), {
    name: 'Khel Karate Championship 2026 (Live Demo)',
    type: 'state',
    rules: 'wkf',
    status: 'ongoing',
    mats: 4,
    createdAt: new Date().toISOString(),
    description: 'Realistic benchmark tournament for testing brackets, multi-mat scheduling, TV scoreboard, and Admin Override.',
  });

  const compId = compRef.id;

  // 2. Sample Clubs and Athletes
  const clubs = ['Tiger Shotokan Dojo', 'Dragon Shitoryu Club', 'Eagle Goju-ryu Academy', 'Samurai Wado-ryu'];

  const makeAthletes = (names: string[], gender: 'male' | 'female', minWeight: number, age: number): AthleteRow[] => {
    return names.map((name, i) => ({
      playerId: `ath-${Math.random().toString(36).substring(2, 8)}`,
      name,
      gender,
      weight: minWeight + (i % 4) * 2,
      age,
      country: 'India',
      state: 'Maharashtra',
      district: 'Mumbai',
      academy: clubs[i % clubs.length],
      interestSpecial: '',
    }));
  };

  const cadetMaleKumiteAthletes = makeAthletes([
    'Rohan Sharma', 'Aditya Verma', 'Vikram Patil', 'Karan Mehta',
    'Arjun Nair', 'Devansh Gupta', 'Sahil Shinde', 'Tanmay Joshi'
  ], 'male', 52, 15);

  const juniorFemaleKumiteAthletes = makeAthletes([
    'Ananya Sen', 'Priya Kulkarni', 'Diya Chawla', 'Meera Rao',
    'Sneha Deshmukh', 'Ritika Bhatt', 'Kavya Pillai', 'Pooja Hegde'
  ], 'female', 49, 17);

  const seniorMaleKataAthletes = makeAthletes([
    'Kenji Murata', 'Tatsuya Sato', 'Daiki Takahashi', 'Haruto Tanaka',
    'Kazuki Ito', 'Ren Suzuki', 'Yuto Watanabe', 'Sora Kobayashi'
  ], 'male', 70, 22);

  const cadetFemaleKataAthletes = makeAthletes([
    'Aoi Nakamura', 'Hina Kato', 'Yui Yoshida', 'Sakura Yamada',
    'Rin Sasaki', 'Mio Yamaguchi'
  ], 'female', 48, 14);

  // 3. Generate matches using tiesheet generator
  const cadetKumiteMatches = generateBracket(cadetMaleKumiteAthletes, 'state', 8);
  const juniorKumiteMatches = generateBracket(juniorFemaleKumiteAthletes, 'state', 8);
  const seniorKataMatches = generateBracket(seniorMaleKataAthletes, 'state', 8);
  const cadetKataMatches = generateBracket(cadetFemaleKataAthletes, 'state', 8);

  // 4. Create Categories in Firestore subcollection
  const categoriesCollection = collection(db, 'competitions', compId, 'categories');

  // Category 1: Male Cadet Kumite (Live on Mat 01)
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
    athletes: cadetMaleKumiteAthletes,
    matches: cadetKumiteMatches,
    poolSize: 8,
  });

  // Category 2: Female Junior Kumite (Upcoming on Mat 02)
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
    athletes: juniorFemaleKumiteAthletes,
    matches: juniorKumiteMatches,
    poolSize: 8,
  });

  // Category 3: Male Senior Individual Kata (Upcoming on Mat 03)
  await addDoc(categoriesCollection, {
    name: 'Male Senior Individual Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'male',
    minAge: 18,
    maxAge: 35,
    mat: 'MAT 03',
    status: 'upcoming',
    athletes: seniorMaleKataAthletes,
    matches: seniorKataMatches,
    numberOfJudges: 5,
    poolSize: 8,
  });

  // Category 4: Female Cadet Kata (Upcoming on Mat 04)
  await addDoc(categoriesCollection, {
    name: 'Female Cadet Kata',
    discipline: 'kata',
    isKata: true,
    gender: 'female',
    minAge: 14,
    maxAge: 15,
    mat: 'MAT 04',
    status: 'upcoming',
    athletes: cadetFemaleKataAthletes,
    matches: cadetKataMatches,
    numberOfJudges: 3,
    poolSize: 8,
  });

  // 5. Seed Realtime Database for Mat 01 Live Scoreboard
  try {
    const liveMatRef = ref(rtdb, `live_scores/${compId}/mats/mat-1`);
    await set(liveMatRef, {
      status: 'live',
      matchStatus: 'LIVE',
      currentCategory: 'Male Cadet Kumite -57kg',
      categoryId: cat1Ref.id,
      isKata: false,
      currentMatch: cadetKumiteMatches[0]?.id || 'R1-M1',
      matchId: cadetKumiteMatches[0]?.id || 'R1-M1',
      matchDisplayId: 'R1-M1',
      akaName: cadetMaleKumiteAthletes[0]?.name || 'Aka Fighter',
      akaCountry: 'India',
      akaAcademy: cadetMaleKumiteAthletes[0]?.academy || clubs[0],
      aoName: cadetMaleKumiteAthletes[1]?.name || 'Ao Fighter',
      aoCountry: 'India',
      aoAcademy: cadetMaleKumiteAthletes[1]?.academy || clubs[1],
      scores: { aka: 2, ao: 1 },
      akaStats: { yuko: 2, waza: 0, ippon: 0, senshu: true },
      aoStats: { yuko: 1, waza: 0, ippon: 0, senshu: false },
      akaPenalties: { c1: 1, c2: 0, c3: 0, hc: 0, h: 0 },
      aoPenalties: { c1: 0, c2: 0, c3: 0, hc: 0, h: 0 },
      timeRemaining: '02:15',
      timerSeconds: 135,
      timerRunning: true,
      adminOverride: { active: false },
    });
  } catch (err) {
    console.warn('RTDB seeding note (non-fatal):', err);
  }

  // 6. Assign Staff to Current User (if logged in) for instant operator access
  if (currentUserId) {
    try {
      const staffRef = doc(db, 'competitions', compId, 'staff', currentUserId);
      await setDoc(staffRef, {
        userId: currentUserId,
        email: userEmail || '',
        role: 'operator',
        approvalStatus: 'approved',
        assignedMats: ['mat-1', 'mat-2', 'mat-3', 'mat-4'],
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Staff assignment note:', e);
    }
  }

  return compId;
}
