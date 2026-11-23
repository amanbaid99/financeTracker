import { z } from "zod";
export const goalPlanningSchema = z.object({
  emergencyReserve:z.number().int().min(0).max(1e13).optional(),
  emergencyReserveDate:z.iso.date().nullable().optional(),
  targetType: z.enum(["today", "future"]).optional(),
  priorityLevel: z.enum(["high", "medium", "low"]).optional(),
  goalCategory: z.enum(["essential", "flexible"]).optional(),
  minimumMonthly: z.number().int().min(0).max(1e9).optional(),
  expectedReturnPct: z.number().gt(-100).max(100).nullable().optional(),
  completed: z.boolean().optional(),
});
export const holdingPlanningSchema = z.object({
  availability: z
    .enum(["available", "locked", "pledged", "unavailable"])
    .optional(),
  accessibleOn: z.iso.date().nullable().optional(),
  valuationDate: z.iso.date().nullable().optional(),
});
export const readGoalPlanning = (raw: unknown) =>
  goalPlanningSchema.safeParse(raw).data ?? {};
export const readHoldingPlanning = (raw: unknown) =>
  holdingPlanningSchema.safeParse(raw).data ?? {};
