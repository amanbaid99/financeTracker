"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { deleteAccount, saveOverrides, saveTheme, setAiEnabled, signOut } from "@/lib/actions";
import type { Accent, Theme } from "@/lib/theme";
import { applyTheme, ThemePicker } from "./basics-form";
import { Field } from "./field";

function useAction() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = "Saved") =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
    });
  const status = msg && (
    <span role="status" className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>
      {msg.text}
    </span>
  );
  return { pending, run, status };
}

export function ThemeSettings({ theme: t0, accent: a0 }: { theme: Theme; accent: Accent }) {
  const [theme, setTheme] = useState(t0);
  const [accent, setAccent] = useState(a0);
  const { pending, run, status } = useAction();
  return (
    <div className="space-y-4">
      <ThemePicker
        theme={theme}
        accent={accent}
        onChange={(t, a) => {
          setTheme(t);
          setAccent(a);
          applyTheme(t, a);
        }}
      />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => run(() => saveTheme({ theme, accent }))} disabled={pending}>
          Save look
        </Button>
        {status}
      </div>
    </div>
  );
}

export function AiSettings({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const { pending, run, status } = useAction();
  if (!configured) {
    return <p className="text-sm text-muted-foreground">AI explanations aren&apos;t set up on this server yet.</p>;
  }
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <Checkbox
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            run(async () => {
              const r = await setAiEnabled(v);
              router.refresh();
              return r;
            }, v ? "AI explanations on" : "AI explanations off");
          }}
        />
        <span>
          <span className="font-medium">AI explanations</span>
          <span className="block text-muted-foreground">
            Sends only rounded numbers the app already calculated. Never your name, email, age, city, or the names
            you gave goals and holdings.
          </span>
        </span>
      </label>
      {status}
    </div>
  );
}

export interface OverrideValues {
  healthCoverMetro: number;
  healthCoverOther: number;
  termIncomeMultiple: number;
  /** 0 = automatic (income multiple). */
  termCoverTarget: number;
  highInterestThresholdPct: number;
  retirementAge: number;
  debtMethod: "snowball" | "avalanche";
  debtAfterGoals: boolean;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function AssumptionSettings({ values, defaults }: { values: OverrideValues; defaults: OverrideValues }) {
  const [v, setV] = useState<Record<keyof OverrideValues, string>>(
    Object.fromEntries(Object.entries(values).map(([k, x]) => [k, String(x)])) as Record<keyof OverrideValues, string>,
  );
  const [termTarget, setTermTarget] = useState<number | null>(values.termCoverTarget || null);
  const [debtMethod, setDebtMethod] = useState(values.debtMethod);
  const [debtAfterGoals, setDebtAfterGoals] = useState(values.debtAfterGoals);
  const { pending, run, status } = useAction();
  type NumKey = Exclude<keyof OverrideValues, "debtMethod" | "debtAfterGoals">;
  const num = (k: NumKey) => Number(v[k]);
  const field = (k: NumKey, label: string, fmt: (n: number) => string) => (
    <Field label={label} htmlFor={`ov-${k}`} hint={`Default ${fmt(defaults[k])}.`}>
      <Input
        id={`ov-${k}`}
        inputMode="decimal"
        value={v[k]}
        onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") }))}
      />
    </Field>
  );
  function save() {
    // Values equal to the default are cleared (null) so future default changes apply.
    const diff = (k: NumKey) => (num(k) !== defaults[k] ? num(k) : null);
    run(() =>
      saveOverrides({
        ladder: {
          healthCoverMetro: diff("healthCoverMetro"),
          healthCoverOther: diff("healthCoverOther"),
          termIncomeMultiple: diff("termIncomeMultiple"),
          termCoverTarget: termTarget && termTarget > 0 ? termTarget : null,
          highInterestThresholdPct: diff("highInterestThresholdPct"),
          debtMethod: debtMethod === defaults.debtMethod ? null : debtMethod,
          debtAfterGoals: debtAfterGoals === defaults.debtAfterGoals ? null : debtAfterGoals,
        },
        goals: { retirementAge: diff("retirementAge") },
      }),
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="My term cover target (₹)"
          htmlFor="ov-termCoverTarget"
          className="sm:col-span-2"
          hint={
            termTarget
              ? `Your plan aims for ${inr.format(termTarget)} of term cover.`
              : `Leave blank to use ${v.termIncomeMultiple || defaults.termIncomeMultiple}x your yearly income plus loans, minus savings.`
          }
        >
          <MoneyInput id="ov-termCoverTarget" placeholder="Automatic" value={termTarget} onChange={setTermTarget} />
        </Field>
        {!termTarget && field("termIncomeMultiple", "Term cover (x yearly income)", (n) => `${n}x`)}
        {field("healthCoverMetro", "Health cover target, metro (₹)", (n) => inr.format(n))}
        {field("healthCoverOther", "Health cover target, elsewhere (₹)", (n) => inr.format(n))}
        {field("highInterestThresholdPct", "High-interest debt above (%)", (n) => `${n}%`)}
        {field("retirementAge", "Retirement age", (n) => String(n))}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Clearing debt</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["snowball", "Snowball", "Smallest balance first. Quick wins keep you going."],
              ["avalanche", "Avalanche", "Highest rate first. Pays the least interest."],
            ] as const
          ).map(([value, label, blurb]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="radio"
                name="debt-method"
                className="mt-0.5 accent-[var(--primary)]"
                checked={debtMethod === value}
                onChange={() => setDebtMethod(value)}
              />
              <span>
                <span className="font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--primary)]"
            checked={debtAfterGoals}
            onChange={(e) => setDebtAfterGoals(e.target.checked)}
          />
          <span>
            Fund my goals first
            <span className="block text-xs text-muted-foreground">
              Extra debt payments only use money left after goals. EMIs are always paid.
            </span>
          </span>
        </label>
      </fieldset>
      <p className="text-xs text-muted-foreground">Savings and income-split ratios are on the Budget page.</p>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          Save assumptions
        </Button>
        {status}
      </div>
    </div>
  );
}

/** Budget ratios, edited on the Budget page. Percentages are whole numbers here. */
export interface RatioValues {
  savingsMinPct: number;
  capPct: number;
  variable: [number, number, number];
  bonus: [number, number, number];
  secondary: [number, number];
  retirementBaselinePct: number;
  taxReservePct: number;
}

export function BudgetRatios({ values, defaults }: { values: RatioValues; defaults: RatioValues }) {
  const [r, setR] = useState(values);
  const { pending, run, status } = useAction();
  const pctInput = (id: string, label: string, value: number, onChange: (n: number) => void) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          className="pr-7"
          value={Number.isFinite(value) ? String(value) : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, "") || 0))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  const splitNote = (xs: number[]) =>
    sum(xs) === 100 ? null : <p className="text-xs text-danger">Adds up to {sum(xs)}%. Make it 100%.</p>;
  const same = (a: number[], b: number[]) => a.every((x, i) => x === b[i]);
  const valid =
    sum(r.variable) === 100 && sum(r.bonus) === 100 && sum(r.secondary) === 100 && r.capPct >= r.savingsMinPct;

  function save() {
    const d = defaults;
    const pctOrNull = (x: number, def: number) => (x === def ? null : x / 100);
    const split3 = (x: [number, number, number], def: [number, number, number]) =>
      same(x, def) ? null : { ladder: x[0] / 100, goals: x[1] / 100, wants: x[2] / 100 };
    run(() =>
      saveOverrides({
        budget: {
          savingsMinPct: pctOrNull(r.savingsMinPct, d.savingsMinPct),
          essentialsPlusSavingsCapPct: pctOrNull(r.capPct, d.capPct),
          variableSurplus: split3(r.variable, d.variable),
          bonusSurplus: split3(r.bonus, d.bonus),
          secondarySurplus: same(r.secondary, d.secondary)
            ? null
            : { ladderGoals: r.secondary[0] / 100, wants: r.secondary[1] / 100 },
          freelance: { taxReservePct: pctOrNull(r.taxReservePct, d.taxReservePct) },
        },
        ladder: { retirementBaselinePct: pctOrNull(r.retirementBaselinePct, d.retirementBaselinePct) },
      }),
    );
  }

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Base income</legend>
        <div className="grid grid-cols-2 items-end gap-3">
          {pctInput("r-save", "Save at least", r.savingsMinPct, (n) => setR({ ...r, savingsMinPct: n }))}
          {pctInput("r-cap", "Essentials + savings at most", r.capPct, (n) => setR({ ...r, capPct: n }))}
        </div>
        <p className="text-xs text-muted-foreground">
          Whatever is left after essentials and savings is for wants. With these settings, at least {100 - r.capPct}%
          of base income stays yours to spend.
        </p>
        {r.capPct < r.savingsMinPct && (
          <p className="text-xs text-danger">The cap must be at least the savings minimum.</p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Variable pay and freelance surplus</legend>
        <div className="grid grid-cols-3 items-end gap-3">
          {pctInput("r-v1", "Next step", r.variable[0], (n) => setR({ ...r, variable: [n, r.variable[1], r.variable[2]] }))}
          {pctInput("r-v2", "Goals", r.variable[1], (n) => setR({ ...r, variable: [r.variable[0], n, r.variable[2]] }))}
          {pctInput("r-v3", "Wants", r.variable[2], (n) => setR({ ...r, variable: [r.variable[0], r.variable[1], n] }))}
        </div>
        {splitNote(r.variable)}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Bonuses and one-offs</legend>
        <div className="grid grid-cols-3 items-end gap-3">
          {pctInput("r-b1", "Next step", r.bonus[0], (n) => setR({ ...r, bonus: [n, r.bonus[1], r.bonus[2]] }))}
          {pctInput("r-b2", "Goals", r.bonus[1], (n) => setR({ ...r, bonus: [r.bonus[0], n, r.bonus[2]] }))}
          {pctInput("r-b3", "Wants", r.bonus[2], (n) => setR({ ...r, bonus: [r.bonus[0], r.bonus[1], n] }))}
        </div>
        {splitNote(r.bonus)}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Second job income</legend>
        <div className="grid grid-cols-2 items-end gap-3">
          {pctInput("r-s1", "Next step and goals", r.secondary[0], (n) => setR({ ...r, secondary: [n, r.secondary[1]] }))}
          {pctInput("r-s2", "Wants", r.secondary[1], (n) => setR({ ...r, secondary: [r.secondary[0], n] }))}
        </div>
        {splitNote(r.secondary)}
      </fieldset>

      <div className="grid grid-cols-2 items-end gap-3">
        {pctInput("r-ret", "Retirement baseline (of base)", r.retirementBaselinePct, (n) =>
          setR({ ...r, retirementBaselinePct: n }),
        )}
        {pctInput("r-tax", "Freelance tax reserve", r.taxReservePct, (n) => setR({ ...r, taxReservePct: n }))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending || !valid}>
          Save ratios
        </Button>
        <Button type="button" variant="ghost" onClick={() => setR(defaults)} disabled={pending}>
          Reset to defaults
        </Button>
        {status}
      </div>
    </div>
  );
}

export function AccountSettings() {
  const [confirm, setConfirm] = useState("");
  const { pending, run, status } = useAction();
  return (
    <div className="space-y-5">
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
      <div className="space-y-2 rounded-lg border border-danger/40 p-3">
        <p className="text-sm font-medium text-danger">Delete account</p>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your profile, income, expenses, insurance, loans, holdings, goals and consent records.
          This can&apos;t be undone.
        </p>
        <Field label="Type DELETE to confirm" htmlFor="del">
          <Input id="del" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || confirm !== "DELETE"}
            onClick={() => run(() => deleteAccount(confirm))}
          >
            Delete everything
          </Button>
          {status}
        </div>
      </div>
    </div>
  );
}
