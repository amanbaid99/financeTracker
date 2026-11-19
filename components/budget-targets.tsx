"use client";

import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { applyBudgetRules, budgetRulesSchema, budgetRuleGaps, budgetSheetSchema, rowAmount, targetAmount, type BudgetSheet, type BudgetRules } from "@/lib/budget-sheet";
import { formatINR } from "@/lib/format";

export function BudgetTargets({ plan, onClose, onApply }: { plan: BudgetSheet; onClose: () => void; onApply: (rules: BudgetRules) => void }) {
  const [rules, setRules] = useState<BudgetRules>(() => plan.rules ?? Object.fromEntries((["savings", "investing"] as const).map((category) => {
    const amount = plan.rows.filter((r) => r.category === category).reduce((s, r) => s + rowAmount(r, plan.salary), 0);
    // Round upward so the starting target never falls below an existing named allocation.
    return [category, { mode: "percent", value: plan.salary > 0 ? Math.ceil(amount / plan.salary * 10000) / 100 : 0 }];
  })) as BudgetRules);
  const preview = applyBudgetRules({ ...plan, rules });
  const gaps = budgetRuleGaps(preview);
  const personal = preview.rows.filter((r) => r.category === "personal").reduce((s, r) => s + rowAmount(r, plan.salary), 0);
  const excess = Math.max(0, preview.rows.reduce((s, r) => s + rowAmount(r, plan.salary), 0) - plan.salary);
  const valid = plan.salary > 0 && budgetRulesSchema.safeParse(rules).success && budgetSheetSchema.safeParse(preview).success && gaps.length === 0;
  return <Sheet title={plan.rules ? "Change your targets" : "Set your budget rules"} onClose={onClose}>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Keep savings and investing at these targets. What remains after commitments goes to Personal spending.</p>
      {!plan.rules && <p className="text-xs text-muted-foreground">Starts from your current allocations. These are category totals, including existing SIPs and named items.</p>}
      {(["savings", "investing"] as const).map((category) => <div key={category} className="space-y-2">
        <label htmlFor={`target-${category}`} className="block text-sm font-medium">{category === "savings" ? "Savings target" : "Investing target"}</label>
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
          {rules[category].mode === "amount" ? <MoneyInput id={`target-${category}`} value={rules[category].value} onChange={(v) => setRules((r) => ({ ...r, [category]: { ...r[category], value: v ?? 0 } }))} /> : <Input id={`target-${category}`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={rules[category].value} onChange={(e) => setRules((r) => ({ ...r, [category]: { ...r[category], value: Number(e.target.value) } }))} />}
          <Select aria-label={`${category} target basis`} value={rules[category].mode} onChange={(e) => {
            const mode = e.target.value as "amount" | "percent";
            const amount = targetAmount(rules[category], plan.salary);
            setRules((r) => ({ ...r, [category]: { mode, value: mode === "amount" ? amount : plan.salary > 0 ? Math.ceil(amount / plan.salary * 10000) / 100 : 0 } }));
          }}><option value="percent">% income</option><option value="amount">₹ fixed</option></Select>
        </div>
        <p className="text-xs text-muted-foreground">{formatINR(targetAmount(rules[category], plan.salary))} a month. {rules[category].mode === "percent" ? "Changes with your income." : "Stays fixed when income changes."}</p>
      </div>)}
      <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1"><p>Personal spending: <b className="tabular">{formatINR(personal)}</b>{plan.salary > 0 ? ` (${(personal / plan.salary * 100).toFixed(1)}% of income)` : ""}</p><p className="text-xs text-muted-foreground">Includes named personal costs and whatever is free to spend. For a 20–25% personal-spending range, adjust the targets to fit your commitments.</p></div>
      {gaps.map((gap) => <p key={gap.category} role="alert" className="text-sm text-danger">Your named {gap.category} items exceed this target by {formatINR(gap.excess)}. Raise the target or edit those items first.</p>)}
      {excess > 0 && <p role="alert" className="text-sm text-danger">There is a {formatINR(excess)} shortfall. Your targets and existing costs are kept; nothing has been reduced.</p>}
      {!budgetRulesSchema.safeParse(rules).success && <p role="alert" className="text-sm text-danger">Use whole rupees or a percentage from 0 to 100 with up to two decimal places.</p>}
      <Button className="w-full" disabled={!valid} onClick={() => onApply(rules)}>Use these targets</Button>
      <p className="text-xs text-muted-foreground">Updates the draft. Tap Save to keep your rules.</p>
    </div>
  </Sheet>;
}
