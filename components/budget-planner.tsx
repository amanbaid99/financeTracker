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
  INCOME_TYPES,
  type Cost,
  type Income,
} from "@/lib/budget";
import { deleteBudgetRow, saveCost, saveIncome } from "@/lib/budget-actions";
import { formatINR } from "@/lib/format";

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
  onEdit,
}: {
  name: string;
  sub?: string;
  amount: number;
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

  const line = (
    label: string,
    value: number,
    sign: "+" | "-",
    href?: string,
    sub?: string,
  ) => {
    const body = (
      <>
        <span className="min-w-0">
          <span className="block">{label}</span>
          {sub && (
            <span className="block text-xs text-muted-foreground">{sub}</span>
          )}
        </span>
        <span className="tabular flex shrink-0 items-center gap-1">
          {sign === "-" && value > 0 ? "−" : ""}
          {formatINR(value)}
          {href && (
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          )}
        </span>
      </>
    );
    return (
      <li key={label}>
        {href ? (
          <Link
            href={href}
            className="flex min-h-10 items-center justify-between gap-3 py-1 hover:opacity-80"
          >
            {body}
          </Link>
        ) : (
          <div className="flex min-h-10 items-center justify-between gap-3 py-1">
            {body}
          </div>
        )}
      </li>
    );
  };
  const calm = between && b.income === 0;

  return (
    <>
      <section
        aria-label="Your month"
        className="space-y-3 rounded-2xl border bg-card p-4"
      >
        {calm ? (
          <div>
            <p className="font-semibold">
              Your budget starts again with your salary.
            </p>
            <p className="text-sm text-muted-foreground">
              Add your salary below once you know it.
            </p>
          </div>
        ) : (
          <p className="tabular">
            <span
              className={`text-3xl font-semibold tracking-tight ${b.free < 0 ? "text-danger" : ""}`}
            >
              {formatINR(Math.abs(b.free))}
            </span>{" "}
            <span
              className={`text-sm ${b.free < 0 ? "text-danger" : "text-muted-foreground"}`}
            >
              {b.free >= 0
                ? "free to invest a month"
                : "a month more going out than coming in"}
            </span>
          </p>
        )}
        <ul className="divide-y border-t text-sm">
          {line("Money in", b.income, "+")}
          {line("Monthly costs", b.costs, "-")}
          {line(
            "EMIs",
            emis,
            "-",
            "/goals",
            loanEmis.length
              ? `${loanEmis.length} ${loanEmis.length === 1 ? "loan" : "loans"}, from your loan goals`
              : undefined,
          )}
          {line("SIPs running", sips, "-", "/assets", "From your investments")}
        </ul>
        {unsaved ? (
          <p className="text-xs text-muted-foreground">
            Showing what you&apos;re typing. Save to keep it.
          </p>
        ) : (
          !calm && <UseForPlan b={saved} planMonthly={planMonthly} />
        )}
      </section>

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
            costs.map((c) => ({ id: c.id, name: c.name, amount: c.amount })),
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
