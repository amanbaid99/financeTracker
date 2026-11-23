"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { confirmHybridPlan } from "@/lib/hybrid-actions";
import { proposeGoalMapping } from "@/lib/hybrid-mapping";
import { sipSuggestions } from "@/lib/simple-sip";
import type { SipMinimums } from "@/lib/sip-minimums";
import { formatINR } from "@/lib/format";
import type { Investment, Link as GoalLink, TrackedGoal } from "@/lib/tracker";

/**
 * Your monthly SIPs as one list: every holding, with a suggested amount
 * (₹0 where nothing is suggested). Change any amount, then save.
 */
export function SimpleSipPlanner({
  goals,
  investments,
  links: currentLinks,
  today,
  budgetMonthly,
  savedAmounts,
  hasConfirmed,
  revision,
  riskTolerance,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: GoalLink[];
  today: string;
  /** The budget's Save & invest a month, 0 if none. */
  budgetMonthly: number;
  /** Amounts saved last time, per holding (inv:<id>). */
  savedAmounts: SipMinimums;
  hasConfirmed: boolean;
  revision: string;
  riskTolerance?: "conservative" | "moderate" | "aggressive" | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const links = useMemo(
    () =>
      proposeGoalMapping(
        goals,
        investments,
        hasConfirmed ? currentLinks : [],
        today,
        {
          refresh: hasConfirmed,
          riskTolerance,
        },
      ),
    [goals, investments, currentLinks, today, hasConfirmed, riskTolerance],
  );
  const s = useMemo(
    () =>
      sipSuggestions({
        goals,
        investments,
        links,
        today,
        budgetMonthly,
        riskTolerance,
      }),
    [goals, investments, links, today, budgetMonthly, riskTolerance],
  );
  const suggestedFor = (id: string) =>
    s.holdings.find((h) => h.investment.id === id)?.suggested ?? 0;
  const useSaved = Object.values(savedAmounts).some((v) => v > 0);
  const startAmounts = () =>
    Object.fromEntries(
      s.holdings.map((h) => [
        h.investment.id,
        useSaved ? (savedAmounts[`inv:${h.investment.id}`] ?? 0) : h.suggested,
      ]),
    );
  const [amounts, setAmounts] = useState<Record<string, number>>(startAmounts);
  const total = Object.values(amounts).reduce((a, b) => a + b, 0);
  const differsFromSuggested = s.holdings.some(
    (h) => (amounts[h.investment.id] ?? 0) !== h.suggested,
  );

  function save() {
    setError("");
    const minimums = Object.fromEntries(
      Object.entries(amounts)
        .filter(([, v]) => v > 0)
        .map(([id, v]) => [`inv:${id}`, v]),
    );
    start(async () => {
      const res = await confirmHybridPlan({
        calculatedOn: today,
        revision,
        monthly: total,
        lump: 0,
        cashBuffer: 0,
        refreshMapping: hasConfirmed,
        minimums,
        overrides: {},
      });
      if (!res.ok) return setError(res.error);
      router.replace("/goals/plan");
      router.refresh();
    });
  }

  return (
    <section aria-label="Monthly SIPs" className="space-y-4">
      <div className="surface-card space-y-1 rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Total a month</p>
        <p className="tabular text-3xl font-semibold tracking-tight">
          {formatINR(total)}
        </p>
        <p className="text-xs text-muted-foreground">
          Your goals need about {formatINR(s.goalsNeed)} a month
          {budgetMonthly > 0
            ? `. Your budget sets aside ${formatINR(budgetMonthly)}.`
            : "."}
        </p>
        {budgetMonthly > 0 && total > budgetMonthly && (
          <p className="text-xs text-warning">
            {formatINR(total - budgetMonthly)} more than your budget sets aside.
          </p>
        )}
      </div>

      <div className="surface-card rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your holdings</h2>
          {differsFromSuggested && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setAmounts(
                  Object.fromEntries(
                    s.holdings.map((h) => [h.investment.id, h.suggested]),
                  ),
                )
              }
            >
              Use suggestions
            </Button>
          )}
        </div>
        {s.holdings.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No holdings yet. Add your funds and accounts in Net worth.
          </p>
        ) : (
          <ul className="divide-y">
            {s.holdings.map((h) => {
              const id = h.investment.id;
              const suggested = suggestedFor(id);
              return (
                <li key={id} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {h.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {h.kindLabel}
                        {h.investment.monthlySip > 0
                          ? ` · now ${formatINR(h.investment.monthlySip)}/mo`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {suggested > 0
                          ? `Suggested ${formatINR(suggested)}${h.covers.length ? ` for ${h.covers.join(", ")}` : ""}`
                          : "Nothing suggested"}
                      </p>
                    </div>
                    <div className="w-32 shrink-0">
                      <MoneyInput
                        aria-label={`${h.label} a month`}
                        value={amounts[id] ?? 0}
                        onChange={(v) =>
                          setAmounts((a) => ({ ...a, [id]: v ?? 0 }))
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {s.newFunds.length > 0 && (
        <div className="surface-card space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">
            Suggested, but you don&apos;t hold one
          </h2>
          <ul className="divide-y">
            {s.newFunds.map((f) => (
              <li
                key={f.key}
                className="flex items-start justify-between gap-3 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatINR(f.suggested)} a month
                    {f.covers.length ? ` for ${f.covers.join(", ")}` : ""}
                  </span>
                </span>
                <Link
                  href={`/assets?do=add&category=${encodeURIComponent(f.category)}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 text-sm text-primary"
                >
                  <Plus className="size-3.5" aria-hidden /> Add one
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Once you add it, it shows in the list above.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button className="w-full" disabled={pending} onClick={save}>
        {pending ? "Saving…" : "Save this plan"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Saving keeps this plan in the app. No SIP is started or changed with
        your provider.
      </p>
    </section>
  );
}
