// backend/types/index.ts
// Shared TypeScript types for the TaikaiX engine.

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'Admin' | 'TournamentDirector' | 'MatOperator' | 'AttendanceVolunteer' | 'MedalDistributor' | 'Viewer' | 'GuestViewer' | 'Judge' | 'Coach';
  academy: string;
  photoURL?: string;
}

export interface Competition {
  id: string;
  name: string;
  dates: { start: string; end: string };
  location: string;
  type: 'national' | 'international' | 'local';
  ruleSet: 'WKF' | 'custom';
  status: 'upcoming' | 'live' | 'done';
  matsCount: number;
}

export interface Category {
  id: string;
  competitionId: string;
  name: string;
  ageGroup: string;
  weightRange: string;
  type: 'standard' | 'special';
  rules: string;
  status: 'upcoming' | 'live' | 'done';
  matId?: string;
  startTime?: string;
  endTime?: string;
}

export interface Athlete {
  id: string;
  competitionId: string;
  categoryId: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  weight: number;
  country: string;
  state: string;
  district: string;
  academy: string;
  attendance: 'present' | 'absent';
  readiness: 'ready' | 'not-ready';
  disqualified: boolean;
  seedRating?: number; // Optional numeric rating for initial ranking
}

export interface Match {
  id: string;
  competitionId: string;
  categoryId: string;
  matId?: string;
  round: number; // e.g., 1 for Round of 16, 2 for Quarter-Finals, etc.
  bracketPosition: string; // e.g., 'R1-M1', 'R1-M2'
  status: 'upcoming' | 'ongoing' | 'paused' | 'finished';
  aka: {
    athleteId: string | null; // null if Bye or not yet decided
    name: string;
    isBye: boolean; // True if it's a "Bai" / Walkover
    score: number;
    penalties: string[];
    senshu: boolean;
  };
  ao: {
    athleteId: string | null;
    name: string;
    isBye: boolean;
    score: number;
    penalties: string[];
    senshu: boolean;
  };
  winnerId?: string | null; // ID of the winning athlete
  timer: number; // Seconds remaining or elapsed
}

export interface BracketGenerationResult {
  categoryId: string;
  matches: Match[];
  progressionType: 'Round Robin' | 'Repechage';
}
