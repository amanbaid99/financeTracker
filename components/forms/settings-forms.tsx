"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  savingsMinPct: number;
  taxReservePct: number;
  healthCoverMetro: number;
  healthCoverOther: number;
  termIncomeMultiple: number;
  highInterestThresholdPct: number;
  retirementBaselinePct: number;
  retirementAge: number;
}

export function AssumptionSettings({ values, defaults }: { values: OverrideValues; defaults: OverrideValues }) {
  const [v, setV] = useState<Record<keyof OverrideValues, string>>(
    Object.fromEntries(Object.entries(values).map(([k, x]) => [k, String(x)])) as Record<keyof OverrideValues, string>,
  );
  const { pending, run, status } = useAction();
  const num = (k: keyof OverrideValues) => Number(v[k]);
  const field = (k: keyof OverrideValues, label: string, suffix: string, hint: string) => (
    <Field label={label} htmlFor={`ov-${k}`} hint={`${hint} Default ${defaults[k]}${suffix}.`}>
      <Input
        id={`ov-${k}`}
        inputMode="decimal"
        value={v[k]}
        onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value.replace(/[^\d.]/g, "") }))}
      />
    </Field>
  );
  function save() {
    // Only store values that differ from defaults.
    const diff = <K extends keyof OverrideValues>(k: K, scale = 1) =>
      num(k) !== defaults[k] ? num(k) / scale : undefined;
    run(() =>
      saveOverrides({
        budget: {
          savingsMinPct: diff("savingsMinPct", 100),
          freelance: { taxReservePct: diff("taxReservePct", 100) },
        },
        ladder: {
          healthCoverMetro: diff("healthCoverMetro"),
          healthCoverOther: diff("healthCoverOther"),
          termIncomeMultiple: diff("termIncomeMultiple"),
          highInterestThresholdPct: diff("highInterestThresholdPct"),
          retirementBaselinePct: diff("retirementBaselinePct", 100),
        },
        goals: { retirementAge: diff("retirementAge") },
      }),
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field("savingsMinPct", "Minimum savings (% of base)", "%", "")}
        {field("taxReservePct", "Freelance tax reserve (%)", "%", "")}
        {field("healthCoverMetro", "Health cover target, metro (₹)", "", "")}
        {field("healthCoverOther", "Health cover target, elsewhere (₹)", "", "")}
        {field("termIncomeMultiple", "Term cover (x yearly income)", "x", "")}
        {field("highInterestThresholdPct", "High-interest debt above (%)", "%", "")}
        {field("retirementBaselinePct", "Retirement baseline (% of base)", "%", "")}
        {field("retirementAge", "Retirement age", "", "")}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          Save assumptions
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
