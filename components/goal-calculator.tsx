"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  costNumber,
  emergencyNumber,
  fmt,
  houseNumber,
  retirementNumber,
  suggestedMonths,
  type CalcResult,
  type CostEstimate,
} from "@/lib/goal-calc";
import {
  calcContext,
  estimateCost,
  type CalcContext,
} from "@/lib/goal-calc-actions";
import { cn } from "@/lib/utils";

const num = (s: string, fallback: number) => {
  const n = Number(s);
  return Number.isFinite(n) && s.trim() !== "" ? n : fallback;
};

/** What a goal of this type would cost, with an example to guide the description. */
const EXAMPLES: Record<string, string> = {
  education: "2-year MBA at a good private college in India, with hostel",
  wedding: "Wedding for about 300 guests in Pune, 2 days",
  vehicle: "Mid-size SUV, on-road price",
  travel: "10 days in Japan for 2 people, mid-range hotels",
  house_down_payment: "2BHK apartment in a good part of Bengaluru",
  custom: "Describe what you're saving for",
};

function Result({ r, onUse }: { r: CalcResult; onUse: () => void }) {
  return (
    <div className="space-y-3 rounded-xl bg-primary-soft p-4" role="status">
      <p>
        <span className="tabular text-2xl font-semibold tracking-tight">
          {fmt(r.headline.amount)}
        </span>{" "}
        <span className="text-sm text-muted-foreground">{r.headline.when}</span>
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {r.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <Button type="button" className="w-full" onClick={onUse}>
        Use {fmt(r.target)}
        {r.targetDate ? ` by ${r.targetDate.slice(0, 4)}` : ""}
      </Button>
      <p className="text-xs text-muted-foreground">
        Fills in the goal for you to check. Nothing is saved until you save the
        goal.
      </p>
    </div>
  );
}

/** AI's range for a cost, for when you have no idea where to start. */
function AiEstimate({
  goalType,
  aiOn,
  onPick,
}: {
  goalType: string;
  aiOn: boolean;
  onPick: (cost: number, what: string) => void;
}) {
  const [text, setText] = useState("");
  const [est, setEst] = useState<CostEstimate | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!aiOn)
    return (
      <p className="text-xs text-muted-foreground">
        Not sure of the cost? Turn on Ask in Settings and AI can suggest a
        range.
      </p>
    );
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="size-4 text-primary" aria-hidden /> Not sure what
        it costs?
      </p>
      <Input
        aria-label="What it's for"
        value={text}
        maxLength={300}
        placeholder={EXAMPLES[goalType] ?? EXAMPLES.custom}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || text.trim().length < 3}
        onClick={() =>
          start(async () => {
            setError("");
            const res = await estimateCost({ goalType, description: text });
            if (!res.ok) return setError(res.error);
            setEst(res.estimate);
          })
        }
      >
        {pending ? "Estimating…" : "Estimate with AI"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {est && (
        <div className="space-y-2">
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Pick an estimate"
          >
            {(["low", "typical", "high"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={false}
                onClick={() => onPick(est[k], text.trim())}
                className="press rounded-lg border bg-card p-2 text-center hover:border-primary"
              >
                <span className="block text-xs capitalize text-muted-foreground">
                  {k}
                </span>
                <span className="tabular block text-sm font-semibold">
                  {fmt(est[k])}
                </span>
              </button>
            ))}
          </div>
          {est.assumptions.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {est.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            An AI estimate in today&apos;s prices. Pick one, then adjust if you
            know better. Only your description is sent, with personal details
            hidden.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * "Help me work it out": a calculator for the goal's amount, by goal type.
 * The maths is the app's own; AI only suggests a starting cost.
 */
export function GoalCalculator({
  goalType,
  today,
  onUse,
  onClose,
}: {
  goalType: string;
  today: string;
  onUse: (r: CalcResult) => void;
  onClose: () => void;
}) {
  const [ctx, setCtx] = useState<CalcContext | null>(null);
  useEffect(() => {
    calcContext()
      .then(setCtx)
      .catch(() => setCtx(null));
  }, []);

  // Retirement
  const [age, setAge] = useState<string | null>(null);
  const [retireAge, setRetireAge] = useState("60");
  const [lifeTo, setLifeTo] = useState("85");
  const [spend, setSpend] = useState<number | null>(null);
  const [infl, setInfl] = useState("6");
  const [ret, setRet] = useState("7");
  // Emergency
  const [months, setMonths] = useState<string | null>(null);
  const [essentials, setEssentials] = useState<number | null>(null);
  // House / anything else
  const [price, setPrice] = useState<number | null>(null);
  const [downPct, setDownPct] = useState("20");
  const [extrasPct, setExtrasPct] = useState("7");
  const [years, setYears] = useState("3");
  const [what, setWhat] = useState("");

  // What the app already knows fills in until you type something else.
  const ageNow = age ?? (ctx?.age ? String(ctx.age) : "");
  const spendNow = spend ?? (ctx?.costs || null);
  const essentialsNow =
    essentials ??
    (ctx && (ctx.costs || ctx.emis) ? ctx.costs + ctx.emis : null);

  const suggest = ctx
    ? suggestedMonths({
        dependents: ctx.dependents,
        soleEarner: ctx.soleEarner,
      })
    : null;
  const monthsNow = months ?? String(suggest?.months ?? 6);

  let result: CalcResult | null = null;
  if (goalType === "retirement" && spendNow && num(ageNow, 0) > 0)
    result = retirementNumber({
      age: num(ageNow, 30),
      retireAge: num(retireAge, 60),
      lifeTo: num(lifeTo, 85),
      monthlyExpenses: spendNow,
      inflationPct: num(infl, 6),
      returnAfterPct: num(ret, 7),
      todayISO: today,
    });
  else if (goalType === "emergency_fund" && essentialsNow)
    result = emergencyNumber({
      monthly: essentialsNow,
      months: num(monthsNow, 6),
    });
  else if (goalType === "house_down_payment" && price)
    result = houseNumber({
      price,
      downPct: num(downPct, 20),
      extrasPct: num(extrasPct, 7),
      years: num(years, 3),
      inflationPct: num(infl, 6),
      todayISO: today,
    });
  else if (price)
    result = costNumber({
      cost: price,
      years: num(years, 3),
      inflationPct: num(infl, 6),
      todayISO: today,
      what: what ? what.charAt(0).toUpperCase() + what.slice(1) : "It",
    });

  const small = (
    label: string,
    id: string,
    value: string,
    set: (v: string) => void,
    hint?: string,
  ) => (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </Field>
  );

  return (
    <Sheet title="Work out how much" onClose={onClose}>
      <div className="space-y-4">
        {goalType === "retirement" ? (
          <>
            <p className="text-sm text-muted-foreground">
              How much you&apos;d need to keep living as you do today, from when
              you stop working.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {small("Your age", "c-age", ageNow, setAge)}
              {small("Retire at", "c-retire", retireAge, setRetireAge)}
              {small("Plan until", "c-life", lifeTo, setLifeTo)}
            </div>
            <Field
              label="Monthly spending today"
              htmlFor="c-spend"
              hint={
                ctx?.costs
                  ? "From your budget's monthly costs. Leave out rent if you'll own a home by then."
                  : "What you spend a month now, without EMIs that end before you retire."
              }
            >
              <MoneyInput id="c-spend" value={spendNow} onChange={setSpend} />
            </Field>
            <details className="text-sm">
              <summary className="cursor-pointer text-primary">
                Assumptions
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {small("Prices rise, % a year", "c-infl", infl, setInfl)}
                {small(
                  "Return after retiring, %",
                  "c-ret",
                  ret,
                  setRet,
                  "Safer mix, so lower",
                )}
              </div>
            </details>
          </>
        ) : goalType === "emergency_fund" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Enough to cover essentials and EMIs if your income stopped for a
              while.
            </p>
            <Field
              label="Essentials and EMIs a month"
              htmlFor="c-ess"
              hint={
                ctx && (ctx.costs || ctx.emis)
                  ? "From your budget's costs and your loan EMIs."
                  : undefined
              }
            >
              <MoneyInput
                id="c-ess"
                value={essentialsNow}
                onChange={setEssentials}
              />
            </Field>
            <Field
              label="Months of cover"
              htmlFor="c-months"
              hint={
                suggest
                  ? `${suggest.months} suggested: ${suggest.why}.`
                  : undefined
              }
            >
              <Select
                id="c-months"
                value={monthsNow}
                onChange={(e) => setMonths(e.target.value)}
              >
                {[3, 6, 9, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} months
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field
              label={
                goalType === "house_down_payment"
                  ? "Home price today"
                  : "What it costs today"
              }
              htmlFor="c-price"
            >
              <MoneyInput id="c-price" value={price} onChange={setPrice} />
            </Field>
            <AiEstimate
              goalType={goalType}
              aiOn={!!ctx?.aiOn}
              onPick={(cost, desc) => {
                setPrice(cost);
                setWhat(desc);
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              {small("Needed in, years", "c-years", years, setYears)}
              {small(
                "Prices rise, % a year",
                "c-infl2",
                infl,
                setInfl,
                goalType === "education"
                  ? "Education often rises ~10%"
                  : undefined,
              )}
            </div>
            {goalType === "house_down_payment" && (
              <div className="grid grid-cols-2 gap-3">
                {small(
                  "Down payment, %",
                  "c-down",
                  downPct,
                  setDownPct,
                  "Banks lend the rest",
                )}
                {small("Stamp duty etc, %", "c-extra", extrasPct, setExtrasPct)}
              </div>
            )}
          </>
        )}
        {result ? (
          <Result r={result} onUse={() => onUse(result!)} />
        ) : (
          <p
            className={cn(
              "rounded-lg bg-muted p-3 text-sm text-muted-foreground",
            )}
          >
            Fill in the boxes above to see the number.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          A planning estimate, not investment advice.
        </p>
      </div>
    </Sheet>
  );
}
