"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { deleteMonthBill, saveMonthBill, setBillPaid } from "@/lib/actions";
import type { Bill } from "@/lib/bills";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Bill["kind"], string> = {
  card: "Card",
  emi: "EMI",
  insurance: "Insurance",
  planned: "Planned",
  sip: "SIP",
  custom: "Bill",
};

function statusText(b: Bill, paid: boolean): { text: string; tone: "muted" | "danger" | "warning" | "success" } {
  if (paid) return { text: "Paid", tone: "success" };
  switch (b.status) {
    case "not_generated":
      return {
        text: `Not generated yet${b.generatesOn ? ` · generates ${formatDate(b.generatesOn)}` : ""}${b.estimate ? ` · ${formatINR(b.estimate)} spent so far` : ""}`,
        tone: "warning",
      };
    case "overdue":
      return { text: `Overdue · was due ${formatDate(b.dueDate)}`, tone: "danger" };
    case "due":
      return { text: `Due ${formatDate(b.dueDate)}`, tone: "muted" };
    default:
      return { text: "This month", tone: "muted" };
  }
}

function AmountEditor({ bill, onDone }: { bill: Bill; onDone: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState<number | null>(bill.amount ?? null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const e = bill.edit!;
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
      <MoneyInput
        className="min-w-0 flex-1"
        aria-label={`${bill.label} amount`}
        placeholder="Billed amount"
        value={value}
        onChange={setValue}
      />
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveMonthBill(
              e.type === "card"
                ? { id: e.rowId, cardId: e.cardId, label: bill.label, amount: value, dueDay: null }
                : {
                    id: e.rowId,
                    seriesId: e.seriesId,
                    label: bill.label,
                    amount: value,
                    dueDay: e.dueDay,
                    recurring: e.recurring,
                  },
            );
            if (!res.ok) return setError(res.error);
            onDone();
            router.refresh();
          })
        }
      >
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      <p className="w-full text-xs text-muted-foreground">Leave blank if the bill isn&apos;t generated yet.</p>
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}

function AddBillForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [recurring, setRecurring] = useState(true);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          const res = await saveMonthBill({ label, amount, dueDay, recurring });
          if (!res.ok) return setError(res.error);
          onClose();
          router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="nb-label" className="text-xs text-muted-foreground">
            Bill
          </label>
          <Input
            id="nb-label"
            required
            maxLength={60}
            placeholder="e.g. Electricity"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="nb-amount" className="text-xs text-muted-foreground">
            Amount (blank if not generated)
          </label>
          <MoneyInput id="nb-amount" value={amount} onChange={setAmount} placeholder="Not generated yet" />
        </div>
        <div className="space-y-1">
          <label htmlFor="nb-due" className="text-xs text-muted-foreground">
            Due day
          </label>
          <Select id="nb-due" value={dueDay ?? ""} onChange={(e) => setDueDay(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Not sure</option>
            {Array.from({ length: 31 }, (_, k) => (
              <option key={k + 1} value={k + 1}>
                {k + 1}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--primary)]"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
        />
        Repeats every month
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Add bill
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function MonthBills({ bills, paidKeys, month }: { bills: Bill[]; paidKeys: string[]; month: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [paid, setPaid] = useOptimistic(new Set(paidKeys), (state, { key, value }: { key: string; value: boolean }) => {
    const next = new Set(state);
    if (value) next.add(key);
    else next.delete(key);
    return next;
  });
  const generated = bills.filter((b) => b.amount !== null);
  const total = generated.reduce((s, b) => s + (b.amount ?? 0), 0);
  const done = generated.filter((b) => paid.has(b.key)).reduce((s, b) => s + (b.amount ?? 0), 0);
  const pendingBills = bills.filter((b) => b.amount === null && !paid.has(b.key));

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Billed</dt>
          <dd className="tabular font-semibold">{formatINR(total)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Paid</dt>
          <dd className="tabular font-semibold">{formatINR(done)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Still to pay</dt>
          <dd className="tabular font-semibold">{formatINR(total - done)}</dd>
        </div>
      </dl>
      {pendingBills.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingBills.length} bill{pendingBills.length === 1 ? "" : "s"} not generated yet. Add the amount when it
          comes in.
        </p>
      )}

      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bills this month yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {bills.map((b) => {
            const isPaid = paid.has(b.key);
            const st = statusText(b, isPaid);
            return (
              <li key={b.key}>
                <div className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-[var(--primary)]"
                    checked={isPaid}
                    aria-label={`Mark ${b.label} as paid`}
                    onChange={(e) => {
                      const value = e.target.checked;
                      start(async () => {
                        setPaid({ key: b.key, value });
                        await setBillPaid({ month, key: b.key, paid: value, plannedId: b.plannedId });
                      });
                    }}
                  />
                  <div className={cn("min-w-0 flex-1", isPaid && "text-muted-foreground")}>
                    <p className={cn("truncate text-sm font-medium", isPaid && "line-through")}>{b.label}</p>
                    <p
                      className={cn(
                        "text-xs",
                        st.tone === "danger" && "text-danger",
                        st.tone === "warning" && "text-warning",
                        st.tone === "success" && "text-success",
                        st.tone === "muted" && "text-muted-foreground",
                      )}
                    >
                      {st.text}
                    </p>
                  </div>
                  <Badge variant="muted" className="hidden sm:inline-flex">
                    {KIND_LABEL[b.kind]}
                  </Badge>
                  {b.amount === null ? (
                    b.edit && (
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(b.key)}>
                        Add amount
                      </Button>
                    )
                  ) : (
                    <span className={cn("tabular text-sm", isPaid && "text-muted-foreground line-through")}>
                      {formatINR(b.amount)}
                    </span>
                  )}
                  {b.edit && b.amount !== null && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Edit ${b.label} amount`}
                      onClick={() => setEditing(b.key)}
                    >
                      <Pencil />
                    </Button>
                  )}
                  {b.edit?.type === "custom" && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${b.label}`}
                      onClick={() => {
                        const e = b.edit as Extract<NonNullable<Bill["edit"]>, { type: "custom" }>;
                        const stop = e.recurring
                          ? confirm(`Stop "${b.label}" repeating every month? Cancel removes it from this month only.`)
                          : true;
                        start(async () => {
                          await deleteMonthBill({ seriesId: e.seriesId, stopRepeating: stop });
                          router.refresh();
                        });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {editing === b.key && b.edit && <AmountEditor bill={b} onDone={() => setEditing(null)} />}
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <AddBillForm onClose={() => setAdding(false)} />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add a bill
        </Button>
      )}
    </div>
  );
}
