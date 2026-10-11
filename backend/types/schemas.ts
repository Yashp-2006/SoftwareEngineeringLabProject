import { z } from 'zod';

// Base schemas
export const athleteSchema = z.object({
  playerId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  gender: z.string().optional(),
  weight: z.number().optional(),
  age: z.number().optional(),
  academy: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Category name is required'),
  discipline: z.string().optional(),
  gender: z.string().optional(),
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  minWeight: z.number().optional(),
  maxWeight: z.number().optional(),
  isKata: z.boolean().optional(),
  judgeCount: z.number().optional(),
  entries: z.number().optional(),
  athletes: z.array(athleteSchema).optional(),
  isSpecial: z.boolean().optional(),
  matchTime: z.number().optional(),
  restTime: z.number().optional(),
  medicalTime: z.number().optional(),
  bunkaiTime: z.number().optional(),
});

// Setup Wizard API Schemas
export const saveSetupDraftSchema = z.object({
  competitionId: z.string(),
  compName: z.string(),
  matsCount: z.number(),
  poolSize: z.number(),
  compRules: z.string(),
  compType: z.string(),
  bronzeRule: z.enum(['one', 'two']),
  wkfMode: z.string().optional(),
  wkfKataJudgeCount: z.number().optional(),
  categories: z.array(categorySchema),
  importResult: z.any().optional(),
  scoreboardLogo: z.string().nullable().optional(),
  lastActivePhase: z.number(),
  highestPhase: z.number(),
  tournamentDays: z.number().optional(),
  globalMatchTime: z.number().optional(),
  globalRestTime: z.number().optional(),
  globalMedicalTime: z.number().optional(),
  globalBunkaiTime: z.number().optional(),
  poolsSchedule: z.record(z.string(), z.object({
    matId: z.number(),
    day: z.number(),
    order: z.number(),
    estTime: z.number()
  })).optional()
});

export const deployTournamentSchema = z.object({
  competitionId: z.string(),
  compName: z.string(),
  matsCount: z.number(),
  poolSize: z.number(),
  compRules: z.string(),
  compType: z.string(),
  bronzeRule: z.enum(['one', 'two']),
  wkfMode: z.string().optional(),
  wkfKataJudgeCount: z.number().optional(),
  categories: z.array(categorySchema),
  hideEmpty: z.boolean().optional(),
  scoreboardLogo: z.string().nullable().optional(),
  tournamentDays: z.number().optional(),
  globalMatchTime: z.number().optional(),
  globalRestTime: z.number().optional(),
  globalMedicalTime: z.number().optional(),
  globalBunkaiTime: z.number().optional(),
  poolsSchedule: z.record(z.string(), z.object({
    matId: z.number(),
    day: z.number(),
    order: z.number(),
    estTime: z.number()
  })).optional()
});

export const assignStaffSchema = z.object({
  competitionId: z.string(),
  assignmentId: z.string(),
  updates: z.any()
});

export const updateScheduleSchema = z.object({
  competitionId: z.string(),
  changes: z.array(z.object({
    id: z.string(),
    scheduledStartTime: z.string().nullable(),
    scheduledEndTime: z.string().nullable()
  }))
});

// API Request Schemas
export const addAthleteSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  athleteData: athleteSchema.extend({
    interestSpecial: z.string().optional().nullable(),
  }),
});

export const updateBracketSchema = z.object({
  matchId: z.string().min(1, 'Match ID is required'),
  winnerId: z.string().optional().nullable(),
  byeFor: z.enum(['aka', 'ao']).optional().nullable(),
  selectedKata: z.any().optional().nullable(),
  action: z.enum(['revert']).optional().nullable(),
  akaScore: z.number().optional().nullable(),
  aoScore: z.number().optional().nullable(),
  akaIppon: z.number().optional().nullable(),
  akaWazaari: z.number().optional().nullable(),
  akaYuko: z.number().optional().nullable(),
  akaSenshu: z.boolean().optional().nullable(),
  akaC1: z.number().optional().nullable(),
  akaC2: z.number().optional().nullable(),
  aoIppon: z.number().optional().nullable(),
  aoWazaari: z.number().optional().nullable(),
  aoYuko: z.number().optional().nullable(),
  aoSenshu: z.boolean().optional().nullable(),
  aoC1: z.number().optional().nullable(),
  aoC2: z.number().optional().nullable(),
  kataVotes: z.any().optional().nullable(),
});

export const swapMatchSchema = z.object({
  sourceMatchId: z.string().optional(),
  matchId: z.string().optional(),
  sourceSide: z.enum(['aka', 'ao']).optional(),
  targetMatchId: z.string().optional(),
  targetSide: z.enum(['aka', 'ao']).optional(),
  targetCategoryId: z.string().optional().nullable(),
  action: z.enum(['move', 'swap']).optional().default('swap'),
  targetPlayerId: z.string().optional().nullable(),
  sourcePlayerId: z.string().optional().nullable(),
});

export const generateBracketSchema = z.object({
  categoryId: z.string().optional(),
  categoryIds: z.array(z.string()).optional(),
  specialCategoryId: z.string().optional(),
  poolSize: z.union([z.number(), z.string()]).optional(),
  compType: z.string().optional(),
  useRoundRobin: z.boolean().optional(),
  rebucketAll: z.boolean().optional(),
  wkfMode: z.string().optional(),
  compRules: z.string().optional(),
});

export const matPasswordSchema = z.object({
  matId: z.string().optional(),
  password: z.string().optional(),
  bulkPasswords: z.array(z.object({
    id: z.string(),
    password: z.string(),
  })).optional(),
}).refine(data => (data.matId && data.password !== undefined) || data.bulkPasswords, {
  message: "Either matId and password, or bulkPasswords must be provided",
});
