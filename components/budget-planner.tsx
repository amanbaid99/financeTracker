"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UseForPlan } from "@/components/budget-card";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  budget,
  COST_SUGGESTIONS,
  rateNote,
  INCOME_TYPES,
  type Cost,
  type Income,
} from "@/lib/budget";
import { deleteBudgetRow, saveCost, saveIncome } from "@/lib/budget-actions";
import { formatINR } from "@/lib/format";
import { swatchFor } from "@/lib/portfolio";
import { cn } from "@/lib/utils";

type Kind = "income" | "cost";
/** A row being edited, or a new one. */
type Editing =
  | { mode: "edit"; kind: Kind; id: string }
  | { mode: "new"; kind: Kind; name: string }
  | null;

const typeLabel = (t: string) =>
  INCOME_TYPES.find((x) => x.value === t)?.label ?? "Income";

/** Edit a row in place: name, amount (and type for income). */
function EditRow({
  kind,
  id,
  name: name0,
  amount: amount0,
  type: type0,
  suggestions = [],
  onAmount,
  onDone,
}: {
  kind: Kind;
  id?: string;
  name: string;
  amount: number | null;
  type?: string;
  /** Common names to pick from while typing a new row's name. */
  suggestions?: string[];
  /** Typing updates the summary at the top before saving. */
  onAmount: (v: number | null) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(name0);
  const [amount, setAmount] = useState<number | null>(amount0);
  const [type, setType] = useState(type0 ?? "stable_salary");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      onDone();
    });
  const label = name.trim() || (kind === "income" ? "Income" : "Cost");
  return (
    <li className="space-y-2 rounded-xl bg-muted/50 p-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label={kind === "income" ? "Income name" : "Cost name"}
          value={name}
          placeholder={kind === "income" ? "e.g. Salary" : "e.g. Rent"}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          list={suggestions.length ? `${kind}-names` : undefined}
          className="min-w-0 flex-1"
        />
        {suggestions.length > 0 && (
          <datalist id={`${kind}-names`}>
            {suggestions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
        <MoneyInput
          aria-label={`${label} a month`}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            onAmount(v);
          }}
          className="w-32 shrink-0"
        />
      </div>
      {kind === "income" && (
        <Select
          aria-label={`${label} type`}
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-9 w-auto"
        >
          {INCOME_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !name.trim() || amount === null}
          onClick={() =>
            run(() =>
              kind === "income"
                ? saveIncome({
                    id,
                    label: name,
                    type: type as "stable_salary",
                    amount: amount ?? 0,
                  })
                : saveCost({ id, name, amount: amount ?? 0 }),
            )
          }
        >
          {pending ? "Saving…" : `Save ${label}`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
        >
          Cancel
        </Button>
        {id && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-danger"
            disabled={pending}
            onClick={() => run(() => deleteBudgetRow({ kind, id }))}
          >
            Remove
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}

/** A saved row: tap to edit. */
function ReadRow({
  name,
  sub,
  amount,
  share,
  onEdit,
}: {
  name: string;
  sub?: string;
  amount: number;
  /** Share of all costs, shown as a thin bar. */
  share?: number;
  onEdit: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="press flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block break-words text-sm font-medium">{name}</span>
          {sub && (
            <span className="block text-xs text-muted-foreground">{sub}</span>
          )}
        </span>
        <span className="tabular shrink-0 text-sm">{formatINR(amount)}</span>
      </button>
      {share !== undefined && share > 0 && (
        <span
          className="mx-1 -mt-1 mb-1 block h-1 overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-foreground/35"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      )}
    </li>
  );
}

function Section({
  id,
  title,
  total,
  children,
}: {
  id: string;
  title: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-2 rounded-2xl border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        <span className="tabular text-sm text-muted-foreground">
          {formatINR(total)} a month
        </span>
      </div>
      {children}
    </section>
  );
}

/**
 * The whole budget on one page: one summary (what's free, and how it adds
 * up, with EMIs and SIPs counted for you), then money in and monthly costs.
 * Tap a line to change it. The summary follows what you type, before you
 * save.
 */
export function BudgetPlanner({
  incomes,
  costs,
  loanEmis,
  sips,
  planMonthly,
  between = false,
}: {
  incomes: Income[];
  costs: Cost[];
  loanEmis: { name: string; emi: number }[];
  sips: number;
  planMonthly: number | null;
  /** Between jobs: no income yet, so no "over budget" warning. */
  between?: boolean;
}) {
  const [editing, setEditing] = useState<Editing>(
    incomes.length || between
      ? null
      : { mode: "new", kind: "income", name: "Salary" },
  );
  // Unsaved amounts, by row ("new" for a row being added).
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const done = () => {
    setEditing(null);
    setDraft({});
  };
  const amountOf = (key: string, saved: number) =>
    key in draft ? (draft[key] ?? 0) : saved;
  const emis = loanEmis.reduce((s, l) => s + l.emi, 0);
  const previewIncomes = incomes.map((i) => ({
    ...i,
    amount: amountOf(i.id, i.amount),
  }));
  const previewCosts = costs.map((c) => ({
    ...c,
    amount: amountOf(c.id, c.amount),
  }));
  if (editing?.mode === "new" && draft.new != null) {
    if (editing.kind === "income")
      previewIncomes.push({
        id: "new",
        label: editing.name,
        type: "other",
        amount: draft.new,
        active: true,
      });
    else
      previewCosts.push({ id: "new", name: editing.name, amount: draft.new });
  }
  const b = budget({
    incomes: previewIncomes,
    costs: previewCosts,
    emis,
    sips,
  });
  const saved = budget({ incomes, costs, emis, sips });
  const unsaved = Object.keys(draft).length > 0;
  const missing = COST_SUGGESTIONS.filter(
    (s) => !costs.some((c) => c.name.toLowerCase() === s.toLowerCase()),
  );

  const rows = (
    kind: Kind,
    list: {
      id: string;
      name: string;
      amount: number;
      sub?: string;
      type?: string;
      share?: number;
    }[],
  ) =>
    list.map((r) =>
      editing?.mode === "edit" && editing.id === r.id ? (
        <EditRow
          key={r.id}
          kind={kind}
          id={r.id}
          name={r.name}
          amount={r.amount}
          type={r.type}
          onAmount={(v) => setDraft({ [r.id]: v })}
          onDone={done}
        />
      ) : (
        <ReadRow
          key={r.id}
          name={r.name}
          sub={r.sub}
          amount={r.amount}
          share={r.share}
          onEdit={() => {
            setDraft({});
            setEditing({ mode: "edit", kind, id: r.id });
          }}
        />
      ),
    );
  const newRow = (kind: Kind) =>
    editing?.mode === "new" && editing.kind === kind ? (
      <EditRow
        key={`new-${editing.name}`}
        kind={kind}
        name={editing.name}
        amount={null}
        suggestions={kind === "cost" ? missing : []}
        onAmount={(v) => setDraft({ new: v })}
        onDone={done}
      />
    ) : null;

  const calm = between && b.income === 0;
  const out = b.costs + b.emis + b.sips;
  // What the bar measures against: take-home, or what goes out when that's more.
  const base = Math.max(b.income, out, 1);
  const parts = [
    {
      key: "costs",
      label: "Monthly costs",
      value: b.costs,
      dot: "bg-foreground/45",
    },
    {
      key: "emis",
      label: "EMIs",
      value: b.emis,
      dot: "bg-warning",
      href: "/goals",
      sub: loanEmis.length
        ? `${loanEmis.length} ${loanEmis.length === 1 ? "loan" : "loans"}`
        : undefined,
    },
    {
      key: "sips",
      label: "SIPs running",
      value: b.sips,
      // The equity colour, so SIPs don't look like "free" money.
      dot: swatchFor(1),
      href: "/assets",
    },
    ...(calm
      ? []
      : [
          {
            key: "free",
            label: b.free >= 0 ? "Free to invest" : "Over by",
            value: Math.abs(b.free),
            dot: b.free >= 0 ? "bg-success" : "bg-danger",
          },
        ]),
  ] as {
    key: string;
    label: string;
    value: number;
    dot: string;
    href?: string;
    sub?: string;
  }[];
  const pctOf = (v: number) =>
    b.income > 0 ? `${Math.round((v / b.income) * 100)}%` : "";
  const biggest = [...costs].sort((x, y) => y.amount - x.amount)[0];
  const startNew = (kind: Kind, name = "") => {
    setDraft({});
    setEditing({ mode: "new", kind, name });
  };

  // One next step, picked from where the budget stands.
  const next: {
    title: string;
    text: string;
    action?: React.ReactNode;
    warn?: boolean;
  } | null =
    unsaved || editing
      ? null
      : b.income === 0
        ? calm
          ? null
          : {
              title: "Add your take-home pay",
              text: "What lands in your bank each month. Everything else here works from it.",
              action: (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  onClick={() => startNew("income", "Salary")}
                >
                  <Plus /> Add take-home pay
                </Button>
              ),
            }
        : b.free < 0
          ? {
              warn: true,
              title: `${formatINR(-b.free)} a month more goes out than comes in`,
              text: biggest
                ? `Your biggest cost is ${biggest.name} at ${formatINR(biggest.amount)}. Small trims there help most.`
                : "Check your costs below.",
              action: biggest ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setDraft({});
                    setEditing({ mode: "edit", kind: "cost", id: biggest.id });
                    // The line opens below; bring it into view.
                    setTimeout(
                      () =>
                        document
                          .getElementById("out-h")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      50,
                    );
                  }}
                >
                  Change {biggest.name}
                </Button>
              ) : undefined,
            }
          : b.free > 0 && planMonthly !== b.planMonthly
            ? {
                title: `Put ${formatINR(b.free)} a month to work`,
                text: "Your plan splits it across your goals, top of your order first.",
                action: <UseForPlan b={saved} planMonthly={planMonthly} />,
              }
            : b.free > 0
              ? {
                  title: "Your plan uses this budget",
                  text: `${formatINR(b.planMonthly)} a month goes to your goals.`,
                  action: (
                    <Link
                      href="/goals/plan"
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
                    >
                      See your plan{" "}
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  ),
                }
              : null;

  return (
    <>
      <section
        aria-label="Your month"
        className="surface-card space-y-4 rounded-2xl border bg-card p-4"
      >
        {calm ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Between jobs
            </p>
            <p className="tabular mt-0.5 text-3xl font-semibold tracking-tight">
              {formatINR(out)}
            </p>
            <p className="text-sm text-muted-foreground">
              goes out each month. Your budget starts again with your salary.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {b.free >= 0 ? "Left to invest" : "Over budget"}
            </p>
            <p
              className={cn(
                "tabular mt-0.5 text-3xl font-semibold tracking-tight",
                b.free >= 0 ? "text-success" : "text-danger",
              )}
            >
              {formatINR(Math.abs(b.free))}
            </p>
            <p
              className={cn(
                "text-sm",
                b.free >= 0 ? "text-muted-foreground" : "text-danger",
              )}
            >
              {b.free >= 0
                ? "free to invest a month"
                : "a month more going out than coming in"}
              {b.income > 0 && ` · of ${formatINR(b.income)} take-home`}
            </p>
          </div>
        )}

        <div
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={parts
            .filter((x) => x.value > 0)
            .map((x) => `${x.label} ${formatINR(x.value)}`)
            .join(", ")}
        >
          {parts
            .filter((x) => x.value > 0)
            .map((x) => (
              <span
                key={x.key}
                className={cn("h-full", x.dot)}
                style={{ width: `${(x.value / base) * 100}%` }}
              />
            ))}
        </div>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {parts.map((x) => {
            const body = (
              <>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", x.dot)}
                    aria-hidden
                  />
                  {x.label}
                  {x.href && <ChevronRight className="size-3" aria-hidden />}
                </span>
                <span className="tabular block font-semibold">
                  {formatINR(x.value)}
                  {pctOf(x.value) && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {pctOf(x.value)}
                    </span>
                  )}
                </span>
                {x.sub && (
                  <span className="block text-xs text-muted-foreground">
                    {x.sub}
                  </span>
                )}
              </>
            );
            return (
              <li key={x.key}>
                {x.href ? (
                  <Link href={x.href} className="block hover:opacity-80">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>

        {!calm && b.income > 0 && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs">
            You invest <b>{pctOf(b.sips) || "0%"}</b> of your take-home now
            {b.free > 0 && (
              <>
                , <b>{pctOf(b.planMonthly)}</b> once what&apos;s free is
                invested
              </>
            )}
            . {rateNote(b.rateWithPlan).text}
          </p>
        )}
        {unsaved && (
          <p className="text-xs text-muted-foreground">
            Showing what you&apos;re typing. Save to keep it.
          </p>
        )}
      </section>

      {next && (
        <section
          aria-label="Next step"
          className={cn(
            "space-y-2 rounded-2xl border p-4",
            next.warn
              ? "border-warning/40 bg-warning-soft/50"
              : "border-primary/30 bg-primary-soft/40",
          )}
        >
          <p
            className={cn(
              "text-xs font-medium",
              next.warn ? "text-warning" : "text-primary",
            )}
          >
            Next step
          </p>
          <p className="font-semibold leading-snug">{next.title}</p>
          <p className="text-sm text-muted-foreground">{next.text}</p>
          {next.action}
        </section>
      )}

      <Section id="in-h" title="Money in" total={b.income}>
        <ul className="space-y-1">
          {rows(
            "income",
            incomes.map((i) => ({
              id: i.id,
              name: i.label,
              amount: i.amount,
              type: i.type,
              sub:
                typeLabel(i.type) === i.label ? undefined : typeLabel(i.type),
            })),
          )}
          {newRow("income")}
        </ul>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setEditing({
                mode: "new",
                kind: "income",
                name: incomes.length ? "" : "Salary",
              })
            }
          >
            <Plus /> Add income
          </Button>
        )}
      </Section>

      <Section id="out-h" title="Monthly costs" total={b.costs}>
        <ul className="space-y-1">
          {rows(
            "cost",
            [...costs]
              .sort((x, y) => y.amount - x.amount)
              .map((c) => ({
                id: c.id,
                name: c.name,
                amount: c.amount,
                share: b.costs > 0 ? c.amount / b.costs : 0,
              })),
          )}
          {newRow("cost")}
          {costs.length === 0 &&
            !(editing?.mode === "new" && editing.kind === "cost") && (
              <li className="py-2 text-sm text-muted-foreground">
                Rent, groceries, bills and day-to-day spending. A rough figure
                is fine.
              </li>
            )}
        </ul>
        {!editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing({ mode: "new", kind: "cost", name: "" })}
          >
            <Plus /> Add a cost
          </Button>
        )}
      </Section>
    </>
  );
}
