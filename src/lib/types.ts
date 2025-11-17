import { z } from "zod";

// Zod schemas for JSON columns and payloads
export const ZSession = z.object({
  id: z.string(), // stable id within plan
  date: z.string().optional(), // ISO date if scheduled
  type: z.enum(["easy", "tempo", "interval", "long", "recovery", "hill", "strength", "mobility", "other"]),
  title: z.string(),
  description: z.string().default(""),
  distance_km: z.number().optional(),
  duration_min: z.number().optional(),
  pace_min_per_km: z.string().optional(),
  rpe: z.number().min(1).max(10).optional(),
  planned: z.boolean().default(true),
  done: z.boolean().default(false),
});
export type Session = z.infer<typeof ZSession>;

export const ZWeek = z.object({
  weekNumber: z.number().int().min(1),
  start: z.string(), // ISO date (Mon)
  focus: z.enum(["base", "build", "peak", "taper", "recovery"]).default("base"),
  total_km: z.number().nonnegative(),
  sessions: z.array(ZSession),
});
export type Week = z.infer<typeof ZWeek>;

export const ZPlanData = z.object({
  goal: z.object({
    distance_km: z.number().positive(),
    race_date: z.string(), // ISO date
    target_time_min: z.number().optional(),
    units: z.enum(["metric", "imperial"]).default("metric"),
  }),
  meta: z.object({
    created_at: z.string(),
    updated_at: z.string(),
    seed_avg_km: z.number().optional(),
    weekly_days: z.number().int().min(1).max(7).optional(),
  }),
  weeks: z.array(ZWeek),
});
export type PlanData = z.infer<typeof ZPlanData>;

export const ZPRs = z.object({
  pr5k_min: z.number().optional(),
  pr10k_min: z.number().optional(),
  prHalf_min: z.number().optional(),
  prMarathon_min: z.number().optional(),
});
export type PRs = z.infer<typeof ZPRs>;

export const ZSettings = z.object({
  units: z.enum(["metric", "imperial"]).default("metric"),
  weekly_days: z.number().int().min(1).max(7).optional(),
  weekly_time_min: z.number().int().optional(),
  prs: ZPRs.optional(),
  injuries: z.string().optional(),
  preferences: z.string().optional(),
  day_map: z.record(z.string(), z.array(z.string())).optional(), // e.g. { Mon: ["run"], Tue: ["strength"] }
});
export type Settings = z.infer<typeof ZSettings>;

export const ZAdherence = z.object({
  planned_sessions: z.number().int().nonnegative(),
  completed_sessions: z.number().int().nonnegative(),
  adherence_pct: z.number().min(0).max(100),
});
export type Adherence = z.infer<typeof ZAdherence>;
