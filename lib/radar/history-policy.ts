import { z } from "zod";

/** Policy supplied by the owner from INDmoney support, 18 Nov 2026. Not an instrument event audit. */
const schema = z.object({
  version: z.literal("indstocks-history-policy-1"),
  source: z.literal("INDmoney support confirmation"),
  confirmedOn: z.literal("2026-11-18"),
  fetchedAt: z.iso.datetime({ offset: true }),
  prices: z.literal("split-and-bonus-adjusted"),
  volume: z.literal("unadjusted-shares"),
  consolidation: z.literal("only-when-recorded-as-split"),
  dividendsAdjusted: z.literal(false), rightsAdjusted: z.literal(false),
  mergersAdjusted: z.literal(false), demergersAdjusted: z.literal(false),
  roundingDecimals: z.literal(2),
  fullActionCoverageVerified: z.literal(false), turnoverBasisVerified: z.literal(false),
}).strict().refine((v) => Date.parse(v.fetchedAt) >= Date.parse("2026-11-18T00:00:00+05:30"));
export type HistoryPolicy = z.infer<typeof schema>;
export function indstocksHistoryPolicy(fetchedAt: string): HistoryPolicy {
  return schema.parse({ version: "indstocks-history-policy-1", source: "INDmoney support confirmation", confirmedOn: "2026-11-18", fetchedAt,
    prices: "split-and-bonus-adjusted", volume: "unadjusted-shares", consolidation: "only-when-recorded-as-split",
    dividendsAdjusted: false, rightsAdjusted: false, mergersAdjusted: false, demergersAdjusted: false,
    roundingDecimals: 2, fullActionCoverageVerified: false, turnoverBasisVerified: false });
}
export function readHistoryPolicy(value: unknown): HistoryPolicy | undefined {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export function historyBasisText(value: unknown): string {
  return readHistoryPolicy(value)
    ? "INDstocks confirms split- and bonus-adjusted prices. Volume is unadjusted. Dividends and some other corporate actions are excluded."
    : "Price adjustments are unverified for this saved snapshot.";
}
