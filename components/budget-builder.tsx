"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveBudgetAnswers } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { MUST_PAY } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SAVE_CHOICES = [
  { pct: 20, title: "Steady", blurb: "A comfortable start" },
  { pct: 30, title: "Focused", blurb: "Goals arrive sooner" },
  { pct: 40, title: "Ambitious", blurb: "Big goals, less spending" },
];

export interface BuilderInitial {
  income: number | null;
  /** Set when there's exactly one regular income to update. */
  incomeStreamId: string | null;
  /** True when income comes from several sources (edited elsewhere). */
  multipleIncomes: boolean;
  costs: Record<string, number | null>;
  /** EMIs, premiums and planned set-asides already counted, per month. */
  alreadyCounted: number;
  savingsPct: number;
}

export function BudgetBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState<number | null>(initial.income);
  const [costs, setCosts] = useState(initial.costs);
  const [savePct, setSavePct] = useState(initial.savingsPct);
  const [custom, setCustom] = useState(!SAVE_CHOICES.some((c) => c.pct === initial.savingsPct));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const pay = income ?? 0;
  const mustPay = Object.values(costs).reduce<number>((s, v) => s + (v ?? 0), 0) + initial.alreadyCounted;
  // Same rule as the plan: savings never push essentials + savings past 90%.
  const save = Math.max(0, Math.min(Math.round((pay * savePct) / 100), Math.round(pay * 0.9) - mustPay));
  const spend = Math.max(0, pay - mustPay - save);
  const short = mustPay > pay;

  const steps = ["Your pay", "Must-pay costs", "Saving", "Your budget"];

  function finish() {
    setError("");
    start(async () => {
      const res = await saveBudgetAnswers({
        income: initial.multipleIncomes ? null : income,
        incomeStreamId: initial.incomeStreamId,
        expenses: MUST_PAY.map((category) => ({ category, amount: costs[category] ?? 0 })),
        savingsPct: savePct,
      });
      if (!res.ok) return setError(res.error);
      router.push("/budget");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Question {step + 1} of {steps.length} · {steps[step]}
        </p>
        <Progress value={((step + 1) / steps.length) * 100} label="Budget builder progress" />
      </div>

      {step === 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How much reaches your bank each month?</h2>
          <p className="text-sm text-muted-foreground">Your take-home pay after tax and deductions.</p>
          {initial.multipleIncomes ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              You have several incomes. Together you can count on about {formatINR(pay)} a month. Change them under
              My details, Income.
            </p>
          ) : (
            <MoneyInput aria-label="Monthly take-home pay" value={income} onChange={setIncome} placeholder="e.g. 80,000" />
          )}
          {pay === 0 && (
            <p className="text-xs text-muted-foreground">
              No income right now? Leave it at 0 and your budget shows how long your savings last instead.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What do you have to pay every month?</h2>
          <p className="text-sm text-muted-foreground">Rough numbers are fine. Leave blank what doesn&apos;t apply.</p>
          <div className="space-y-2">
            {MUST_PAY.map((c) => (
              <div key={c} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm">{c}</span>
                <MoneyInput
                  className="w-40 shrink-0"
                  aria-label={`${c} per month`}
                  value={costs[c] ?? null}
                  onChange={(v) => setCosts((s) => ({ ...s, [c]: v }))}
                />
              </div>
            ))}
          </div>
          {initial.alreadyCounted > 0 && (
            <p className="text-xs text-muted-foreground">
              Plus {formatINR(initial.alreadyCounted)} a month already counted from your loans, insurance and planned
              expenses.
            </p>
          )}
          <p className="text-sm">
            Must-pay total <span className="tabular font-semibold">{formatINR(mustPay)}</span> a month
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How much would you like to save?</h2>
          <p className="text-sm text-muted-foreground">
            A share of your pay that goes to your safety net and goals before you spend.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {SAVE_CHOICES.map((c) => (
              <button
                key={c.pct}
                type="button"
                aria-pressed={!custom && savePct === c.pct}
                onClick={() => {
                  setCustom(false);
                  setSavePct(c.pct);
                }}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  !custom && savePct === c.pct ? "border-primary bg-primary-soft" : "hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">
                  {c.title} · {c.pct}%
                </span>
                <span className="block text-xs text-muted-foreground">{c.blurb}</span>
                <span className="tabular mt-1 block text-sm">{formatINR(Math.round((pay * c.pct) / 100))}/month</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={custom}
              onChange={(e) => setCustom(e.target.checked)}
            />
            My own percentage
          </label>
          {custom && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={70}
                step={5}
                value={savePct}
                onChange={(e) => setSavePct(Number(e.target.value))}
                className="flex-1 accent-[var(--primary)]"
                aria-label="Savings percentage"
              />
              <span className="tabular w-12 text-right text-sm font-semibold">{savePct}%</span>
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Here&apos;s your budget</h2>
          {short ? (
            <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
              Your must-pay costs ({formatINR(mustPay)}) are more than your pay ({formatINR(pay)}). Your plan will
              focus on fixing that first.
            </p>
          ) : (
            <>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                <div className="rounded-l-full bg-series-1" style={{ width: `${(mustPay / Math.max(1, pay)) * 100}%` }} />
                <div className="bg-series-2" style={{ width: `${(save / Math.max(1, pay)) * 100}%` }} />
                <div className="rounded-r-full bg-series-3" style={{ width: `${(spend / Math.max(1, pay)) * 100}%` }} />
              </div>
              <dl className="divide-y rounded-lg border text-sm">
                {[
                  ["Must-pay costs", mustPay, "bg-series-1"],
                  ["Save and invest", save, "bg-series-2"],
                  ["Spending money", spend, "bg-series-3"],
                ].map(([label, amount, dot]) => (
                  <div key={label as string} className="flex items-center justify-between p-3">
                    <dt className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", dot as string)} aria-hidden />
                      {label as string}
                    </dt>
                    <dd className="tabular font-semibold">{formatINR(amount as number)}</dd>
                  </div>
                ))}
              </dl>
              {save < Math.round((pay * savePct) / 100) && (
                <p className="text-xs text-muted-foreground">
                  Savings are trimmed so at least 10% of your pay stays yours to spend.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Next, your money plan shows exactly where the savings go: your safety net first, then your goals, with
                the kind of account or fund to keep each in.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
              {error}
            </p>
          )}
        </section>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (step === 0 ? router.push("/budget") : setStep(step - 1))}
          disabled={pending}
        >
          <ChevronLeft /> {step === 0 ? "Cancel" : "Back"}
        </Button>
        {step < steps.length - 1 ? (
          <Button type="button" onClick={() => setStep(step + 1)}>
            Next <ChevronRight />
          </Button>
        ) : (
          <Button type="button" onClick={finish} disabled={pending}>
            {pending ? "Saving…" : "Use this budget"}
          </Button>
        )}
      </div>
    </div>
  );
}
