import { z } from "zod";
import type { TrackedGoal } from "./tracker";
import { orderGoals } from "./goal-order";

export const BUCKET_KINDS = {
  fixed: "Fixed costs", investing: "Investing", debt: "Debt repayment", savings: "Savings", custom: "Custom",
} as const;
const percent = z.number().min(0).max(100).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use up to two decimal places.");
const label = z.string().trim().min(1, "Give each bucket a name.").max(60);
const childSchema = z.object({ id: z.string().min(1).max(80), label, percent, goalId: z.string().uuid().nullable() });
const bucketSchema = z.object({ id: z.string().min(1).max(80), label, kind: z.enum(["fixed", "investing", "debt", "savings", "custom"]), percent, children: z.array(childSchema).max(20) });
export const ratioPlanSchema = z.object({ version: z.literal(1), salary: z.number().int().positive("Enter your monthly take-home salary.").max(1e9), buckets: z.array(bucketSchema).min(1).max(12) }).superRefine((p, ctx) => {
  if (basisTotal(p.buckets) !== 10000) ctx.addIssue({ code: "custom", message: "Your main buckets must add up to 100%.", path: ["buckets"] });
  const ids = new Set<string>();
  const goals = new Set<string>();
  for (const b of p.buckets) {
    if (basisTotal(b.children) > 10000) ctx.addIssue({ code: "custom", message: `${b.label}: smaller buckets exceed 100%.`, path: ["buckets"] });
    for (const item of [b, ...b.children]) {
      if (ids.has(item.id)) ctx.addIssue({ code: "custom", message: "Each bucket needs its own ID." });
      ids.add(item.id);
    }
    for (const child of b.children) if (child.goalId) {
      if (goals.has(child.goalId)) ctx.addIssue({ code: "custom", message: "Link each goal only once to avoid counting it twice." });
      goals.add(child.goalId);
    }
  }
});
export type RatioPlan = z.infer<typeof ratioPlanSchema>;
export type RatioBucket = RatioPlan["buckets"][number];
export type RatioChild = RatioBucket["children"][number];
export type RatioContext = {
  costs: { name: string; amount: number }[];
  loanEmis: { name: string; emi: number }[];
  sips: number;
  goals: TrackedGoal[];
  today: string;
};
export const basisTotal = (items: { percent: number }[]) => items.reduce((s, i) => s + Math.round((Number.isFinite(i.percent) ? i.percent : 0) * 100), 0);

/** Largest remainders keep every rupee, including with fractional ratios. Never normalise an invalid over-allocation. */
export function splitRupees(total: number, percentages: number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || total > 1e9 || percentages.some((p) => !Number.isFinite(p) || p < 0 || p > 100)) return percentages.map(() => 0);
  const points = percentages.map((p) => Math.round(p * 100));
  const sum = points.reduce((a, b) => a + b, 0);
  if (sum > 10000) return percentages.map(() => 0);
  const amounts = points.map((p) => Math.floor(total * p / 10000));
  let left = Math.round(total * sum / 10000) - amounts.reduce((a, b) => a + b, 0);
  const order = points.map((p, i) => ({ i, fraction: total * p % 10000 })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of order) { if (left <= 0) break; amounts[i]++; left--; }
  return amounts;
}
function proportions(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const scaled = weights.map((w) => w / sum * 10000);
  const points = scaled.map(Math.floor);
  let left = 10000 - points.reduce((a, b) => a + b, 0);
  for (const { i } of scaled.map((n, i) => ({ i, fraction: n - points[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i)) {
    if (left <= 0) break;
    points[i]++; left--;
  }
  return points.map((p) => p / 100);
}
export function defaultRatioPlan(salary: number): RatioPlan {
  return { version: 1, salary, buckets: [
    { id: "fixed", label: "Fixed costs", kind: "fixed", percent: 50, children: [] },
    { id: "investing", label: "Investing", kind: "investing", percent: 30, children: [] },
    { id: "debt", label: "Debt repayment", kind: "debt", percent: 0, children: [] },
    { id: "savings", label: "Savings", kind: "savings", percent: 20, children: [] },
  ] };
}
export function ratioWarnings(plan: RatioPlan, context: RatioContext): string[] {
  const amounts = splitRupees(plan.salary, plan.buckets.map((b) => b.percent));
  const budgetFor = (kind: RatioBucket["kind"]) => plan.buckets.reduce((s, b, i) => s + (b.kind === kind ? amounts[i] : 0), 0);
  const warnings: string[] = [];
  const fixed = context.costs.reduce((s, c) => s + c.amount, 0);
  const debt = context.loanEmis.reduce((s, c) => s + c.emi, 0);
  if (budgetFor("fixed") < fixed) warnings.push("Fixed costs are below your recorded monthly costs.");
  if (budgetFor("debt") < debt) warnings.push("Debt repayment is below your scheduled EMIs. Existing EMIs still need to be paid.");
  if (budgetFor("investing") + budgetFor("savings") < context.sips) warnings.push("Savings and investing together are below your current SIPs. Saving this budget does not reduce any SIP.");
  if (fixed + debt + context.sips > plan.salary) warnings.push("Your recorded costs, EMIs and SIPs exceed this salary. The proposed split cannot cover them all.");
  return warnings;
}

/** A reviewable starting point: commitments first, then savings and investing. No external AI call. */
export function suggestRatioPlan(salary: number, context: RatioContext): { plan: RatioPlan; reasons: string[] } {
  const plan = defaultRatioPlan(salary);
  if (!Number.isSafeInteger(salary) || salary <= 0 || salary > 1e9) return { plan, reasons: ["Enter your monthly take-home salary first."] };
  const recordedFixed = context.costs.reduce((s, c) => s + c.amount, 0);
  const fixed = recordedFixed || Math.round(salary * 0.5);
  const debt = context.loanEmis.reduce((s, c) => s + c.emi, 0);
  const spare = Math.max(0, salary - fixed - debt - context.sips);
  const needsSafety = context.goals.some((g) => g.type === "emergency_fund" && g.status !== "reached");
  const savingsSips = Math.min(context.sips, context.goals.filter((g) => g.type === "emergency_fund" || !!g.billsFund).reduce((sum, g) => sum + g.monthlySip, 0));
  const extraSavings = Math.round(spare * (needsSafety ? 0.6 : 0.4));
  const savings = savingsSips + extraSavings;
  const investing = context.sips - savingsSips + spare - extraSavings;
  const ratios = proportions([fixed, investing, debt, savings]);
  plan.buckets = plan.buckets.map((b, i) => ({ ...b, percent: ratios[i] }));
  plan.buckets = plan.buckets.map((b) => ({ ...b, children: suggestChildren(b, splitRupees(salary, ratios)[plan.buckets.indexOf(b)], context) }));
  return { plan, reasons: [
    recordedFixed ? "Fixed costs start from your recorded monthly costs." : "No monthly costs recorded: fixed costs start at an editable 50% of salary.",
    "Scheduled EMIs and existing SIPs are included once before splitting the remaining money.",
    needsSafety ? "More of the remaining money goes to Savings while your emergency goal is unfinished." : "The remaining money is split 60% to Investing and 40% to Savings.",
    "Goal splits follow your goal order and monthly needs. They are planning amounts, not new SIP orders.",
  ] };
}

/** Percentages belong to the parent, not the salary. A goal is linked at most once by automatic splits. */
export function suggestChildren(bucket: RatioBucket, amount: number, context: RatioContext): RatioChild[] {
  if (amount <= 0) return [];
  const rows = bucket.kind === "fixed" ? context.costs.map((c) => ({ label: c.name, weight: c.amount }))
    : bucket.kind === "debt" ? context.loanEmis.map((l) => ({ label: l.name, weight: l.emi })) : [];
  if (rows.length) {
    const selected = rows.slice(0, 19);
    if (rows.length > 19) selected.push({ label: "Other commitments", weight: rows.slice(19).reduce((s, r) => s + r.weight, 0) });
    const shares = proportions(selected.map((r) => r.weight));
    return selected.map((r, i) => ({ id: `${bucket.id}-detail-${i}`, label: r.label.slice(0, 60), percent: shares[i], goalId: null }));
  }
  if (bucket.kind !== "savings" && bucket.kind !== "investing") return [];
  const goals = orderGoals(context.goals, context.today).filter((g) => g.status !== "reached" && !g.loanState && (bucket.kind === "savings" ? g.type === "emergency_fund" || !!g.billsFund : g.type !== "emergency_fund" && !g.billsFund)).slice(0, 20);
  let remaining = amount;
  const allocations = goals.map((g) => {
    const need = Math.max(0, Math.ceil(g.monthlySip + g.extraSipNeeded)) || Math.ceil(Math.max(0, g.futureTarget - g.current) / Math.max(1, g.months ?? 12));
    const assigned = Math.min(remaining, need);
    remaining -= assigned;
    return { goal: g, assigned };
  }).filter((a) => a.assigned > 0);
  // Round down so the leftover never becomes a false over-allocation.
  return allocations.map(({ goal, assigned }) => ({ id: `${bucket.id}-goal-${goal.id}`, label: goal.name.slice(0, 60), percent: Math.floor(assigned / amount * 10000) / 100, goalId: goal.id }));
}
