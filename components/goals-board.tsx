"use client";

import { ChevronRight, Pencil, Plus, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { deleteGoal, deleteInvestment, removeFromGoal, saveGoal, saveInvestment } from "@/lib/actions";
import { categoryLabel } from "@/lib/categories";
import { formatDate, formatINR, formatINRCompact, formatMonths } from "@/lib/format";
import { asKind, defaultReturn, FUND_CATEGORIES, KIND_LABELS, KINDS, type Kind } from "@/lib/instruments";
import { freePercent, type GoalStatus, type Investment, type Link, type TrackedGoal } from "@/lib/tracker";

const STATUS: Record<GoalStatus, { label: string; variant: "success" | "warning" | "danger" | "muted" | "default" }> = {
  reached: { label: "Reached", variant: "success" },
  on_track: { label: "On track", variant: "success" },
  behind: { label: "Behind", variant: "warning" },
  no_investments: { label: "No investments yet", variant: "muted" },
  overdue: { label: "Date passed", variant: "danger" },
};

const monthYear = (iso: string | null) => formatDate(iso).split(" ").slice(1).join(" ");

function investmentTitle(i: Investment): string {
  return i.name?.trim() || (i.kind === "mutual_fund" ? categoryLabel(i.category) : KIND_LABELS[asKind(i.kind)]);
}

function investmentSub(i: Investment): string {
  const kind = asKind(i.kind);
  return kind === "mutual_fund" && i.name?.trim() ? categoryLabel(i.category) : KIND_LABELS[kind];
}

type SheetState =
  | { type: "goal"; goal: TrackedGoal | null }
  | { type: "investment"; goalId: string | null; investment: Investment | null; percent: number | null };

export function GoalsBoard({
  goals,
  investments,
  links,
}: {
  goals: TrackedGoal[];
  investments: Investment[];
  links: Link[];
}) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const close = useCallback(() => setSheet(null), []);
  const linked = new Set(links.map((l) => l.investmentId));
  const unlinked = investments.filter((i) => !linked.has(i.id));

  const totalNow = goals.reduce((s, g) => s + g.current, 0);
  const totalTarget = goals.reduce((s, g) => s + g.futureTarget, 0);
  const totalSip = goals.reduce((s, g) => s + g.monthlySip, 0);
  const onTrack = goals.filter((g) => g.status === "reached" || g.status === "on_track").length;

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <Button type="button" onClick={() => setSheet({ type: "goal", goal: null })}>
          <Plus /> New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-6 text-center sm:pt-6">
            <Target className="mx-auto size-10 text-primary" aria-hidden />
            <p className="font-semibold">Start with a goal</p>
            <p className="text-sm text-muted-foreground">
              A house, a car, retirement, a trip. Give it a target and a date, then attach the mutual funds, stocks
              or deposits saving for it. We track how close you are.
            </p>
            <Button type="button" onClick={() => setSheet({ type: "goal", goal: null })}>
              <Plus /> Create a goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid grid-cols-3 gap-3 pt-5 sm:pt-5">
            <div>
              <p className="text-xs text-muted-foreground">Saved</p>
              <p className="tabular text-lg font-semibold">{formatINRCompact(totalNow)}</p>
              <p className="tabular text-xs text-muted-foreground">of {formatINRCompact(totalTarget)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">SIPs a month</p>
              <p className="tabular text-lg font-semibold">{formatINRCompact(totalSip)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">On track</p>
              <p className="tabular text-lg font-semibold">
                {onTrack} of {goals.length}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {goals.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          onEdit={() => setSheet({ type: "goal", goal: g })}
          onAdd={() => setSheet({ type: "investment", goalId: g.id, investment: null, percent: null })}
          onOpen={(investment, percent) => setSheet({ type: "investment", goalId: g.id, investment, percent })}
        />
      ))}

      {unlinked.length > 0 && (
        <section className="space-y-2" aria-labelledby="unlinked">
          <h2 id="unlinked" className="text-sm font-semibold">
            Not linked to a goal
          </h2>
          <p className="text-xs text-muted-foreground">
            Add these to a goal with &ldquo;Add investment&rdquo;, or delete the ones you don&apos;t need.
          </p>
          <Card>
            <CardContent className="divide-y p-0 sm:p-0">
              {unlinked.map((i) => (
                <InvestmentRow
                  key={i.id}
                  investment={i}
                  value={i.value}
                  sip={i.monthlySip}
                  percent={100}
                  onClick={() => setSheet({ type: "investment", goalId: null, investment: i, percent: null })}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {sheet?.type === "goal" && <GoalSheet goal={sheet.goal} onClose={close} />}
      {sheet?.type === "investment" && (
        <InvestmentSheet
          goal={goals.find((g) => g.id === sheet.goalId) ?? null}
          investment={sheet.investment}
          percent={sheet.percent}
          investments={investments}
          links={links}
          onClose={close}
        />
      )}
    </main>
  );
}

function InvestmentRow({
  investment,
  value,
  sip,
  percent,
  onClick,
}: {
  investment: Investment;
  value: number;
  sip: number;
  percent: number;
  onClick: () => void;
}) {
  const title = investmentTitle(investment);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${title}`}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {investmentSub(investment)}
          {sip > 0 ? ` · SIP ${formatINR(sip)}/mo` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="tabular block text-sm">{formatINR(value)}</span>
        {percent < 100 && <span className="block text-xs text-muted-foreground">{percent}% of it</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function GoalCard({
  goal: g,
  onEdit,
  onAdd,
  onOpen,
}: {
  goal: TrackedGoal;
  onEdit: () => void;
  onAdd: () => void;
  onOpen: (i: Investment, percent: number) => void;
}) {
  const s = STATUS[g.status];
  const tone = g.status === "behind" ? "warning" : g.status === "overdue" ? "danger" : "success";
  const noDateOnWay = !g.targetDate && g.status === "on_track";

  let line: React.ReactNode;
  if (g.status === "reached") {
    line = "You've reached this goal.";
  } else if (g.status === "overdue") {
    line = "The target date has passed. Change the date or the target.";
  } else if (g.status === "no_investments") {
    line = g.targetDate
      ? `Add the investments saving for this goal. To get there on time you'd need about ${formatINR(g.extraSipNeeded)} a month.`
      : "Add the investments saving for this goal to see when you'll get there.";
  } else if (g.targetDate) {
    line = (
      <>
        At {formatINR(g.monthlySip)} a month and about {g.returnPct}% a year, you&apos;ll have about{" "}
        <span className="tabular font-medium">{formatINR(g.projected)}</span> by {formatDate(g.targetDate)}.
        {g.status === "behind" && (
          <span className="mt-1 block font-medium text-warning">
            Add {formatINR(g.extraSipNeeded)} a month to get there on time.
          </span>
        )}
      </>
    );
  } else {
    line =
      g.monthsToReach === null
        ? "Not reached within 50 years at this pace. Add a SIP to get there."
        : `At ${formatINR(g.monthlySip)} a month and about ${g.returnPct}% a year, you'll get there in about ${formatMonths(g.monthsToReach)} (${monthYear(g.reachDate)}).`;
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-lg font-semibold">{g.name}</h2>
            <p className="text-xs text-muted-foreground">
              Target {formatINR(g.target)} {g.targetDate ? `by ${formatDate(g.targetDate)}` : "· no fixed date"}
              {g.futureTarget !== g.target && ` · ${formatINR(g.futureTarget)} with ${g.inflationPct}% inflation`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={noDateOnWay ? "default" : s.variant}>{noDateOnWay ? "On its way" : s.label}</Badge>
            <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit goal ${g.name}`}>
              <Pencil className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="tabular text-2xl font-semibold">{formatINR(g.current)}</p>
            <p className="tabular text-sm text-muted-foreground">{Math.floor(g.progress * 100)}%</p>
          </div>
          <Progress value={g.progress * 100} tone={tone} label={`${g.name} progress`} />
          <p className="tabular text-xs text-muted-foreground">of {formatINR(g.futureTarget)}</p>
        </div>

        <p className="text-sm text-muted-foreground">{line}</p>

        {g.lines.length > 0 && (
          <div className="-mx-5 divide-y border-y sm:-mx-6">
            {g.lines.map((l) => (
              <InvestmentRow
                key={l.investment.id}
                investment={l.investment}
                value={l.value}
                sip={l.monthlySip}
                percent={l.percent}
                onClick={() => onOpen(l.investment, l.percent)}
              />
            ))}
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus /> Add investment
        </Button>
      </CardContent>
    </Card>
  );
}

function useSave(onClose: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      onClose();
    });
  const errorText = error && (
    <p role="alert" className="rounded-lg bg-danger-soft p-2 text-sm text-danger">
      {error}
    </p>
  );
  return { pending, run, errorText };
}

function GoalSheet({ goal, onClose }: { goal: TrackedGoal | null; onClose: () => void }) {
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState<number | null>(goal?.target ?? null);
  const [noDate, setNoDate] = useState(goal ? !goal.targetDate : false);
  const [date, setDate] = useState(goal?.targetDate ?? "");
  const [inflate, setInflate] = useState(!!goal?.inflationPct);
  const [inflation, setInflation] = useState(String(goal?.inflationPct ?? 6));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useSave(onClose);

  return (
    <Sheet title={goal ? "Edit goal" : "New goal"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveGoal({
              id: goal?.id ?? null,
              name,
              target: target ?? 0,
              targetDate: noDate ? null : date || null,
              inflationPct: inflate && !noDate ? Number(inflation) || 0 : null,
            }),
          );
        }}
      >
        <Field label="Goal name" htmlFor="g-name">
          <Input
            id="g-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. House down payment"
            maxLength={60}
            required
          />
        </Field>
        <Field label="Target amount" htmlFor="g-target">
          <MoneyInput id="g-target" value={target} onChange={setTarget} placeholder="e.g. 20,00,000" required />
        </Field>
        <div className="space-y-2">
          <Field label="Target date" htmlFor="g-date">
            <Input
              id="g-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={noDate}
              required={!noDate}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
            No fixed date: tell me when I&apos;ll get there
          </label>
        </div>
        {!noDate && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={inflate} onChange={(e) => setInflate(e.target.checked)} />
              Grow the target with inflation
            </label>
            {inflate && (
              <Field label="Inflation, % a year" htmlFor="g-infl" hint="Prices of most things rise 5 to 7% a year.">
                <Input
                  id="g-infl"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={20}
                  step={0.5}
                  value={inflation}
                  onChange={(e) => setInflation(e.target.value)}
                />
              </Field>
            )}
          </div>
        )}
        {errorText}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : goal ? "Save goal" : "Create goal"}
          </Button>
          {goal && (
            <Button
              type="button"
              variant={confirmDelete ? "destructive" : "ghost"}
              disabled={pending}
              onClick={() => (confirmDelete ? run(() => deleteGoal(goal.id)) : setConfirmDelete(true))}
            >
              {confirmDelete ? "Tap again to delete" : "Delete goal"}
            </Button>
          )}
        </div>
        {goal && confirmDelete && (
          <p className="text-xs text-muted-foreground">Investments stay; they&apos;re just unlinked from this goal.</p>
        )}
      </form>
    </Sheet>
  );
}

function InvestmentSheet({
  goal,
  investment,
  percent: initialPercent,
  investments,
  links,
  onClose,
}: {
  goal: TrackedGoal | null;
  investment: Investment | null;
  percent: number | null;
  investments: Investment[];
  links: Link[];
  onClose: () => void;
}) {
  // Investments that could be linked to this goal: not on it yet, with some share free.
  const available = goal
    ? investments.filter(
        (i) => !goal.lines.some((l) => l.investment.id === i.id) && freePercent(i.id, links, goal.id) > 0,
      )
    : [];
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [pickId, setPickId] = useState(available[0]?.id ?? "");
  const picked = investment ?? (mode === "existing" ? (available.find((i) => i.id === pickId) ?? null) : null);

  const [kind, setKind] = useState<Kind>(investment ? asKind(investment.kind) : "mutual_fund");
  const [fundCategory, setFundCategory] = useState(
    investment?.kind === "mutual_fund" ? (investment.category ?? "other") : "equity_index",
  );
  const [name, setName] = useState(investment?.name ?? "");
  const [value, setValue] = useState<number | null>(investment?.value ?? null);
  const [sip, setSip] = useState<number | null>(investment?.monthlySip || null);
  const [ret, setRet] = useState(investment?.returnPct?.toString() ?? "");
  const free = (id: string | null) => (goal ? freePercent(id ?? "", links, goal.id) : 100);
  const [percent, setPercent] = useState(String(initialPercent ?? (investment ? free(investment.id) : 100)));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useSave(onClose);

  const category = kind === "mutual_fund" ? fundCategory : null;
  const dflt = defaultReturn(kind, category);
  const sharedElsewhere = investment ? links.some((l) => l.investmentId === investment.id && l.goalId !== goal?.id) : false;
  const showDetails = !(mode === "existing" && !investment);

  function save() {
    const pct = goal ? Number(percent) : 100;
    if (mode === "existing" && !investment) {
      if (!picked) return;
      run(() =>
        saveInvestment({
          goalId: goal?.id ?? null,
          investmentId: picked.id,
          kind: asKind(picked.kind),
          fundCategory: picked.kind === "mutual_fund" ? (picked.category ?? "other") : null,
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
        goalId: goal?.id ?? null,
        investmentId: investment?.id ?? null,
        kind,
        fundCategory: category,
        name: name.trim() || null,
        value: value ?? 0,
        monthlySip: sip ?? 0,
        returnPct: ret.trim() === "" ? null : Number(ret),
        percent: pct,
      }),
    );
  }

  return (
    <Sheet
      title={investment ? investmentTitle(investment) : goal ? `Add to ${goal.name}` : "Investment"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!investment && available.length > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Which investment">
            {(
              [
                ["new", "New investment"],
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
                  if (m === "existing") setPercent(String(free(pickId)));
                  else setPercent("100");
                }}
                className={`rounded-md px-2 py-1.5 text-sm ${mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "existing" && !investment && (
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
        )}

        {showDetails && (
          <>
            <Field label="Type" htmlFor="i-kind">
              <Select id="i-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === "mutual_fund" && (
              <Field label="Fund category" htmlFor="i-cat">
                <Select id="i-cat" value={fundCategory} onChange={(e) => setFundCategory(e.target.value)}>
                  {FUND_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Nickname (optional)" htmlFor="i-name" hint="Anything that helps you recognise it.">
              <Input
                id="i-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === "mutual_fund" ? "e.g. My index SIP" : "e.g. Bank FD"}
                maxLength={80}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Current value" htmlFor="i-value">
                <MoneyInput id="i-value" value={value} onChange={setValue} />
              </Field>
              <Field label="Monthly SIP" htmlFor="i-sip">
                <MoneyInput id="i-sip" value={sip} onChange={setSip} />
              </Field>
            </div>
            <Field label="Expected return, % a year" htmlFor="i-ret" hint={`Leave blank to use ${dflt}% for this type.`}>
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
            {sharedElsewhere && (
              <p className="text-xs text-muted-foreground">
                This investment also counts toward another goal. Its value and SIP change there too.
              </p>
            )}
          </>
        )}

        {goal && (
          <Field
            label="Share for this goal, %"
            htmlFor="i-pct"
            hint="Use less than 100 if part of this investment is for another goal."
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
        )}

        {errorText}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending || (mode === "existing" && !investment && !picked)}>
            {pending ? "Saving…" : investment ? "Save" : "Add investment"}
          </Button>
          {investment && goal && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => removeFromGoal({ goalId: goal.id, investmentId: investment.id }))}
            >
              Remove from goal
            </Button>
          )}
          {investment && (
            <Button
              type="button"
              variant={confirmDelete ? "destructive" : "ghost"}
              disabled={pending}
              onClick={() => (confirmDelete ? run(() => deleteInvestment(investment.id)) : setConfirmDelete(true))}
            >
              {confirmDelete ? "Tap again to delete" : "Delete"}
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
