// backend/types/index.ts
// Shared TypeScript types for the TaikaiX engine.

export type UserRole =
  | 'admin'
  | 'mat_operator'
  | 'attendance_volunteer'
  | 'judge'
  | 'guest_viewer'
  | 'viewer'
  | 'medal_distributor'
  | 'audience'
  | null;

export type PoolSize = 4 | 8 | 16 | 32;

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole | string;
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
  wkfKataJudgeCount?: 3 | 5 | 7;
}

export interface Category {
  id: string;
  competitionId?: string;
  name: string;
  ageGroup?: string;
  weightRange?: string;
  type?: 'standard' | 'special';
  rules?: string;
  status?: 'upcoming' | 'live' | 'done' | string;
  matId?: string;
  mat?: string;
  order?: number;
  startTime?: string;
  endTime?: string;
  scheduledStartTime?: string;
  isKata?: boolean;
  judgeCount?: 3 | 5 | 7;
  numberOfJudges?: number;
  allowedKataList?: number[];
  kataFormat?: 'elimination' | 'round-robin';
  isTeam?: boolean;
  athletes?: Athlete[];
  matches?: Match[];
}

export interface Athlete {
  id?: string;
  playerId?: string;
  competitionId?: string;
  categoryId?: string;
  name: string;
  gender?: 'M' | 'F' | 'Unknown' | string;
  age?: number;
  weight?: number;
  country?: string;
  state?: string;
  district?: string;
  academy?: string;
  attendance?: 'present' | 'absent';
  readiness?: 'ready' | 'not-ready';
  disqualified?: boolean;
  seedRating?: number; // Optional numeric rating for initial ranking
  pool?: string;
  coachName?: string;
  phone?: string;
  email?: string;
  medal?: 'gold' | 'silver' | 'bronze' | 'received' | 'not-received' | null;
  medalReceived?: 'received' | 'not-received';
  sourceCategory?: string;
  interestSpecial?: string | null;
  events?: string[];
}

export interface Match {
  id: string;
  competitionId?: string;
  categoryId?: string;
  matId?: string;
  mat?: string | null;
  round: number; // e.g., 1 for Round of 16, 2 for Quarter-Finals, etc.
  matchNumber?: number;
  bracketPosition?: string; // e.g., 'R1-M1', 'R1-M2'
  status?: 'upcoming' | 'ongoing' | 'paused' | 'finished' | 'completed' | 'live' | string;
  aka?: {
    athleteId?: string | null;
    playerId?: string;
    name?: string;
    isBye?: boolean;
    score?: number;
    penalties?: string[];
    senshu?: boolean;
    academy?: string | null;
    state?: string | null;
    country?: string | null;
    [key: string]: any;
  } | null;
  ao?: {
    athleteId?: string | null;
    playerId?: string;
    name?: string;
    isBye?: boolean;
    score?: number;
    penalties?: string[];
    senshu?: boolean;
    academy?: string | null;
    state?: string | null;
    country?: string | null;
    [key: string]: any;
  } | null;
  akaFromMatchId?: string | null;
  aoFromMatchId?: string | null;
  akaScore?: number;
  aoScore?: number;
  winnerId?: string | null;
  nextMatchId?: string | null;
  timer?: number;
  akaKata?: string;
  aoKata?: string;
  judgeVotes?: Record<string, 'aka' | 'ao'>;
  isKata?: boolean;
  [key: string]: any;
}

export interface BracketGenerationResult {
  categoryId: string;
  matches: Match[];
  progressionType: 'Round Robin' | 'Repechage';
}
