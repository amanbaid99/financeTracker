"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BudgetSummary, UseForPlan } from "@/components/budget-card";
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
/** A row being edited, added to, or a new one. */
type Editing =
  | { mode: "edit"; kind: Kind; id: string }
  | { mode: "add"; kind: Kind; id: string }
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
  onAmount,
  onDone,
}: {
  kind: Kind;
  id?: string;
  name: string;
  amount: number | null;
  type?: string;
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
          className="min-w-0 flex-1"
        />
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

/** "+ ₹" on a row: add an amount to what's already there. */
function AddToRow({
  kind,
  row,
  onAmount,
  onDone,
}: {
  kind: Kind;
  row: { id: string; name: string; amount: number; type?: string };
  onAmount: (v: number | null) => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [extra, setExtra] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const total = row.amount + (extra ?? 0);
  return (
    <li className="space-y-2 rounded-xl bg-muted/50 p-3">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-sm">
          Add to <b>{row.name}</b>
        </span>
        <MoneyInput
          aria-label={`Amount to add to ${row.name}`}
          value={extra}
          placeholder="e.g. 2,000"
          onChange={(v) => {
            setExtra(v);
            onAmount(row.amount + (v ?? 0));
          }}
          className="w-32 shrink-0"
        />
      </div>
      <p className="tabular text-xs text-muted-foreground">
        {formatINR(row.amount)} + {formatINR(extra ?? 0)} ={" "}
        <b>{formatINR(total)}</b> a month
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !extra}
          onClick={() =>
            start(async () => {
              setError("");
              const res =
                kind === "income"
                  ? await saveIncome({
                      id: row.id,
                      label: row.name,
                      type: (row.type ?? "stable_salary") as "stable_salary",
                      amount: total,
                    })
                  : await saveCost({
                      id: row.id,
                      name: row.name,
                      amount: total,
                    });
              if (!res.ok) return setError(res.error);
              router.refresh();
              onDone();
            })
          }
        >
          {pending ? "Adding…" : `Add ${formatINR(extra ?? 0)}`}
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
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}

/** A saved row: tap to edit, + to add to it. */
function ReadRow({
  name,
  sub,
  amount,
  onEdit,
  onAdd,
}: {
  name: string;
  sub?: string;
  amount: number;
  onEdit: () => void;
  onAdd: () => void;
}) {
  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="press flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:bg-muted/50"
      >
        <span className="min-w-0">
          <span className="block break-words text-sm font-medium">{name}</span>
          {sub && (
            <span className="block text-xs text-muted-foreground">{sub}</span>
          )}
        </span>
        <span className="tabular shrink-0 text-sm">{formatINR(amount)}</span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add to ${name}`}
        className="press inline-flex size-9 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
      >
        <Plus className="size-4" aria-hidden />
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
 * The whole budget on one page: money in, monthly costs, and what the app
 * already counts (EMIs, SIPs). Tap a line to change it, + to add to it.
 * The free amount at the top follows what you type, before you save.
 */
export function BudgetPlanner({
  incomes,
  costs,
  loanEmis,
  sips,
  planMonthly,
}: {
  incomes: Income[];
  costs: Cost[];
  loanEmis: { name: string; emi: number }[];
  sips: number;
  planMonthly: number | null;
}) {
  const [editing, setEditing] = useState<Editing>(
    incomes.length ? null : { mode: "new", kind: "income", name: "Salary" },
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
      ) : editing?.mode === "add" && editing.id === r.id ? (
        <AddToRow
          key={r.id}
          kind={kind}
          row={r}
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
          onAdd={() => {
            setDraft({});
            setEditing({ mode: "add", kind, id: r.id });
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
        onAmount={(v) => setDraft({ new: v })}
        onDone={done}
      />
    ) : null;

  return (
    <>
      <section
        aria-label="Your month"
        className="space-y-3 rounded-2xl border bg-card p-4"
      >
        <BudgetSummary b={b} />
        {unsaved ? (
          <p className="text-xs text-muted-foreground">
            Showing what you&apos;re typing. Save to keep it.
          </p>
        ) : (
          <UseForPlan b={saved} planMonthly={planMonthly} />
        )}
      </section>
      {/* Stays in view while you scroll and edit, following what you type. */}
      <p
        aria-hidden
        className="tabular sticky top-[calc(3rem+env(safe-area-inset-top))] z-20 -my-2 rounded-full border bg-card/95 px-4 py-2 text-center text-sm shadow-sm backdrop-blur"
      >
        {b.free >= 0 ? (
          <>
            <b>{formatINR(b.free)}</b> free to invest a month
          </>
        ) : (
          <span className="text-danger">
            <b>{formatINR(-b.free)}</b> a month over
          </span>
        )}
        {unsaved ? " · not saved yet" : ""}
      </p>

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
              setEditing({ mode: "new", kind: "income", name: "" })
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
                Add rent, groceries and the rest below.
              </li>
            )}
        </ul>
        {!editing && (
          <div className="flex flex-wrap gap-2 pt-1">
            {missing.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setEditing({ mode: "new", kind: "cost", name: s })
                }
                className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
              >
                + {s}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setEditing({ mode: "new", kind: "cost", name: "" })
              }
              className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
            >
              + Something else
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          &quot;Day-to-day spending&quot; covers food out, shopping and the rest
          you don&apos;t plan for. A rough figure is fine. Card spends friends
          pay back don&apos;t count.
        </p>
      </Section>

      <Section id="auto-h" title="Counted for you" total={emis + sips}>
        <ul className="space-y-1 text-sm">
          {loanEmis.map((l) => (
            <li key={l.name}>
              <Link
                href="/cards"
                className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-1 py-2 hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block break-words font-medium">
                    EMI · {l.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Auto · from Credit
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tabular">{formatINR(l.emi)}</span>
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/portfolio"
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-1 py-2 hover:bg-muted/50"
            >
              <span className="min-w-0">
                <span className="block font-medium">SIPs running</span>
                <span className="block text-xs text-muted-foreground">
                  Auto · from Portfolio
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular">{formatINR(sips)}</span>
                <ChevronRight
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/cards"
            className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
          >
            + Add a loan
          </Link>
          <Link
            href="/portfolio?do=update"
            className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
          >
            + Change a SIP
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          These update by themselves when you change a loan or a SIP. Yearly
          payments like insurance belong in a bills fund goal, which is already
          a SIP.
        </p>
      </Section>
    </>
  );
}
