"use client";

import { ChevronLeft } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import {
  BillsEditor,
  newBillKey,
  type BillRow,
} from "@/components/bills-editor";
import { GoalIcon } from "@/components/goal-icon";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { saveGoal } from "@/lib/actions";
import { formatDate, formatINR } from "@/lib/format";
import { addMonths, lastEmiOnOrBefore } from "@/lib/dates";
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

const ordinal = (d: number) =>
  d % 10 === 1 && d !== 11
    ? "st"
    : d % 10 === 2 && d !== 12
      ? "nd"
      : d % 10 === 3 && d !== 13
        ? "rd"
        : "th";

/** Interest rate with up to two decimals, e.g. 8.65. */
function RateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      id="g-rate"
      type="number"
      inputMode="decimal"
      min={0}
      max={60}
      step={0.01}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. 8.65"
      required
    />
  );
}

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
  const isBills = type === "bills_fund";
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
  const fromStart = !!goal?.loan?.firstEmi;
  // "now": what's owed after the latest EMI. "start": worked out from the original loan.
  const [loanMode, setLoanMode] = useState<"now" | "start">(
    fromStart ? "start" : "now",
  );
  const [outstanding, setOutstanding] = useState<number | null>(
    ls?.balance ?? null,
  );
  const [original, setOriginal] = useState<number | null>(
    fromStart ? goal!.loan!.outstanding : null,
  );
  const [emiDay, setEmiDay] = useState(String(ls?.emiDay ?? ""));
  const [firstEmi, setFirstEmi] = useState(goal?.loan?.firstEmi ?? "");
  const [tenure, setTenure] = useState(
    fromStart ? String(goal!.loan!.monthsLeft ?? "") : "",
  );
  const [emi, setEmi] = useState<number | null>(goal?.loan?.emi ?? null);
  const [rate, setRate] = useState(goal?.loan ? String(goal.loan.ratePct) : "");
  const [monthsLeft, setMonthsLeft] = useState(
    goal?.loan?.emi || fromStart ? "" : String(ls?.monthsLeft ?? ""),
  );
  const [feePct, setFeePct] = useState(
    goal?.loan?.foreclosurePct !== null &&
      goal?.loan?.foreclosurePct !== undefined
      ? String(goal.loan.foreclosurePct)
      : "",
  );
  const [feeGst, setFeeGst] = useState(goal?.loan?.foreclosureGst ?? true);
  const [bills, setBills] = useState<BillRow[]>(
    () =>
      goal?.bills?.map((b) => ({
        key: newBillKey(),
        name: b.name,
        amount: b.amount,
        everyMonths: b.everyMonths,
        // Show the rolled-forward date, not one that has already passed.
        nextDue:
          goal.billsFund?.bills.find((x) => x.id === b.id)?.due ?? b.nextDue,
      })) ?? [],
  );
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
                        : t.value === "bills_fund"
                          ? "Bills fund"
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

  // The loan as the server will store it, from either way of entering it.
  const fromStartMode = loanMode === "start";
  const day = fromStartMode
    ? firstEmi
      ? Number(firstEmi.slice(8, 10))
      : null
    : num(emiDay);
  const loanInput =
    isLoan && day
      ? {
          outstanding: (fromStartMode ? original : outstanding) ?? 0,
          emi: emi || null,
          ratePct: num(rate) ?? 0,
          monthsLeft: fromStartMode ? num(tenure) : num(monthsLeft),
          emiDay: day,
          firstEmi: fromStartMode ? firstEmi || null : null,
          foreclosurePct: num(feePct),
          foreclosureGst: feeGst,
        }
      : null;
  // Live preview of the loan as details are typed in.
  const preview =
    loanInput &&
    loanInput.outstanding &&
    num(rate) !== null &&
    (loanInput.emi || loanInput.monthsLeft)
      ? loanState(
          {
            ...loanInput,
            asOf: loanInput.firstEmi
              ? addMonths(loanInput.firstEmi, -1)
              : lastEmiOnOrBefore(today, loanInput.emiDay),
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
        target: isLoan ? (loanInput?.outstanding ?? 0) : (target ?? 0),
        targetDate: isBills || noDate ? null : date || null,
        inflationPct:
          !isLoan && !isBills && inflate && !noDate
            ? (num(inflation) ?? 0)
            : null,
        loan: loanInput,
        bills: isBills
          ? bills.map((b) => ({
              name: b.name,
              amount: b.amount ?? 0,
              everyMonths: b.everyMonths,
              nextDue: b.nextDue,
            }))
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
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-label="How to enter the loan"
          >
            {(
              [
                ["now", "I know what I owe now"],
                ["start", "Work it out from my loan"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={loanMode === m}
                onClick={() => setLoanMode(m)}
                className={`rounded-md px-2 py-1.5 text-sm ${loanMode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {loanMode === "now" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Owed after your latest EMI"
                htmlFor="g-out"
                className="col-span-2"
              >
                <MoneyInput
                  id="g-out"
                  value={outstanding}
                  onChange={setOutstanding}
                  placeholder="e.g. 8,00,000"
                  required
                />
              </Field>
              <Field label="EMI date" htmlFor="g-day">
                <Select
                  id="g-day"
                  value={emiDay}
                  onChange={(e) => setEmiDay(e.target.value)}
                  required
                >
                  <option value="">Day of month</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                      {ordinal(d)} of the month
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Interest, % a year" htmlFor="g-rate">
                <RateInput value={rate} onChange={setRate} />
              </Field>
              <Field label="EMI" htmlFor="g-emi">
                <MoneyInput
                  id="g-emi"
                  value={emi}
                  onChange={setEmi}
                  placeholder="e.g. 18,000"
                />
              </Field>
              {!emi && (
                <Field
                  label="EMIs left"
                  htmlFor="g-months"
                  hint="If you don't know the EMI."
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Original loan amount"
                htmlFor="g-orig"
                className="col-span-2"
              >
                <MoneyInput
                  id="g-orig"
                  value={original}
                  onChange={setOriginal}
                  placeholder="e.g. 10,00,000"
                  required
                />
              </Field>
              <Field label="First EMI date" htmlFor="g-first">
                <Input
                  id="g-first"
                  type="date"
                  value={firstEmi}
                  onChange={(e) => setFirstEmi(e.target.value)}
                  required
                />
              </Field>
              <Field label="Interest, % a year" htmlFor="g-rate">
                <RateInput value={rate} onChange={setRate} />
              </Field>
              <Field label="Tenure, months" htmlFor="g-tenure">
                <Input
                  id="g-tenure"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={600}
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  placeholder="e.g. 60"
                />
              </Field>
              <Field label="EMI (optional)" htmlFor="g-emi">
                <MoneyInput
                  id="g-emi"
                  value={emi}
                  onChange={setEmi}
                  placeholder="Worked out"
                />
              </Field>
            </div>
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
                step={0.01}
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
                  {loanMode === "start" && (
                    <p>
                      {preview.emisPaid} EMIs paid so far. Owed today:{" "}
                      <span className="font-medium">
                        {formatINR(preview.balance)}
                      </span>
                      .
                    </p>
                  )}
                  {preview.nextEmi && (
                    <p className="text-muted-foreground">
                      Next EMI on {formatDate(preview.nextEmi)}.
                    </p>
                  )}
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
      ) : isBills ? (
        <BillsEditor rows={bills} onChange={setBills} />
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

      {!isBills && (
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
      )}

      {!isLoan && !isBills && !noDate && (
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
