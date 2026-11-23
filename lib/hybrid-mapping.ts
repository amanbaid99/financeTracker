import { sipPlan } from "./sip-plan";
import { categoryLabel } from "./categories";
import { autoAllocate } from "./auto-allocate";
import {
  trackGoal,
  type Investment,
  type GoalInput,
  type Link,
} from "./tracker";
import {
  checkedGoalLinks,
  calculateHybrid,
  hybridCategory,
  type HybridInput,
} from "./hybrid-engine";
/** Keep confirmed ownership stable by default. An explicit reviewed proposal can release excess coverage. */
export function proposeGoalMapping(
  goals: GoalInput[],
  investments: Investment[],
  pinned: Link[],
  today: string,
  options: {
    refresh?: boolean;
    riskTolerance?: HybridInput["riskTolerance"];
  } = {},
): Link[] {
  let base = checkedGoalLinks(goals, investments, pinned);
  if (options.refresh) {
    const existing = calculateHybrid({
      today,
      goals,
      investments,
      links: base,
      monthlySavings: 0,
      riskTolerance: options.riskTolerance,
    });
    base = base
      .map((l) => {
        const goal = existing.goals.find((g) => g.goalId === l.goalId)!;
        const share =
          goal.targetCorpus===0?0:goal.projectedExistingCorpus > 0
            ? Math.min(1, goal.targetCorpus / goal.projectedExistingCorpus)
            : 1;
        return {
          ...l,
          percent: Math.min(
            l.percent,
            Math.ceil(l.percent * share * 100) / 100,
          ),
        };
      })
      .filter((l) => l.percent > 0);
  }

  const free = investments
    .filter((i) => !i.availability || i.availability === "available")
    .map((i) => {
      const used = base
        .filter((l) => l.investmentId === i.id)
        .reduce((s, l) => s + l.percent, 0);
      return {
        ...i,
        value: Math.floor(
          (i.value * Math.max(0, 10000 - Math.round(used * 100))) / 10000,
        ),
        monthlySip: 0,
      };
    });
  const funding = calculateHybrid({
    today,
    goals,
    investments,
    links: base,
    monthlySavings: 0,
    riskTolerance: options.riskTolerance,
  });
  const remaining = goals
    .filter(
      (g) =>
        !g.completed &&
        (g.targetDate ||
          ["emergency_fund", "bills_fund", "loan_payoff"].includes(g.type)),
    )
    .map((g) => {
      const r = funding.goals.find((r) => r.goalId === g.id)!;
      return trackGoal(
        { ...g, target: r.fundingGap, inflationPct: 0 },
        free,
        [],
        today,
      );
    });
  const essential = remaining.filter(
    (g) =>
      (g.goalCategory ??
        (["emergency_fund", "bills_fund", "loan_payoff"].includes(g.type)
          ? "essential"
          : "flexible")) === "essential",
  );
  const essentialsSuggestions = essential.map((g) => {
    const horizon = hybridCategory(g.months, g.type);
    return {
      goalId: g.id,
      goalName: g.name,
      monthly: 1,
      lump: 0,
      ...horizon,
      categoryLabel: categoryLabel(horizon.category),
      after: g,
      stage: "ranked" as const,
    };
  });
  const essentialVehicles = new Set(
    sipPlan(essentialsSuggestions, free, base, "pooled", goals).flatMap((l) =>
      l.investment ? [l.investment.id] : [],
    ),
  );
  for (const l of base)
    if (essential.some((g) => g.id === l.goalId))
      essentialVehicles.add(l.investmentId);
  const safetyLinks = autoAllocate(
    essential,
    free.filter((i) => essentialVehicles.has(i.id)),
    today,
  ).links;
  const safetyIds = new Set(
    [
      ...safetyLinks,
      ...base.filter((l) =>
        goals.some(
          (g) =>
            g.id === l.goalId &&
            ((g.goalCategory??(["emergency_fund", "bills_fund", "loan_payoff"].includes(g.type)?"essential":"flexible"))==="essential"),
        ),
      ),
    ].map((l) => l.investmentId),
  );
  const proposed = [
    ...safetyLinks,
    ...autoAllocate(
      remaining.filter((g) => !essential.includes(g)),
      free.filter((i) => !safetyIds.has(i.id)),
      today,
    ).links,
  ];
  const result = base.map((l) => ({ ...l }));
  for (const l of proposed.sort(
    (a, b) =>
      a.goalId.localeCompare(b.goalId) ||
      a.investmentId.localeCompare(b.investmentId),
  )) {
    const used = base
      .filter((x) => x.investmentId === l.investmentId)
      .reduce((s, x) => s + x.percent, 0);
    const percent = Math.floor(l.percent * (100 - used)) / 100;
    if (percent <= 0) continue;
    const old = result.find(
      (x) => x.goalId === l.goalId && x.investmentId === l.investmentId,
    );
    if (old) old.percent = Math.round((old.percent + percent) * 100) / 100;
    else result.push({ ...l, percent });
  }
  return checkedGoalLinks(goals, investments, result);
}

/** Compare ownership, not database row IDs or retrieval order. */
export function sameGoalMapping(a:Link[],b:Link[]){
 const canonical=(links:Link[])=>JSON.stringify(links.map(l=>[l.goalId,l.investmentId,Math.round(l.percent*100)]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));
 return canonical(a)===canonical(b);
}
