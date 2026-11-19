"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { assistedBudget, moneyAvailable, suggestRemainingAllocation } from "@/lib/budget-assist";
import { rowAmount, type BudgetSheet } from "@/lib/budget-sheet";
import { formatINR } from "@/lib/format";

/** Keyed by the parent draft so an old proposal cannot be applied after another edit. */
export function BudgetRemainder({ plan, onApply }: { plan: BudgetSheet; onApply: (plan: BudgetSheet) => void }) {
  const [allocation, setAllocation] = useState(() => suggestRemainingAllocation(plan));
  const available = moneyAvailable(plan);
  const assigned = allocation.savings + allocation.investing + allocation.personal;
  const proposal = assistedBudget(plan, allocation);
  const hasMix = plan.rows.some((r) => ["savings", "investing", "personal"].includes(r.category) && rowAmount(r, plan.salary) > 0);
  return <div className="mt-2 space-y-3">
    <p className="text-xs text-muted-foreground">{hasMix ? "Suggested using your current savings, investing and guilt-free proportions." : "A starting split: 40% savings, 40% investing and 20% guilt-free."} Change any amount before accepting.</p>
    <div className="space-y-2">{([
      ["savings", "Savings"], ["investing", "Investing"], ["personal", "Guilt-free spending"],
    ] as const).map(([category, label]) => <label key={category} className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] items-center gap-3 text-sm">
      <span>{label}</span><MoneyInput aria-label={`Additional ${label.toLowerCase()}`} value={allocation[category]} onChange={(value) => setAllocation((previous) => ({ ...previous, [category]: value ?? 0 }))} />
    </label>)}</div>
    {assigned > available ? <p role="alert" className="text-xs text-danger">Reduce this split by {formatINR(assigned - available)}.</p> : assigned < available ? <p className="text-xs text-muted-foreground">{formatINR(available - assigned)} will stay unassigned.</p> : null}
    {!proposal && assigned <= available && <p role="alert" className="text-xs text-danger">This split exceeds the budget limits. Reduce the amounts or remove an unused item.</p>}
    <Button type="button" size="sm" className="min-h-10 w-full" disabled={!proposal || assigned <= 0} onClick={() => { if (proposal) onApply(proposal); }}>Use this split</Button>
    <p className="text-xs text-muted-foreground">Adds to your budget draft. Tap Save to keep it.</p>
  </div>;
}
