"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  deleteInvestment,
  removeFromGoal,
  saveInvestment,
} from "@/lib/actions";
import { categoryLabel } from "@/lib/categories";
import { formatINR } from "@/lib/format";
import {
  asKind,
  defaultReturn,
  FUND_CATEGORIES,
  KIND_LABELS,
  KINDS,
  type Kind,
} from "@/lib/instruments";
import { freePercent, type Investment, type Link } from "@/lib/tracker";

export function investmentTitle(i: Investment): string {
  return (
    i.name?.trim() ||
    (i.kind === "mutual_fund"
      ? categoryLabel(i.category)
      : KIND_LABELS[asKind(i.kind)])
  );
}

export function investmentSub(i: Investment): string {
  const kind = asKind(i.kind);
  return kind === "mutual_fund" && i.name?.trim()
    ? categoryLabel(i.category)
    : KIND_LABELS[kind];
}

/** Add an investment to a goal, or edit one. With no goal, edits an unlinked investment. */
export function InvestmentSheet({
  goalId,
  goalName,
  linkedIds,
  investment,
  percent: initialPercent,
  investments,
  links,
  onClose,
  prefill,
  fromPlan = !!prefill,
  pickExisting,
}: {
  /** Pre-filled values for a new investment. */
  prefill?: { fundCategory: string; value: number; monthlySip: number };
  /** The prefill came from the money plan; saving takes it out of the plan's savings. */
  fromPlan?: boolean;
  /** Open on "One I already have" with this investment picked. */
  pickExisting?: string;
  goalId: string | null;
  goalName?: string;
  /** Investments already on this goal. */
  linkedIds: string[];
  investment: Investment | null;
  percent: number | null;
  investments: Investment[];
  links: Link[];
  onClose: () => void;
}) {
  const router = useRouter();
  const free = (id: string) => (goalId ? freePercent(id, links, goalId) : 100);
  const available = goalId
    ? investments.filter((i) => !linkedIds.includes(i.id) && free(i.id) > 0)
    : [];
  const startOnExisting =
    !!pickExisting && available.some((i) => i.id === pickExisting);
  const [mode, setMode] = useState<"new" | "existing">(
    startOnExisting ? "existing" : "new",
  );
  const [pickId, setPickId] = useState(
    startOnExisting ? pickExisting! : (available[0]?.id ?? ""),
  );
  const picked =
    mode === "existing"
      ? (available.find((i) => i.id === pickId) ?? null)
      : null;

  const [kind, setKind] = useState<Kind>(
    investment ? asKind(investment.kind) : "mutual_fund",
  );
  const [fundCategory, setFundCategory] = useState(
    prefill?.fundCategory ??
      (investment?.kind === "mutual_fund"
        ? (investment.category ?? "other")
        : "equity_index"),
  );
  const [name, setName] = useState(investment?.name ?? "");
  const [value, setValue] = useState<number | null>(
    investment?.value ?? (prefill?.value || null),
  );
  const [sip, setSip] = useState<number | null>(
    investment?.monthlySip || prefill?.monthlySip || null,
  );
  const [ret, setRet] = useState(investment?.returnPct?.toString() ?? "");
  const [invested, setInvested] = useState<number | null>(
    investment?.invested ?? null,
  );
  const [percent, setPercent] = useState(
    String(
      initialPercent ??
        (investment
          ? free(investment.id)
          : startOnExisting
            ? free(pickExisting!)
            : 100),
    ),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const category = kind === "mutual_fund" ? fundCategory : null;
  const dflt = defaultReturn(kind, category);
  const sharedElsewhere = investment
    ? links.some((l) => l.investmentId === investment.id && l.goalId !== goalId)
    : false;
  const existing = mode === "existing" && !investment;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      onClose();
    });

  function save() {
    const pct = goalId ? Number(percent) : 100;
    if (existing) {
      if (!picked) return;
      run(() =>
        saveInvestment({
          goalId,
          investmentId: picked.id,
          kind: asKind(picked.kind),
          fundCategory:
            picked.kind === "mutual_fund" ? (picked.category ?? "other") : null,
          name: picked.name,
          value: picked.value,
          monthlySip: picked.monthlySip,
          returnPct: picked.returnPct,
          percent: pct,
        }),
      );
      return;
    }
    run(() =>
      saveInvestment({
        goalId,
        investmentId: investment?.id ?? null,
        kind,
        fundCategory: category,
        name: name.trim() || null,
        value: value ?? 0,
        monthlySip: sip ?? 0,
        returnPct: ret.trim() === "" ? null : Number(ret),
        invested,
        percent: pct,
        fromPlan,
      }),
    );
  }

  const shareField = goalId && (
    <Field
      label="Share for this goal, %"
      htmlFor="i-pct"
      hint="Use less than 100 if part of it is for another goal."
    >
      <Input
        id="i-pct"
        type="number"
        inputMode="decimal"
        min={1}
        max={100}
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        required
      />
    </Field>
  );

  return (
    <Sheet
      title={
        investment
          ? investmentTitle(investment)
          : goalName
            ? `Add to ${goalName}`
            : "Investment"
      }
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {prefill && (
          <p className="rounded-lg bg-primary-soft p-3 text-sm">
            {fromPlan
              ? "Filled in from your plan. Change anything to match what you actually invested."
              : "Filled in from the suggestion. Change anything to match what you actually invested."}
          </p>
        )}
        {!investment && !prefill && available.length > 0 && (
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="radiogroup"
            aria-label="Which investment"
          >
            {(
              [
                ["new", "New"],
                ["existing", "One I already have"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => {
                  setMode(m);
                  setPercent(String(m === "existing" ? free(pickId) : 100));
                }}
                className={`rounded-md px-2 py-1.5 text-sm ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {existing ? (
          <>
            <Field label="Investment" htmlFor="i-pick">
              <Select
                id="i-pick"
                value={pickId}
                onChange={(e) => {
                  setPickId(e.target.value);
                  setPercent(String(free(e.target.value)));
                }}
              >
                {available.map((i) => (
                  <option key={i.id} value={i.id}>
                    {investmentTitle(i)} · {formatINR(i.value)}
                    {free(i.id) < 100 ? ` (${free(i.id)}% free)` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {shareField}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type" htmlFor="i-kind">
                <Select
                  id="i-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind)}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              {kind === "mutual_fund" && (
                <Field label="Fund category" htmlFor="i-cat">
                  <Select
                    id="i-cat"
                    value={fundCategory}
                    onChange={(e) => setFundCategory(e.target.value)}
                  >
                    {FUND_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Nickname (optional)" htmlFor="i-name">
              <Input
                id="i-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "mutual_fund" ? "e.g. My index SIP" : "e.g. Bank FD"
                }
                maxLength={80}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value today" htmlFor="i-value">
                <MoneyInput id="i-value" value={value} onChange={setValue} />
              </Field>
              <Field label="Monthly SIP" htmlFor="i-sip">
                <MoneyInput id="i-sip" value={sip} onChange={setSip} />
              </Field>
            </div>
            {sharedElsewhere && (
              <p className="text-xs text-muted-foreground">
                This also counts toward another goal, so it changes there too.
              </p>
            )}
            <details
              className="group rounded-lg border"
              open={!!initialPercent && initialPercent < 100}
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-sm text-muted-foreground">
                More options · {ret.trim() || dflt}% a year
                {goalId && Number(percent) < 100 ? ` · ${percent}% share` : ""}
              </summary>
              <div className="space-y-4 border-t p-3">
                <Field
                  label="Expected return, % a year"
                  htmlFor="i-ret"
                  hint={`Leave blank to use ${dflt}% for this type.`}
                >
                  <Input
                    id="i-ret"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={30}
                    step={0.5}
                    value={ret}
                    placeholder={String(dflt)}
                    onChange={(e) => setRet(e.target.value)}
                  />
                </Field>
                <Field
                  label="Amount invested (optional)"
                  htmlFor="i-invested"
                  hint="What you've put in so far. Shows how much it has grown."
                >
                  <MoneyInput
                    id="i-invested"
                    value={invested}
                    onChange={setInvested}
                  />
                </Field>
                {shareField}
              </div>
            </details>
          </>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={pending || (existing && !picked)}
        >
          {pending ? "Saving…" : investment ? "Save" : "Add investment"}
        </Button>
        {investment && (
          <div className="flex flex-wrap justify-center gap-2">
            {goalId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    removeFromGoal({ goalId, investmentId: investment.id }),
                  )
                }
              >
                Remove from goal
              </Button>
            )}
            <Button
              type="button"
              variant={confirmDelete ? "destructive" : "ghost"}
              size="sm"
              disabled={pending}
              onClick={() =>
                confirmDelete
                  ? run(() => deleteInvestment(investment.id))
                  : setConfirmDelete(true)
              }
            >
              {confirmDelete ? "Tap again to delete" : "Delete investment"}
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
