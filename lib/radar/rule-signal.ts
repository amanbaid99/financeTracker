import { z } from "zod";
import type { RadarAnalysis, RadarAsset } from "./contracts";
import type { EtfEvidence } from "./etf-data";
export const ruleSettingsSchema = z
  .object({
    rulesEnabled: z.boolean(),
    holdingConfirmed: z.boolean(),
    sellAbove: z.number().finite().positive().max(1e8).nullable(),
    sellBelow: z.number().finite().positive().max(1e8).nullable(),
    priceBelow: z.number().finite().positive().max(1e8).nullable(),
    drawdownPct: z.number().finite().min(1).max(80).nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.holdingConfirmed && (v.sellAbove !== null || v.sellBelow !== null))
      ctx.addIssue({
        code: "custom",
        message:
          "Confirm that you hold this instrument before setting sell rules.",
      });
    if (
      v.sellAbove !== null &&
      v.sellBelow !== null &&
      v.sellAbove <= v.sellBelow
    )
      ctx.addIssue({
        code: "custom",
        message: "The upper sell price must be above the lower exit price.",
      });
    if (
      v.rulesEnabled &&
      [v.priceBelow, v.drawdownPct, v.sellAbove, v.sellBelow].every(
        (x) => x === null,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Set at least one price or drawdown rule before enabling signals.",
      });
  });
export type RuleSettings = z.infer<typeof ruleSettingsSchema>;
export interface RuleSignal {
  label: "Buy" | "Hold" | "Sell" | "Wait" | "No signal";
  reason: string;
  asOf: string | null;
  checks: string[];
}
export interface EtfChecks {
  premiumPct: number | null;
  navAligned: boolean;
  spreadFresh: boolean;
  blockers: string[];
}
export function etfChecks(
  analysis: RadarAnalysis,
  evidence: EtfEvidence | undefined,
  expectedSession: string | null,
  now: string,
): EtfChecks {
  const blockers: string[] = [];
  const nav = evidence?.nav;
  const navAligned =
    !!nav &&
    !!expectedSession &&
    nav.date === analysis.asOf &&
    nav.date === expectedSession;
  const premiumPct =
    navAligned && analysis.close !== null
      ? (analysis.close / nav!.nav - 1) * 100
      : null;
  if (!nav) blockers.push("An official NAV matched by ISIN is missing.");
  else if (!navAligned)
    blockers.push(
      "NAV and closing price must be from the same latest completed session.",
    );
  const depth = evidence?.depth;
  const age = depth?.marketTime
    ? Date.parse(now) - Date.parse(depth.marketTime)
    : Infinity;
  const spreadFresh =
    !!depth &&
    depth.timestampVerified === true &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 15 * 60000;
  if (!spreadFresh)
    blockers.push(
      "A timestamped market spread from the last 15 minutes is missing. A recent fetch alone does not prove freshness.",
    );
  if (depth && depth.spreadPct > 0.5)
    blockers.push("Bid-ask spread exceeds the 0.5% buying-rule guardrail.");
  if (premiumPct !== null && premiumPct < -5)
    blockers.push(
      "Closing price is more than 5% below NAV. Check units, corporate actions and source data before using an entry rule.",
    );
  if (premiumPct !== null && premiumPct > 1)
    blockers.push("The same-session closing price was more than 1% above NAV.");
  return { premiumPct, navAligned, spreadFresh, blockers };
}
/** These are user-configured price triggers, not the balanced research model or an investment recommendation. */
export function ruleSignal({
  analysis,
  rules,
  asset,
  evidence,
  expectedSession,
  now,
}: {
  analysis: RadarAnalysis | null;
  rules: RuleSettings;
  asset: RadarAsset;
  evidence?: EtfEvidence;
  expectedSession: string | null;
  now: string;
}): RuleSignal {
  const result = (
    label: RuleSignal["label"],
    reason: string,
    checks: string[] = [],
  ): RuleSignal => ({ label, reason, asOf: analysis?.asOf ?? null, checks });
  if (!rules.rulesEnabled)
    return result("No signal", "Enable your price rules to see a signal.");
  if (!ruleSettingsSchema.safeParse(rules).success)
    return result("No signal", "Your saved rules need review.");
  if (!expectedSession)
    return result(
      "No signal",
      "The exchange calendar is not verified for this exchange or date. Price-rule signals are paused.",
    );
  if (!analysis || analysis.close === null || analysis.asOf !== expectedSession)
    return result(
      "No signal",
      "Refresh prices for the latest completed exchange session. Old prices cannot trigger a signal.",
    );
  const close = analysis.close;
  if (
    rules.holdingConfirmed &&
    ((rules.sellBelow !== null && close <= rules.sellBelow) ||
      (rules.sellAbove !== null && close >= rules.sellAbove))
  )
    return result(
      "Sell",
      rules.sellBelow !== null && close <= rules.sellBelow
        ? "The closing price reached your lower exit threshold. Review your saved rule before acting."
        : "The closing price reached your upper sell threshold. Review your saved rule before acting.",
    );
  const priceMet = rules.priceBelow !== null && close <= rules.priceBelow;
  const dipMet =
    rules.drawdownPct !== null &&
    analysis.inputs.adjustmentsVerified &&
    analysis.technicals.drawdown90 !== null &&
    analysis.technicals.drawdown90 <= -rules.drawdownPct;
  if (priceMet || dipMet) {
    if (asset !== "equity") {
      const checks = etfChecks(analysis, evidence, expectedSession, now);
      if (asset === "gold_etf" && !evidence?.nav?.goldEtf)
        checks.blockers.push(
          "AMFI has not identified this ISIN as a Gold ETF.",
        );
      if (checks.blockers.length)
        return result(
          "Wait",
          "Your buy threshold was reached, but ETF data checks block a Buy signal.",
          checks.blockers,
        );
    }
    return result(
      "Buy",
      priceMet
        ? "The closing price reached your buy-price threshold. This is your price rule, not a valuation recommendation."
        : "The adjusted price history reached your drawdown threshold. This is your rule, not a valuation recommendation.",
    );
  }
  const checks =
    rules.drawdownPct !== null && !analysis.inputs.adjustmentsVerified
      ? [
          "Drawdown rules are paused until corporate-action adjustments are verified.",
        ]
      : [];
  if (
    rules.holdingConfirmed &&
    (rules.sellAbove !== null || rules.sellBelow !== null)
  )
    return result(
      "Hold",
      "Neither of your saved exit thresholds was reached. This does not assess fundamentals or portfolio fit.",
      checks,
    );
  return result("Wait", "No enabled buy threshold was reached.", checks);
}

export function savedRules(item: {
  priceBelow: number | null;
  drawdownPct: number | null;
  rules?: RuleSettings;
}): RuleSettings {
  return (
    item.rules ?? {
      rulesEnabled: false,
      holdingConfirmed: false,
      sellAbove: null,
      sellBelow: null,
      priceBelow: item.priceBelow,
      drawdownPct: item.drawdownPct,
    }
  );
}
