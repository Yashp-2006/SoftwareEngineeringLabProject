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
