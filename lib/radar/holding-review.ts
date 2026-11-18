import { z } from "zod";
import type { HoldingContext } from "./holding-context";
const percentage = z.number().finite().min(0).max(100);
export const holdingReviewInputSchema = z.object({
  ownershipConfirmed: z.literal(true), contextConfirmed: z.literal(true), costsReviewed: z.literal(true),
  targetSharePct: percentage, rebalanceBandPct: percentage,
  thesis: z.enum(["intact", "uncertain", "broken"]), estimatedExitCostPct: percentage,
}).strict();
export const holdingReviewSchema = holdingReviewInputSchema.extend({
  isin: z.string().regex(/^IN[A-Z0-9]{10}$/), reviewedAt: z.iso.datetime({ offset: true }),
}).strict();
export type HoldingReview = z.infer<typeof holdingReviewSchema>;
export function positionContext(review: unknown, isin: string | null, holding: HoldingContext | undefined) {
  const parsed = holdingReviewSchema.safeParse(review);
  if (!parsed.success || parsed.data.isin !== isin || !holding?.matched || holding.trackedSharePct == null || holding.recordedValue == null || holding.recordedValue <= 0) return;
  return { ...parsed.data, recordedSharePct: holding.trackedSharePct };
}
