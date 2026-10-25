"use client";

import { ChevronLeft } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { GoalIcon } from "@/components/goal-icon";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { saveGoal } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import {
  asGoalType,
  GOAL_TYPES,
  goalTypeInfo,
  type GoalType,
} from "@/lib/goal-types";
import { monthYear } from "@/lib/goal-summary";
import { loanState } from "@/lib/loan";
import type { TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function GoalForm({
  goal,
  today,
  onSaved,
}: {
  goal: TrackedGoal | null;
  today: string;
  onSaved: (id: string) => void;
}) {
  const [type, setType] = useState<GoalType | null>(
    goal ? asGoalType(goal.type) : null,
  );
  const info = type ? goalTypeInfo(type) : null;
  const isLoan = type === "loan_payoff";
  const ls = goal?.loanState;

  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState<number | null>(
    goal && !ls ? goal.target : null,
  );
  const [noDate, setNoDate] = useState(goal ? !goal.targetDate : false);
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [inflate, setInflate] = useState(goal ? !!goal.inflationPct : true);
  const [inflation, setInflation] = useState(
    String(
      goal?.inflationPct ??
        (goal ? goalTypeInfo(goal.type).inflation || 6 : ""),
    ),
  );
  const [outstanding, setOutstanding] = useState<number | null>(
    ls?.balance ?? null,
  );
  const [emi, setEmi] = useState<number | null>(goal?.loan?.emi ?? null);
  const [rate, setRate] = useState(goal?.loan ? String(goal.loan.ratePct) : "");
  const [monthsLeft, setMonthsLeft] = useState(
    goal?.loan?.emi ? "" : String(ls?.monthsLeft ?? ""),
  );
  const [feePct, setFeePct] = useState(
    goal?.loan?.foreclosurePct !== null &&
      goal?.loan?.foreclosurePct !== undefined
      ? String(goal.loan.foreclosurePct)
      : "",
  );
  const [feeGst, setFeeGst] = useState(goal?.loan?.foreclosureGst ?? true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!type || !info) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          What are you working toward?
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GOAL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value);
                if (!name)
                  setName(
                    t.value === "custom"
                      ? ""
                      : t.value === "loan_payoff"
                        ? "Close my loan"
                        : t.label,
                  );
                if (!inflation) setInflation(String(t.inflation || 6));
                setInflate(t.inflation > 0);
              }}
              className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left hover:border-primary hover:bg-primary-soft"
            >
              <GoalIcon type={t.value} className="size-9" />
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Live preview of the loan as details are typed in.
  const preview =
    isLoan && outstanding && num(rate) !== null && (emi || num(monthsLeft))
      ? loanState(
          {
            outstanding,
            emi: emi || null,
            ratePct: num(rate) ?? 0,
            monthsLeft: num(monthsLeft),
            asOf: today,
            foreclosurePct: num(feePct),
            foreclosureGst: feeGst,
          },
          today,
        )
      : null;

  function submit() {
    setError("");
    start(async () => {
      const res = await saveGoal({
        id: goal?.id ?? null,
        type: type!,
        name,
        target: isLoan ? (outstanding ?? 0) : (target ?? 0),
        targetDate: noDate ? null : date || null,
        inflationPct:
          !isLoan && inflate && !noDate ? (num(inflation) ?? 0) : null,
        loan: isLoan
          ? {
              outstanding: outstanding ?? 0,
              emi: emi || null,
              ratePct: num(rate) ?? 0,
              monthsLeft: num(monthsLeft),
              foreclosurePct: num(feePct),
              foreclosureGst: feeGst,
            }
          : null,
      });
      if (!res.ok) return setError(res.error);
      onSaved(res.id!);
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-3">
        <GoalIcon type={type} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{info.label}</p>
          <p className="text-xs text-muted-foreground">{info.blurb}</p>
        </div>
        {!goal && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setType(null)}
          >
            <ChevronLeft /> Change
          </Button>
        )}
      </div>

      <Field label="Name" htmlFor="g-name">
        <Input
          id="g-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
        />
      </Field>

      {isLoan ? (
        <>
          <Field label="Still owed today" htmlFor="g-out">
            <MoneyInput
              id="g-out"
              value={outstanding}
              onChange={setOutstanding}
              placeholder="e.g. 8,00,000"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="EMI" htmlFor="g-emi">
              <MoneyInput
                id="g-emi"
                value={emi}
                onChange={setEmi}
                placeholder="e.g. 18,000"
              />
            </Field>
            <Field label="Interest, % a year" htmlFor="g-rate">
              <Input
                id="g-rate"
                type="number"
                inputMode="decimal"
                min={0}
                max={60}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 9.5"
                required
              />
            </Field>
          </div>
          {!emi && (
            <Field
              label="EMIs left"
              htmlFor="g-months"
              hint="Don't know the EMI? Enter how many months are left."
            >
              <Input
                id="g-months"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={monthsLeft}
                onChange={(e) => setMonthsLeft(e.target.value)}
              />
            </Field>
          )}
          <div className="space-y-2">
            <Field
              label="Foreclosure charge, % of amount owed"
              htmlFor="g-fee"
              hint="What your lender charges to close early. Floating-rate home loans usually have none."
            >
              <Input
                id="g-fee"
                type="number"
                inputMode="decimal"
                min={0}
                max={20}
                step={0.25}
                value={feePct}
                onChange={(e) => setFeePct(e.target.value)}
                placeholder="e.g. 4"
              />
            </Field>
            {num(feePct) ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={feeGst}
                  onChange={(e) => setFeeGst(e.target.checked)}
                />
                Plus 18% GST on the charge
              </label>
            ) : null}
          </div>
          {preview && (
            <div
              className="space-y-1 rounded-lg bg-muted p-3 text-sm"
              role="status"
            >
              {preview.monthsLeft === null ? (
                <p className="text-danger">
                  This EMI doesn&apos;t cover the interest, so the loan never
                  closes.
                </p>
              ) : (
                <>
                  <p>
                    This month&apos;s EMI of {formatINR(preview.emi)}:{" "}
                    <span className="font-medium">
                      {formatINR(preview.interestThisMonth)} interest
                    </span>
                    ,{" "}
                    <span className="font-medium">
                      {formatINR(preview.principalThisMonth)} principal
                    </span>
                    .
                  </p>
                  <p className="text-muted-foreground">
                    Closes on its own in {monthYear(preview.endDate)} (
                    {preview.monthsLeft} EMIs), with{" "}
                    {formatINR(preview.interestLeft)} interest still to pay.
                  </p>
                  {preview.feeToday > 0 && (
                    <p className="text-muted-foreground">
                      Closing today would cost{" "}
                      {formatINR(preview.balance + preview.feeToday)}, including{" "}
                      {formatINR(preview.feeToday)} in foreclosure charges.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <Field
          label="How much do you need?"
          htmlFor="g-target"
          hint={
            type === "emergency_fund"
              ? "Usually 6 months of your expenses."
              : undefined
          }
        >
          <MoneyInput
            id="g-target"
            value={target}
            onChange={setTarget}
            placeholder="e.g. 20,00,000"
            required
          />
        </Field>
      )}

      <div className="space-y-2">
        <Field label={isLoan ? "Close it by" : "By when?"} htmlFor="g-date">
          <Input
            id="g-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            disabled={noDate}
            required={!noDate}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={noDate}
            onChange={(e) => setNoDate(e.target.checked)}
          />
          {isLoan
            ? "No date: tell me when I can close it"
            : "No fixed date: tell me when I'll get there"}
        </label>
      </div>

      {!isLoan && !noDate && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={inflate}
              onChange={(e) => setInflate(e.target.checked)}
            />
            Prices will rise: grow the target with inflation
          </label>
          {inflate && (
            <div className="flex items-center gap-2 pl-6 text-sm">
              <Input
                aria-label="Inflation, % a year"
                type="number"
                inputMode="decimal"
                min={0}
                max={20}
                step={0.5}
                value={inflation}
                onChange={(e) => setInflation(e.target.value)}
                className="w-20"
              />
              % a year
            </div>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className={cn("w-full")}>
        {pending ? "Saving…" : goal ? "Save goal" : "Create goal"}
      </Button>
    </form>
  );
}
