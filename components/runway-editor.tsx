"use client";

import { Check, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { RunwayCard } from "@/components/runway-card";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatINR } from "@/lib/format";
import type { DueLine, Runway, RunwayItem } from "@/lib/runway";
import {
  deleteRunwayItem,
  saveRunwayItem,
  saveSalaryDates,
  setRunwayChoice,
  setRunwayItemDone,
} from "@/lib/runway-actions";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string };

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<Result>,
    after?: () => void,
    note?: { text: string; undo?: () => Promise<Result> },
  ) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({
          text: res.error ?? "Could not save. Try again.",
          tone: "danger",
        });
        return;
      }
      after?.();
      router.refresh();
      if (note)
        toast({
          text: note.text,
          tone: "success",
          action: note.undo
            ? {
                label: "Undo",
                onClick: async () => {
                  await note.undo!();
                  router.refresh();
                },
              }
            : undefined,
        });
    });
  return { pending, run };
}

function SalaryDates({
  best,
  worst,
  active,
}: {
  best: string | null;
  worst: string | null;
  active: boolean;
}) {
  const [b, setB] = useState(best ?? "");
  const [w, setW] = useState(worst ?? "");
  const { pending, run } = useSave();
  return (
    <section
      aria-labelledby="salary-h"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <div>
        <h2 id="salary-h" className="font-semibold">
          When does salary start?
        </h2>
        <p className="text-sm text-muted-foreground">
          Not sure? Give the earliest and the latest it could be. Until then,
          your savings goals are on hold, as planned.
        </p>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSalaryDates({ best: b, worst: w || b }), undefined, {
            text: "Salary dates saved.",
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Earliest" htmlFor="sal-best">
            <Input
              id="sal-best"
              type="date"
              value={b}
              onChange={(e) => setB(e.target.value)}
              required
            />
          </Field>
          <Field label="Latest" htmlFor="sal-worst">
            <Input
              id="sal-worst"
              type="date"
              value={w}
              min={b || undefined}
              onChange={(e) => setW(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" className="w-full" disabled={pending || !b}>
          {pending ? "Saving…" : "Save dates"}
        </Button>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(() => saveSalaryDates(null), undefined, {
                text: "Welcome back to salary. Your goals are active again.",
              })
            }
          >
            My salary has started
          </Button>
        )}
      </form>
    </section>
  );
}

function ItemSheet({
  item,
  kind,
  onClose,
}: {
  item: RunwayItem | null;
  kind: RunwayItem["kind"];
  onClose: () => void;
}) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [amount, setAmount] = useState<number | null>(item?.amount ?? null);
  const [due, setDue] = useState(item?.due ?? "");
  const [confirm, setConfirm] = useState(false);
  const { pending, run } = useSave();
  const owed = kind === "owed_to_me";
  return (
    <Sheet
      title={
        item
          ? `Edit ${item.label}`
          : owed
            ? "Money owed to you"
            : "Something to pay"
      }
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              saveRunwayItem({
                id: item?.id ?? null,
                kind,
                label,
                amount: amount ?? 0,
                due: due || null,
              }),
            onClose,
            { text: item ? "Saved." : "Added." },
          );
        }}
      >
        <Field
          label={owed ? "Who or what" : "What it's for"}
          htmlFor="ri-label"
          hint={
            owed ? "Like friends' share of a trip." : "Like a card due or rent."
          }
        >
          <Input
            id="ri-label"
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </Field>
        <Field label="Amount" htmlFor="ri-amount">
          <MoneyInput id="ri-amount" value={amount} onChange={setAmount} />
        </Field>
        <Field
          label={owed ? "Expected by (optional)" : "Due on (optional)"}
          htmlFor="ri-due"
          hint={owed ? undefined : "Without a date, it counts as due now."}
        >
          <Input
            id="ri-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? "Saving…"
            : item
              ? "Save"
              : owed
                ? "Add money owed"
                : "Add payment"}
        </Button>
        {item && (
          <Button
            type="button"
            variant={confirm ? "destructive" : "ghost"}
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              confirm
                ? run(() => deleteRunwayItem(item.id), onClose, {
                    text: "Removed.",
                  })
                : setConfirm(true)
            }
          >
            {confirm ? "Tap again to remove" : "Remove"}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

const SOURCE: Record<DueLine["source"], string> = {
  emi: "EMI",
  living: "Living costs",
  bill: "From a bills fund",
  item: "Added by you",
};

export function RunwayEditor({
  runway,
  items,
  liquidHoldings,
  salaryBest,
  salaryWorst,
  active,
  monthlyLiving,
}: {
  runway: Runway | null;
  items: RunwayItem[];
  liquidHoldings: { name: string; value: number }[];
  salaryBest: string | null;
  salaryWorst: string | null;
  active: boolean;
  monthlyLiving: number;
}) {
  const [sheet, setSheet] = useState<{
    item: RunwayItem | null;
    kind: RunwayItem["kind"];
  } | null>(null);
  const { pending, run } = useSave();
  const owed = items.filter((i) => i.kind === "owed_to_me" && !i.done);
  const paid = items.filter((i) => i.kind === "to_pay" && i.done);
  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      {runway && <RunwayCard view={{ runway }} link={false} />}
      <SalaryDates best={salaryBest} worst={salaryWorst} active={active} />

      {runway && (
        <>
          <section
            aria-labelledby="have-h"
            className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="have-h" className="font-semibold">
                Money you can reach quickly
              </h2>
              <span className="tabular font-semibold">
                {formatINR(runway.liquid)}
              </span>
            </div>
            <ul className="divide-y text-sm">
              {liquidHoldings.map((h) => (
                <li
                  key={h.name}
                  className="flex items-baseline justify-between gap-3 py-2"
                >
                  <span className="min-w-0 break-words">{h.name}</span>
                  <span className="tabular">{formatINR(h.value)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Savings accounts, FDs and liquid funds, including ones set aside
              for goals. Out of date?{" "}
              <Link href="/goals?do=update" className="text-primary underline">
                Update values
              </Link>{" "}
              or add a bank account from +.
            </p>
            <div className="border-t pt-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Owed to you</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10"
                  onClick={() => setSheet({ item: null, kind: "owed_to_me" })}
                >
                  <Plus /> Add
                </Button>
              </div>
              {owed.length ? (
                <ul className="divide-y text-sm">
                  {owed.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 py-2">
                      <button
                        type="button"
                        onClick={() => setSheet({ item: i, kind: i.kind })}
                        className="min-h-10 min-w-0 flex-1 text-left"
                        aria-label={`Edit ${i.label}`}
                      >
                        <span className="block break-words">{i.label}</span>
                        <span className="tabular text-xs text-muted-foreground">
                          {formatINR(i.amount)}
                          {i.due ? ` · by ${formatDate(i.due)}` : ""}
                        </span>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-10"
                        disabled={pending}
                        onClick={() =>
                          run(() => setRunwayItemDone(i.id, true), undefined, {
                            text: `${i.label}: received. It's in your bank now, so update that balance.`,
                            undo: () => setRunwayItemDone(i.id, false),
                          })
                        }
                      >
                        Received
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-1 text-xs text-muted-foreground">
                  Money friends or anyone else will pay you back. It isn&apos;t
                  counted until it arrives.
                </p>
              )}
            </div>
          </section>

          <section
            aria-labelledby="due-h"
            className="surface-card space-y-2 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="due-h" className="font-semibold">
                  Due till {formatDate(runway.worst.until)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  The latest salary date, so nothing is missed.
                </p>
              </div>
              <span className="tabular shrink-0 font-semibold">
                {formatINR(runway.worst.due)}
              </span>
            </div>
            <ul className="divide-y text-sm">
              {runway.worst.lines.map((l) => {
                const late = l.source !== "living" && l.date > runway.best.until;
                const item = l.itemId ? itemById.get(l.itemId) : undefined;
                return (
                  <li key={l.key} className="space-y-1 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block break-words font-medium",
                            !l.counted && "text-muted-foreground line-through",
                          )}
                        >
                          {l.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {l.source === "living"
                            ? `${formatINR(monthlyLiving)} a month till ${formatDate(l.date)}`
                            : `${SOURCE[l.source]} · ${formatDate(l.date)}`}
                          {late && " · only if salary is late"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "tabular shrink-0",
                          !l.counted && "text-muted-foreground line-through",
                        )}
                      >
                        {formatINR(l.amount)}
                      </span>
                    </div>
                    {l.why && (
                      <p className="text-xs text-muted-foreground">
                        {l.counted
                          ? "Counted."
                          : `Not counted: ${l.why.toLowerCase()}.`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {l.source === "item" && item && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => setRunwayItemDone(item.id, true),
                                undefined,
                                {
                                  text: `${item.label} paid. Update your bank balance when you can.`,
                                  undo: () => setRunwayItemDone(item.id, false),
                                },
                              )
                            }
                          >
                            <Check /> Paid
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="min-h-10"
                            onClick={() => setSheet({ item, kind: item.kind })}
                          >
                            <Pencil /> Edit
                          </Button>
                        </>
                      )}
                      {(l.source === "bill" || l.source === "living") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-10"
                          disabled={pending}
                          onClick={() =>
                            run(() => setRunwayChoice(l.key, !l.counted))
                          }
                        >
                          {l.counted ? "Don't count this" : "Count this"}
                        </Button>
                      )}
                      {l.source === "emi" && (
                        <Link
                          href="/cards#loans-h"
                          className="inline-flex min-h-10 items-center text-xs text-muted-foreground underline"
                        >
                          Mark paid in Credit
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setSheet({ item: null, kind: "to_pay" })}
            >
              <Plus /> Add something to pay
            </Button>
            <p className="text-xs text-muted-foreground">
              Add card dues, rent or anything else before salary. EMIs come from
              your loans and living costs from your budget.
            </p>
            {paid.length > 0 && (
              <p className="text-xs text-success">
                Paid so far: {formatINR(paid.reduce((s, i) => s + i.amount, 0))}{" "}
                across {paid.length}{" "}
                {paid.length === 1 ? "payment" : "payments"}.
              </p>
            )}
          </section>
        </>
      )}
      {sheet && (
        <ItemSheet
          item={sheet.item}
          kind={sheet.kind}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
