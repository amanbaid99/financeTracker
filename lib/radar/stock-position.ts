import { z } from "zod";
import { evaluateStock, type StockStudy } from "./stock-model";

const positionSchema = z.object({
  isin: z.string().regex(/^IN[A-Z0-9]{10}$/),
  ownershipConfirmed: z.literal(true),
  recordedSharePct: z.number().finite().min(0).max(100),
  targetSharePct: z.number().finite().min(0).max(100),
  /** A user-confirmed percentage-point allowance, never an age-derived stock target. */
  rebalanceBandPct: z.number().finite().min(0).max(100),
  thesis: z.enum(["intact", "uncertain", "broken"]),
  reviewedAt: z.iso.datetime({ offset: true }),
  costsReviewed: z.literal(true),
  estimatedExitCostPct: z.number().finite().min(0).max(100),
  contextConfirmed: z.literal(true),
});
export interface StockPositionStudy {
  version: "stock-position-paper-1";
  release: "paper";
  paperDecision: "Hold candidate" | "Review holding" | "Review selling" | null;
  entryStudy: StockStudy;
  missing: string[];
  reasons: string[];
  excessSharePct: number | null;
  estimatedExitCostPct: number | null;
  valuationReady: false;
}
/** Paper review only. Ownership and a price move alone never establish a sell case. */
export function evaluateStockPosition(input: Parameters<typeof evaluateStock>[0], position: unknown): StockPositionStudy {
  const entryStudy = evaluateStock(input);
  const result: StockPositionStudy = { version: "stock-position-paper-1", release: "paper", paperDecision: null,
    entryStudy, missing: [...entryStudy.missing], reasons: [], excessSharePct: null, estimatedExitCostPct: null, valuationReady: false };
  const parsed = positionSchema.safeParse(position);
  if (!parsed.success) {
    result.missing.push("Confirmed ownership, allocation target and band, reviewed thesis, dated context and exit-cost estimate are required.");
    return result;
  }
  const data = parsed.data;
  if (!input.isin || data.isin !== input.isin || data.recordedSharePct <= 0)
    result.missing.push("Holding context must identify a positive position in this exact investment.");
  const reviewedAt = Date.parse(data.reviewedAt), now = Date.parse(input.now);
  if (!Number.isFinite(now) || reviewedAt > now || now - reviewedAt > 90 * 86400000)
    result.missing.push("Holding context must be reviewed by assessment time and within the last 90 days.");
  if (result.missing.length || entryStudy.paperDecision === null) return result;
  result.estimatedExitCostPct = data.estimatedExitCostPct;
  result.excessSharePct = Math.max(0, data.recordedSharePct - data.targetSharePct);
  if (data.thesis === "broken") {
    result.paperDecision = "Review selling";
    result.reasons.push("The confirmed investment thesis is broken. Review the evidence and exit costs before acting.");
  } else if (result.excessSharePct > data.rebalanceBandPct) {
    result.paperDecision = "Review selling";
    result.reasons.push("The recorded allocation exceeds the confirmed target and allowance. Review rebalancing; this is not a full-exit instruction.");
  } else if (data.thesis === "uncertain" || entryStudy.paperDecision === "Wait") {
    result.paperDecision = "Review holding";
    result.reasons.push(data.thesis === "uncertain" ? "The investment thesis needs review." : "The entry study does not support a new purchase. That alone does not establish a sell case.");
  } else {
    result.paperDecision = "Hold candidate";
    result.reasons.push("The paper entry checks pass, the reviewed thesis is intact and allocation is within the confirmed allowance.");
  }
  result.reasons.push("Paper research only. Taxes, executable prices, liquidity, goal needs and alternatives have not been fully assessed.");
  return result;
}
