import { z } from "zod";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const fact = z.object({
  isin: z.string().regex(/^IN[A-Z0-9]{10}$/),
  periodEnd: date,
  periodKind: z.enum(["annual", "quarter", "half-year", "point-in-time"]),
  basis: z.enum(["consolidated", "standalone"]),
  metric: z.string().min(1).max(80),
  dimension: z.enum(["amount", "per-share", "percentage", "multiple"]),
  value: z.number().finite(),
  unit: z.enum(["INR", "INR-lakh", "INR-crore", "INR/share", "%", "times"]),
  /** Stated rounding increment in the source unit, not guessed from rendered zeros. */
  roundingStep: z.number().finite().positive(),
  metadataVerified: z.literal(true),
});
export type FinancialFact = z.infer<typeof fact>;
const units = { INR: { dimension: "amount", factor: 1 }, "INR-lakh": { dimension: "amount", factor: 100000 },
  "INR-crore": { dimension: "amount", factor: 10000000 }, "INR/share": { dimension: "per-share", factor: 1 },
  "%": { dimension: "percentage", factor: 1 }, times: { dimension: "multiple", factor: 1 } } as const;
/** Keep stated decimal observations exact while comparing their rounding intervals. */
function decimal(value: number, factor: number) {
  const [coefficient, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  return { coefficient: BigInt(whole + fraction), power: Number(exponent) - fraction.length + Math.log10(factor) };
}
/** Compare explicitly verified observations only. Consistency is not an investment-research release. */
export function reconcileFinancialFact(reported: unknown, filing: unknown): {
  state: "consistent" | "different" | "unverified";
  reason: string;
  difference: number | null;
  allowedRoundingDifference: number | null;
  valuationReady: false;
} {
  const result = (state: "consistent" | "different" | "unverified", reason: string, difference: number | null = null, allowedRoundingDifference: number | null = null) =>
    ({ state, reason, difference, allowedRoundingDifference, valuationReady: false as const });
  const a = fact.safeParse(reported), b = fact.safeParse(filing);
  if (!a.success || !b.success) return result("unverified", "Identity, period, basis, units and rounding metadata must be verified.");
  if (["isin", "periodEnd", "periodKind", "basis", "metric", "dimension"].some((key) => a.data[key as keyof FinancialFact] !== b.data[key as keyof FinancialFact]))
    return result("unverified", "The observations do not describe the same security, metric, period and reporting basis.");
  const left = units[a.data.unit], right = units[b.data.unit];
  if (left.dimension !== a.data.dimension || right.dimension !== b.data.dimension)
    return result("unverified", "The unit does not match the financial metric dimension.");
  const x = a.data.value * left.factor, y = b.data.value * right.factor;
  const tolerance = (a.data.roundingStep * left.factor + b.data.roundingStep * right.factor) / 2;
  if ([x, y, tolerance].some((v) => !Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER))
    return result("unverified", "The normalized amounts exceed reliable numeric limits.");
  const parts = [decimal(a.data.value, left.factor), decimal(b.data.value, right.factor),
    decimal(a.data.roundingStep, left.factor), decimal(b.data.roundingStep, right.factor)];
  const power = Math.min(...parts.map((p) => p.power));
  const scaled = parts.map((p) => p.coefficient * BigInt(10) ** BigInt(p.power - power));
  const delta = scaled[0] - scaled[1], absolute = delta < BigInt(0) ? -delta : delta;
  const stepSum = scaled[2] + scaled[3];
  const consistent = absolute * BigInt(2) <= stepSum;
  const difference = Number(`${absolute}e${power}`);
  const exactTolerance = Number(`${stepSum * BigInt(5)}e${power - 1}`);
  return result(consistent ? "consistent" : "different",
    consistent ? "Values are consistent within the stated source rounding." : "Values differ beyond the stated source rounding.", difference, exactTolerance);
}
