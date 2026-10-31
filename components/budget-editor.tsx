"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  COST_SUGGESTIONS,
  INCOME_TYPES,
  type Cost,
  type Income,
} from "@/lib/budget";
import { deleteBudgetRow, saveCost, saveIncome } from "@/lib/budget-actions";
import { formatINR } from "@/lib/format";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    after?: () => void,
  ) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      after?.();
    });
  return { pending, run, error };
}

/** One row: name, amount, and Save when changed. */
function Row({
  kind,
  id,
  name: name0,
  amount: amount0,
  type: type0,
  onSaved,
}: {
  kind: "income" | "cost";
  id?: string;
  name: string;
  amount: number | null;
  type?: string;
  /** For a new row: it's saved, so stop showing the blank one. */
  onSaved?: () => void;
}) {
  const [name, setName] = useState(name0);
  const [amount, setAmount] = useState<number | null>(amount0);
  const [type, setType] = useState(type0 ?? "stable_salary");
  const { pending, run, error } = useRun();
  const dirty =
    name !== name0 ||
    amount !== amount0 ||
    (kind === "income" && type !== type0);
  const save = () =>
    run(
      () =>
        kind === "income"
          ? saveIncome({
              id,
              label: name,
              type: type as "stable_salary",
              amount: amount ?? 0,
            })
          : saveCost({ id, name, amount: amount ?? 0 }),
      onSaved,
    );
  return (
    <li className="space-y-2 py-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label={kind === "income" ? "Income name" : "Cost name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="min-w-0 flex-1"
        />
        <MoneyInput
          aria-label={`${name || "Amount"} a month`}
          value={amount}
          onChange={setAmount}
          className="w-28 shrink-0"
        />
        {id && (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            disabled={pending}
            onClick={() => run(() => deleteBudgetRow({ kind, id }))}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {kind === "income" && (
        <Select
          aria-label={`${name || "Income"} type`}
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
      {dirty && (
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending || !name.trim()}
        >
          {pending ? "Saving…" : `Save ${name || "this"}`}
        </Button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </li>
  );
}

/** Money in and money out, edited in place. */
export function BudgetEditor({
  incomes,
  costs,
}: {
  incomes: Income[];
  costs: Cost[];
}) {
  const [newIncome, setNewIncome] = useState(false);
  const [newCost, setNewCost] = useState<string | null>(null);
  const missing = COST_SUGGESTIONS.filter(
    (s) => !costs.some((c) => c.name.toLowerCase() === s.toLowerCase()),
  );
  const total = (list: { amount: number }[]) =>
    list.reduce((s, x) => s + x.amount, 0);
  return (
    <>
      <section aria-labelledby="in-h" className="space-y-2">
        <h2 id="in-h" className="font-semibold">
          Money in{" "}
          <span className="text-sm font-normal text-muted-foreground">
            take-home, a month
          </span>
        </h2>
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {incomes.map((i) => (
            <Row
              key={`${i.id}:${i.amount}`}
              kind="income"
              id={i.id}
              name={i.label}
              amount={i.amount}
              type={i.type}
            />
          ))}
          {(newIncome || incomes.length === 0) && (
            <Row
              key="new-income"
              kind="income"
              name={incomes.length ? "" : "Salary"}
              amount={null}
              onSaved={() => setNewIncome(false)}
            />
          )}
        </ul>
        {incomes.length > 0 && !newIncome && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNewIncome(true)}
          >
            <Plus /> Add income
          </Button>
        )}
        {incomes.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Total {formatINR(total(incomes.filter((i) => i.active)))} a month.
          </p>
        )}
      </section>
      <section aria-labelledby="out-h" className="space-y-2">
        <h2 id="out-h" className="font-semibold">
          Money out{" "}
          <span className="text-sm font-normal text-muted-foreground">
            monthly costs
          </span>
        </h2>
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {costs.map((c) => (
            <Row
              key={`${c.id}:${c.amount}`}
              kind="cost"
              id={c.id}
              name={c.name}
              amount={c.amount}
            />
          ))}
          {newCost !== null && (
            <Row
              key={`new-${newCost}`}
              kind="cost"
              name={newCost}
              amount={null}
              onSaved={() => setNewCost(null)}
            />
          )}
          {costs.length === 0 && newCost === null && (
            <li className="py-3 text-sm text-muted-foreground">
              Add rent, groceries and the rest below.
            </li>
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          {missing.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNewCost(s)}
              className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
            >
              + {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setNewCost("")}
            className="press rounded-full border bg-card px-3 py-1 text-sm hover:border-primary"
          >
            + Something else
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Day-to-day spending&quot; covers food out, shopping and the rest
          you don&apos;t plan for. A rough figure is fine.
        </p>
      </section>
    </>
  );
}
