import { z } from "zod";
import { addMonths, monthsBetween } from "@/lib/dates";
import { categoryLabel } from "@/lib/categories";
import { asKind } from "@/lib/instruments";
import { assetClassOf, ASSET_CLASSES, buildPortfolio } from "@/lib/portfolio";
import type { Investment, Link, TrackedGoal } from "@/lib/tracker";

export const snapshotSchema = z.object({
  total: z.number(),
  monthly: z.number(),
  classes: z.record(z.string(), z.number()),
  holdings: z.record(z.string(), z.number()),
  goals: z.record(z.string(), z.string()),
  issues: z.array(z.string()),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export interface Finding {
  id: string;
  title: string;
  detail: string;
  next: string;
  priority: "attention" | "watch";
  evidence: Record<string, number | string>;
}
export const findingSchema = z.object({
  id: z.string(), title: z.string(), detail: z.string(), next: z.string(),
  priority: z.enum(["attention", "watch"]),
  evidence: z.record(z.string(), z.union([z.number(), z.string()])),
});
export const resultSchema = z.object({
  findings: z.array(findingSchema),
  major: z.array(z.string()),
  ai: z.boolean(),
});
export type ReviewResult = z.infer<typeof resultSchema>;

/** All calculations and wording stay in the app. AI only orders checked findings. */
export function checkPortfolio(input: {
  investments: Investment[]; goals: TrackedGoal[]; links: Link[]; today: string;
}) {
  const { investments, goals, today } = input;
  const p = buildPortfolio(investments);
  const findings: Finding[] = [];
  const percent = (share: number) => `${Math.round(share * 100)}%`;
  for (const i of investments) {
    const share = p.total > 0 ? i.value / p.total : 0;
    const pooled = asKind(i.kind) === "mutual_fund" || /\betf\b|bees\b/i.test(i.name ?? "");
    const stock = asKind(i.kind) === "stock" && !pooled;
    if ((stock && share >= 0.2) || (pooled && share >= 0.35)) {
      findings.push({
        id: `concentration:${i.id}`, title: "A large share in one holding",
        detail: `${i.name?.trim() || categoryLabel(i.category)} is ${percent(share)} of your portfolio. ${stock ? "A single stock can move sharply." : "A fund may hold many investments, so this alone does not prove poor diversification."}`,
        next: "Review where new contributions go before adding more here. Check the fund's underlying investments before deciding to sell.",
        priority: "watch", evidence: { sharePercent: Math.round(share * 100), type: stock ? "stock" : "fund" },
      });
    }
  }
  for (const g of goals) {
    if (g.status === "reached") continue;
    if (g.status === "behind" || g.status === "overdue" || g.status === "no_investments" || g.billsFund?.short) {
      findings.push({ id: `shortfall:${g.id}`, title: "A goal needs attention",
        detail: `${g.name}: ${g.status === "overdue" ? "the target date has passed" : g.status === "no_investments" ? "no investments are linked yet" : "the current saving pace does not cover its planned needs"}.`,
        next: "Review this goal's plan before spreading new money elsewhere. Check the amount you can save or adjust its date.", priority: "attention", evidence: { status: g.status, extraMonthlyRounded: Math.round(g.extraSipNeeded / 1000) * 1000 } });
    }
    const near = g.targetDate && g.targetDate <= addMonths(today, 24);
    const needsStable = near || g.type === "emergency_fund" || g.type === "bills_fund";
    const risky = g.lines.filter(l => ["equity", "hybrid", "gold"].includes(assetClassOf(l.investment)))
      .reduce((sum, l) => sum + l.investment.value * l.percent / 100, 0);
    if (needsStable && risky > 0 && g.current > 0 && risky / g.current >= 0.2) {
      findings.push({ id: `near-term:${g.id}`, title: "Money needed soon can fluctuate",
        detail: `${g.name} has ${percent(risky / g.current)} of its linked value in equity, hybrid or gold holdings.`,
        next: "Consider directing new savings for this goal toward cash or a suitable liquid category. Review taxes, exit loads and lock-ins before moving existing money.", priority: "attention", evidence: { sharePercent: Math.round(risky / g.current * 100), monthsUntil: g.targetDate ? Math.max(0, monthsBetween(today, g.targetDate)) : 0 } });
    }
  }
  const categories = new Map<string, number>();
  for (const i of investments.filter(i => asKind(i.kind) === "mutual_fund" && (i.value > 0 || i.monthlySip > 0))) {
    if (i.category) categories.set(i.category, (categories.get(i.category) ?? 0) + 1);
  }
  for (const [category, count] of categories) {
    if (count >= 3) findings.push({ id: `similar:${category}`, title: "Several funds in the same category",
      detail: `You have ${count} holdings in ${categoryLabel(category).toLowerCase()}. This is a category check, not proof that their underlying investments overlap.`,
      next: "Check what each fund holds and the goal it serves before adding another fund in this category.", priority: "watch", evidence: { count } });
  }
  if (p.classes.some(c => c.key === "other" && c.share > 0.05)) {
    findings.push({ id: "unknown", title: "Some holdings need a category", detail: "Part of the portfolio cannot be classified reliably.",
      next: "Check the categories before deciding whether to rebalance.", priority: "attention", evidence: {} });
  }
  findings.sort((a,b) => Number(b.priority === "attention") - Number(a.priority === "attention") || a.id.localeCompare(b.id));
  const snapshot: Snapshot = {
    total: p.total,
    monthly: p.monthlySips,
    classes: Object.fromEntries(ASSET_CLASSES.map(c => [c.key, p.classes.find(x => x.key === c.key)?.share ?? 0])),
    holdings: Object.fromEntries(investments.map(i => [i.id, p.total > 0 ? i.value / p.total : 0])),
    goals: Object.fromEntries(goals.map(g => [g.id, g.status])),
    issues: findings.map(f => f.id),
  };
  return { findings, snapshot };
}

/** Compare with the last AI review, so small edits accumulate instead of resetting the threshold. */
export function majorChanges(before: Snapshot | null, after: Snapshot): string[] {
  if (!before) return ["There is no earlier review to compare with."];
  const changes: string[] = [];
  if (before.monthly !== after.monthly) changes.push("Monthly contributions changed.");
  if (before.total > 0 && Math.abs(after.total - before.total) / before.total >= 0.1)
    changes.push("Portfolio value changed by at least 10%. This may include deposits or withdrawals, not just market movement.");
  if (Object.keys(after.holdings).sort().join() !== Object.keys(before.holdings).sort().join())
    changes.push("The list of holdings changed.");
  if (Object.entries(after.classes).some(([key, share]) => Math.abs(share - (before.classes[key] ?? 0)) >= 0.05 - 1e-9))
    changes.push("An asset category's share changed by at least 5 percentage points.");
  if (Object.entries(after.holdings).some(([id, share]) => Math.abs(share - (before.holdings[id] ?? 0)) >= 0.05 - 1e-9))
    changes.push("A holding's share changed by at least 5 percentage points.");
  if (Object.entries(after.goals).some(([id, status]) => before.goals[id] !== status))
    changes.push("A goal's progress status changed.");
  if (after.issues.some(id => !before.issues.includes(id)) || before.issues.some(id => !after.issues.includes(id)))
    changes.push("A portfolio check changed.");
  return changes;
}

/** Send only codes, controlled categories, rounded amounts and app-computed facts. */
export function reviewFacts(investments: Investment[], goals: TrackedGoal[], findings: Finding[], major: string[]) {
  const p = buildPortfolio(investments);
  return {
    totalRounded: Math.round(p.total / 1000) * 1000,
    allocation: p.classes.map(c => ({ category: c.key, percent: Math.round(c.share * 100) })),
    holdings: [...investments].sort((a,b) => a.id.localeCompare(b.id)).map((i,n) => ({
      code: `I${n+1}`, category: assetClassOf(i), percent: p.total > 0 ? Math.round(i.value / p.total * 100) : 0,
    })),
    goals: goals.map((g,n) => ({ code: `G${n+1}`, status: g.status })),
    findings: findings.map((f,n) => ({ code: `F${n+1}`, priority: f.priority, check: f.id.split(":")[0], evidence: f.evidence })),
    changes: major,
  };
}

export const REVIEW_INSTRUCTIONS = `Prioritise a portfolio review from app-computed facts. Return only JSON {"order":["F1",...]}, including every supplied finding code exactly once. If no findings, return {"order":[]}. Put urgent goal shortfalls and near-term risk before general concentration checks. Do not calculate, invent findings, recommend trades, choose target allocations or name products. No other output.`;

export function orderFindings(text: string, findings: Finding[]): Finding[] | null {
  try {
    const parsed = z.object({ order: z.array(z.string()) }).strict().parse(JSON.parse(text));
    const codes = findings.map((_,n) => `F${n+1}`);
    if (parsed.order.length !== codes.length || new Set(parsed.order).size !== codes.length || parsed.order.some(c => !codes.includes(c))) return null;
    // A model cannot demote a goal risk below a watch item.
    return parsed.order.map(code => findings[codes.indexOf(code)])
      .sort((a,b) => Number(b.priority === "attention") - Number(a.priority === "attention"));
  } catch { return null; }
}
