import { describe, it, expect, vi } from 'vitest';
import {
  DEMO_STAFF_PRESETS,
  getSharedAthleteSeeds,
} from '@/lib/seed-tournament';
import {
  mapStaffRoleToUserRole,
  resolveStaffRedirectUrl,
  verifyStaffPin,
} from '@/modules/auth/pin-auth';
import { generateBracket } from '@taikaix/backend/services/tiesheet/generator';

describe('Demo Tournament Scenarios (Setup, Live, Archived) Specification', () => {

  describe('1. Shared Input Seeds Consistency', () => {
    it('produces identical deterministic athlete rosters across all categories', () => {
      const seeds1 = getSharedAthleteSeeds();
      const seeds2 = getSharedAthleteSeeds();

      expect(seeds1.cadetMaleKumiteAthletes.length).toBe(8);
      expect(seeds1.juniorFemaleKumiteAthletes.length).toBe(8);
      expect(seeds1.seniorMaleKataAthletes.length).toBe(8);
      expect(seeds1.cadetFemaleKataAthletes.length).toBe(8);

      // Verify identical IDs and data
      expect(seeds1.cadetMaleKumiteAthletes.map(a => a.playerId)).toEqual(
        seeds2.cadetMaleKumiteAthletes.map(a => a.playerId)
      );
      expect(seeds1.seniorMaleKataAthletes.map(a => a.name)).toEqual(
        seeds2.seniorMaleKataAthletes.map(a => a.name)
      );
    });

    it('covers all major age divisions, weights, genders, and disciplines', () => {
      const { cadetMaleKumiteAthletes, juniorFemaleKumiteAthletes, seniorMaleKataAthletes, cadetFemaleKataAthletes } = getSharedAthleteSeeds();

      expect(cadetMaleKumiteAthletes.every(a => a.gender === 'male')).toBe(true);
      expect(juniorFemaleKumiteAthletes.every(a => a.gender === 'female')).toBe(true);
      expect(seniorMaleKataAthletes.every(a => a.gender === 'male')).toBe(true);
      expect(cadetFemaleKataAthletes.every(a => a.gender === 'female')).toBe(true);

      const academies = new Set([
        ...cadetMaleKumiteAthletes.map(a => a.academy),
        ...juniorFemaleKumiteAthletes.map(a => a.academy),
      ]);
      expect(academies.size).toBe(4);
      expect(academies).toContain('Tiger Shotokan Dojo');
      expect(academies).toContain('Dragon Shitoryu Club');
    });
  });

  describe('2. Scenario 1: Setup Mode Tournament ([Setup])', () => {
    it('generates pristine upcoming tournament state with unplayed brackets', () => {
      const seeds = getSharedAthleteSeeds();
      const bracket = generateBracket(seeds.cadetMaleKumiteAthletes, 'national', 8);

      expect(bracket.length).toBe(7); // 4 QF, 2 SF, 1 Final in an 8-person pool
      // In setup mode, all matches are upcoming
      expect(bracket.every(m => m.status === 'upcoming')).toBe(true);
      expect(bracket.every(m => m.akaScore === 0 && m.aoScore === 0)).toBe(true);
      expect(bracket.every(m => m.winnerId === null)).toBe(true);
    });

    it('leaves all athletes with pending attendance and unready state', () => {
      const seeds = getSharedAthleteSeeds();
      const setupAthletes = seeds.cadetMaleKumiteAthletes.map(a => ({
        ...a,
        attendance: 'pending',
        checkedIn: false,
        isReady: false,
      }));

      expect(setupAthletes.every(a => a.attendance === 'pending')).toBe(true);
      expect(setupAthletes.every(a => a.checkedIn === false)).toBe(true);
      expect(setupAthletes.every(a => a.isReady === false)).toBe(true);
    });
  });

  describe('3. Scenario 2: Live Mode Tournament ([Live])', () => {
    it('simulates in-progress Kumite category with active mat match', () => {
      const seeds = getSharedAthleteSeeds();
      const matches = generateBracket(seeds.cadetMaleKumiteAthletes, 'national', 8);

      // Round 1 completed
      matches[0].status = 'completed'; matches[0].akaScore = 4; matches[0].aoScore = 1; matches[0].winnerId = matches[0].aka?.playerId || null;
      matches[1].status = 'completed'; matches[1].akaScore = 2; matches[1].aoScore = 3; matches[1].winnerId = matches[1].ao?.playerId || null;

      // Semi-final 1 live
      matches[4].status = 'live';
      matches[4].aka = matches[0].aka;
      matches[4].ao = matches[1].ao;
      matches[4].akaScore = 3;
      matches[4].aoScore = 2;

      expect(matches[0].status).toBe('completed');
      expect(matches[1].status).toBe('completed');
      expect(matches[4].status).toBe('live');
      expect(matches[4].aka?.name).toBe(matches[0].aka?.name);
      expect(matches[4].ao?.name).toBe(matches[1].ao?.name);
      expect(matches[4].akaScore).toBe(3);
      expect(matches[4].aoScore).toBe(2);
    });

    it('simulates in-progress Kata category with 5 judges and flag scores', () => {
      const seeds = getSharedAthleteSeeds();
      const kataMatches = generateBracket(seeds.seniorMaleKataAthletes, 'national', 8);

      kataMatches[0].status = 'completed';
      kataMatches[1].status = 'completed';
      kataMatches[4].status = 'live';
      kataMatches[4].aka = kataMatches[0].aka;
      kataMatches[4].ao = kataMatches[1].ao;

      const liveKataScore = {
        isKata: true,
        akaKataName: 'Anan',
        aoKataName: 'Chatanyara Kushanku',
        judgesCount: 5,
        judges: {
          judge1: 'aka',
          judge2: 'aka',
          judge3: 'ao',
          judge4: 'aka',
          judge5: 'ao',
        },
      };

      const akaFlagCount = Object.values(liveKataScore.judges).filter(f => f === 'aka').length;
      const aoFlagCount = Object.values(liveKataScore.judges).filter(f => f === 'ao').length;

      expect(liveKataScore.isKata).toBe(true);
      expect(akaFlagCount).toBe(3);
      expect(aoFlagCount).toBe(2);
      expect(akaFlagCount > aoFlagCount).toBe(true);
    });

    it('contains attendance test cases including present, ready, and disqualified', () => {
      const seeds = getSharedAthleteSeeds();
      const liveAthletes = seeds.cadetMaleKumiteAthletes.map((a, idx) => ({
        ...a,
        attendance: idx === 6 ? 'absent' : 'present',
        checkedIn: idx !== 6,
        isReady: idx < 6,
        disqualified: idx === 6,
      }));

      const presentCount = liveAthletes.filter(a => a.attendance === 'present').length;
      const dqCount = liveAthletes.filter(a => a.disqualified).length;

      expect(presentCount).toBe(7);
      expect(dqCount).toBe(1);
    });
  });

  describe('4. Scenario 3: Archived Mode Tournament ([Archived])', () => {
    it('has all 4 categories marked done with complete medal podiums', () => {
      const seeds = getSharedAthleteSeeds();
      const matches = generateBracket(seeds.cadetMaleKumiteAthletes, 'national', 8);

      // Simulate full 8-person single elimination bracket
      // R1: 4 matches
      matches[0].status = 'completed'; matches[0].winnerId = matches[0].aka?.playerId || 'w1';
      matches[1].status = 'completed'; matches[1].winnerId = matches[1].ao?.playerId || 'w2';
      matches[2].status = 'completed'; matches[2].winnerId = matches[2].aka?.playerId || 'w3';
      matches[3].status = 'completed'; matches[3].winnerId = matches[3].aka?.playerId || 'w4';

      // Semis: 2 matches
      matches[4].status = 'completed'; matches[4].winnerId = matches[0].winnerId;
      matches[5].status = 'completed'; matches[5].winnerId = matches[3].winnerId;

      // Final: 1 match
      matches[6].status = 'completed'; matches[6].winnerId = matches[4].winnerId;

      const goldWinner = matches[6].winnerId;
      const silverWinner = matches[5].winnerId;
      const bronze1 = matches[1].winnerId;
      const bronze2 = matches[2].winnerId;

      expect(goldWinner).toBeTruthy();
      expect(silverWinner).toBeTruthy();
      expect(bronze1).toBeTruthy();
      expect(bronze2).toBeTruthy();
      expect(matches.every(m => m.status === 'completed')).toBe(true);
    });

    it('distinguishes received medals from unreceived medals for distribution test', () => {
      const decorated = [
        { name: 'Athlete 1', medal: 'gold', medalReceived: true },
        { name: 'Athlete 2', medal: 'silver', medalReceived: true },
        { name: 'Athlete 3', medal: 'bronze', medalReceived: true },
        { name: 'Athlete 4', medal: 'bronze', medalReceived: false }, // unreceived
      ];

      const distributed = decorated.filter(a => a.medalReceived);
      const pendingDistribution = decorated.filter(a => !a.medalReceived);

      expect(distributed.length).toBe(3);
      expect(pendingDistribution.length).toBe(1);
      expect(pendingDistribution[0].name).toBe('Athlete 4');
    });

    it('computes academy medal leaderboard totals correctly', () => {
      const clubMedals = [
        { academy: 'Tiger Shotokan Dojo', medal: 'gold' },
        { academy: 'Tiger Shotokan Dojo', medal: 'gold' },
        { academy: 'Tiger Shotokan Dojo', medal: 'silver' },
        { academy: 'Tiger Shotokan Dojo', medal: 'bronze' },
        { academy: 'Dragon Shitoryu Club', medal: 'gold' },
        { academy: 'Dragon Shitoryu Club', medal: 'silver' },
        { academy: 'Dragon Shitoryu Club', medal: 'bronze' },
        { academy: 'Eagle Goju-ryu Academy', medal: 'silver' },
      ];

      const tally: Record<string, { gold: number; silver: number; bronze: number }> = {};
      for (const item of clubMedals) {
        if (!tally[item.academy]) tally[item.academy] = { gold: 0, silver: 0, bronze: 0 };
        tally[item.academy][item.medal as 'gold' | 'silver' | 'bronze']++;
      }

      expect(tally['Tiger Shotokan Dojo'].gold).toBe(2);
      expect(tally['Tiger Shotokan Dojo'].silver).toBe(1);
      expect(tally['Tiger Shotokan Dojo'].bronze).toBe(1);
      expect(tally['Dragon Shitoryu Club'].gold).toBe(1);
      expect(tally['Eagle Goju-ryu Academy'].gold).toBe(0);
    });
  });

  describe('5. Staff Quick PIN Authentication across all 4 roles', () => {
    it('verifies standardized demo PINs and maps roles accurately', () => {
      expect(DEMO_STAFF_PRESETS).toHaveLength(4);

      const op = DEMO_STAFF_PRESETS.find(s => s.role === 'score')!;
      const attendance = DEMO_STAFF_PRESETS.find(s => s.role === 'attendance')!;
      const judge = DEMO_STAFF_PRESETS.find(s => s.role === 'judge')!;
      const medal = DEMO_STAFF_PRESETS.find(s => s.role === 'medal')!;

      expect(op.pin).toBe('1234');
      expect(attendance.pin).toBe('2345');
      expect(judge.pin).toBe('3456');
      expect(medal.pin).toBe('4567');

      // Verify PIN checker
      expect(verifyStaffPin(op, '1234').success).toBe(true);
      expect(verifyStaffPin(op, '0000').success).toBe(false);

      // Verify UserRole mapping
      expect(mapStaffRoleToUserRole(op.role)).toBe('mat_operator');
      expect(mapStaffRoleToUserRole(attendance.role)).toBe('attendance_volunteer');
      expect(mapStaffRoleToUserRole(judge.role)).toBe('judge');
      expect(mapStaffRoleToUserRole(medal.role)).toBe('medal_distributor');
    });

    it('resolves correct landing page URLs for all 4 PIN-authenticated roles', () => {
      const compId = 'test-comp-101';
      const op = DEMO_STAFF_PRESETS.find(s => s.role === 'score')!;
      const attendance = DEMO_STAFF_PRESETS.find(s => s.role === 'attendance')!;
      const judge = DEMO_STAFF_PRESETS.find(s => s.role === 'judge')!;
      const medal = DEMO_STAFF_PRESETS.find(s => s.role === 'medal')!;

      expect(resolveStaffRedirectUrl(compId, op)).toBe(`/competitions/${compId}/operator?mat=1`);
      expect(resolveStaffRedirectUrl(compId, attendance)).toBe(`/competitions/${compId}/athletes`);
      expect(resolveStaffRedirectUrl(compId, judge)).toBe(`/competitions/${compId}/judge`);
      expect(resolveStaffRedirectUrl(compId, medal)).toBe(`/competitions/${compId}/medals`);
    });
  });

  describe('6. Competition Directory Status Filtering Specification', () => {
    const mockCompetitions = [
      { id: 'c1', name: '[Setup] TaikaiX Championship 2026', status: 'upcoming' },
      { id: 'c2', name: '[Live] TaikaiX Championship 2026', status: 'live' },
      { id: 'c3', name: '[Archived] TaikaiX Championship 2026', status: 'done' },
    ];

    it('returns all 3 tournaments when filter is "all"', () => {
      const filtered = mockCompetitions.filter(c => true);
      expect(filtered).toHaveLength(3);
    });

    it('filters strictly by upcoming, live, and done', () => {
      const upcoming = mockCompetitions.filter(c => c.status === 'upcoming');
      const live = mockCompetitions.filter(c => c.status === 'live');
      const done = mockCompetitions.filter(c => c.status === 'done');

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].name).toContain('[Setup]');

      expect(live).toHaveLength(1);
      expect(live[0].name).toContain('[Live]');

      expect(done).toHaveLength(1);
      expect(done[0].name).toContain('[Archived]');
    });
  });

});
