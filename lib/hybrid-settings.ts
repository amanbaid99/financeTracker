import { z } from "zod";
export const goalPlanningSchema = z.object({
  emergencyTargetMonths: z.union([z.literal(1),z.literal(3),z.literal(6),z.literal(12),z.literal(24)]).optional(),
  retirementSpending: z.object({monthlyToday:z.number().int().min(1).max(1e9),years:z.number().int().min(1).max(60),inflationPct:z.number().min(0).max(20),afterTaxReturnPct:z.number().gt(-100).max(100)}).optional(),
  emergencyReserve: z.number().int().min(0).max(1e13).optional(),
  emergencyReserveDate: z.iso.date().nullable().optional(),
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
  /** You're keeping it but not putting new money in, so no SIP is planned. */
  noNewMoney: z.boolean().optional(),
});
export const readGoalPlanning = (raw: unknown) =>
  goalPlanningSchema.safeParse(raw).data ?? {};
export const readHoldingPlanning = (raw: unknown) =>
  holdingPlanningSchema.safeParse(raw).data ?? {};
