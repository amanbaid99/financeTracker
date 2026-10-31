"use client";

import { ChevronDown, Landmark, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { monthYear } from "@/lib/goal-summary";
import {
  LOAN_TYPES,
  loanTotals,
  loanTypeLabel,
  loanView,
  type Loan,
  type LoanType,
  type LoanView,
} from "@/lib/loans";
import {
  deleteLoan,
  markEmiPaid,
  saveLoan,
  undoEmiPaid,
} from "@/lib/loans-actions";
import { cn } from "@/lib/utils";

const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const TONE = {
  danger: "text-danger",
  warning: "text-warning",
  normal: "text-foreground",
} as const;

function useRun(onDone?: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      onDone?.();
    });
  return { pending, run, error };
}

/** The next EMI with Mark paid; right after marking, Undo for a few seconds. */
function NextEmi({ v }: { v: LoanView }) {
  const { pending, run, error } = useRun();
  const [paid, setPaid] = useState<string | null>(null);
  useEffect(() => {
    if (!paid) return;
    const t = setTimeout(() => setPaid(null), 6000);
    return () => clearTimeout(t);
  }, [paid]);
  if (paid)
    return (
      <div className="relative z-10 flex items-center justify-between gap-2 text-sm">
        <span className="text-success">
          EMI for {formatDate(paid).split(" ").slice(0, 2).join(" ")} marked
          paid
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const res = await undoEmiPaid({
                loanId: v.loan.id,
                dueDate: paid,
              });
              if (res.ok) setPaid(null);
              return res;
            })
          }
          className="shrink-0 text-xs font-semibold underline underline-offset-2"
        >
          Undo
        </button>
      </div>
    );
  if (!v.next) return null;
  const n = v.next;
  return (
    <div className="flex items-center justify-between gap-2">
      <p className={cn("tabular min-w-0 text-sm font-semibold", TONE[n.tone])}>
        {formatINR(n.amount)} <span className="font-medium">{n.label}</span>
      </p>
      <span className="relative z-10 shrink-0 text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          aria-label={`Mark ${v.loan.name} EMI paid`}
          onClick={() =>
            run(async () => {
              const res = await markEmiPaid({
                loanId: v.loan.id,
                dueDate: n.date,
              });
              if (res.ok) setPaid(n.date);
              return res;
            })
          }
        >
          {pending ? "Saving…" : "Mark paid"}
        </Button>
        {error && <span className="block text-xs text-danger">{error}</span>}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right">{value}</dd>
    </div>
  );
}

type CardRef = { id: string; label: string };

function LoanDetails({
  v,
  cards,
  onEdit,
}: {
  v: LoanView;
  cards: CardRef[];
  onEdit: () => void;
}) {
  const { loan: l, state: s } = v;
  const { pending, run } = useRun();
  const [confirm, setConfirm] = useState(false);
  const card = cards.find((c) => c.id === l.cardId);
  const latest = [...l.payments].sort((a, b) =>
    a.dueDate < b.dueDate ? 1 : -1,
  )[0];
  return (
    <div className="expand-in space-y-4 border-t px-4 pb-4 pt-2">
      <dl className="divide-y">
        <Row label="Owed today" value={formatINR(s.balance)} />
        {l.principal ? (
          <Row label="Amount withdrawn" value={formatINR(l.principal)} />
        ) : null}
        <Row label="EMI" value={`${formatINR(s.emi)} at ${s.ratePct}%`} />
        <Row
          label={card ? `On ${card.label}` : "EMI date"}
          value={
            card && l.billDay
              ? `Billed on the ${ordinal(l.billDay)}, due on the ${ordinal(s.emiDay)}`
              : `The ${ordinal(s.emiDay)} of each month`
          }
        />
        {s.balance > 0 && (
          <Row
            label="This EMI"
            value={`${formatINR(s.interestThisMonth)} interest, ${formatINR(s.principalThisMonth)} principal`}
          />
        )}
        {s.interestLeft !== null && s.balance > 0 && (
          <Row
            label="Interest still to pay"
            value={formatINR(s.interestLeft)}
          />
        )}
        {s.endDate && <Row label="Last EMI" value={monthYear(s.endDate)} />}
        {s.feeRate > 0 && (
          <Row
            label="Closing it today costs"
            value={`${formatINR(s.feeToday)} in charges`}
          />
        )}
      </dl>
      {l.payments.length > 0 && (
        <section aria-label={`${l.name} payments`} className="space-y-1">
          <h3 className="text-sm font-semibold">Marked paid</h3>
          <ul className="divide-y text-sm">
            {l.payments.slice(0, 6).map((p) => (
              <li
                key={p.dueDate}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>EMI for {formatDate(p.dueDate)}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular">{formatINR(p.amount)}</span>
                  {p === latest && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          undoEmiPaid({ loanId: l.id, dueDate: p.dueDate }),
                        )
                      }
                      className="text-xs font-semibold text-primary underline underline-offset-2"
                    >
                      Undo
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {l.goal ? (
        <p className="text-sm">
          Saving to close it early:{" "}
          <Link
            href={`/goals?open=${l.goal.id}`}
            className="text-primary underline underline-offset-2"
          >
            {l.goal.name}
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Edit loan
        </Button>
        <Button
          type="button"
          variant={confirm ? "destructive" : "ghost"}
          size="sm"
          disabled={pending}
          onClick={() =>
            confirm ? run(() => deleteLoan(l.id)) : setConfirm(true)
          }
        >
          {confirm ? "Tap again to delete" : "Delete loan"}
        </Button>
      </div>
      {confirm && l.goal && (
        <p className="text-xs text-muted-foreground">
          The goal {l.goal.name} stays, with the loan details it had.
        </p>
      )}
    </div>
  );
}

function LoanSheet({
  loan,
  cards,
  today,
  onClose,
}: {
  loan: Loan | null;
  cards: CardRef[];
  today: string;
  onClose: () => void;
}) {
  const { pending, run, error } = useRun(onClose);
  const [name, setName] = useState(loan?.name ?? "");
  const [type, setType] = useState<LoanType>(loan?.type ?? "personal");
  const [cardId, setCardId] = useState(loan?.cardId ?? cards[0]?.id ?? "");
  const [principal, setPrincipal] = useState<number | null>(
    loan?.principal ?? null,
  );
  const [takenOn, setTakenOn] = useState(loan?.takenOn ?? "");
  const [rate, setRate] = useState(loan ? String(loan.ratePct) : "");
  const [emi, setEmi] = useState<number | null>(loan?.emi ?? null);
  const [totalEmis, setTotalEmis] = useState(
    loan?.totalEmis ? String(loan.totalEmis) : "",
  );
  const [emiDay, setEmiDay] = useState(String(loan?.emiDay ?? 5));
  const [billDay, setBillDay] = useState(String(loan?.billDay ?? 12));
  // Editing: start from what's owed today, not the last saved figure.
  const owedToday = loan ? loanView(loan, today).state.balance : null;
  const [owed, setOwed] = useState<number | null>(owedToday);
  const [fee, setFee] = useState(
    loan?.foreclosurePct != null ? String(loan.foreclosurePct) : "",
  );
  const [gst, setGst] = useState(loan?.foreclosureGst ?? true);
  const isCard = type === "card";

  return (
    <Sheet title={loan ? "Edit loan" : "Add a loan"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveLoan({
              id: loan?.id,
              name,
              type,
              cardId: isCard ? cardId || null : null,
              principal,
              takenOn: takenOn || null,
              ratePct: Number(rate) || 0,
              emi,
              totalEmis: totalEmis ? Number(totalEmis) : null,
              emiDay: Number(emiDay),
              billDay: isCard ? Number(billDay) : null,
              outstanding: owed ?? 0,
              asOf: today,
              foreclosurePct: fee === "" ? null : Number(fee),
              foreclosureGst: gst,
            }),
          );
        }}
      >
        <Field
          label="Name"
          htmlFor="ln-name"
          hint="What you call it, like the lender. Never the loan number."
        >
          <Input
            id="ln-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
        </Field>
        <Field label="Type" htmlFor="ln-type">
          <Select
            id="ln-type"
            value={type}
            onChange={(e) => setType(e.target.value as LoanType)}
          >
            {LOAN_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        {isCard && (
          <>
            {cards.length ? (
              <Field label="Card" htmlFor="ln-card">
                <Select
                  id="ln-card"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="rounded-lg bg-muted p-2.5 text-sm">
                Add the card first, under Cards below.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bill generated on" htmlFor="ln-bill">
                <Select
                  id="ln-bill"
                  value={billDay}
                  onChange={(e) => setBillDay(e.target.value)}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {ordinal(i + 1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment due on" htmlFor="ln-due">
                <Select
                  id="ln-due"
                  value={emiDay}
                  onChange={(e) => setEmiDay(e.target.value)}
                >
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {ordinal(i + 1)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount withdrawn" htmlFor="ln-principal">
            <MoneyInput
              id="ln-principal"
              value={principal}
              onChange={setPrincipal}
            />
          </Field>
          <Field label="Taken on" htmlFor="ln-taken">
            <Input
              id="ln-taken"
              type="date"
              value={takenOn}
              onChange={(e) => setTakenOn(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="EMI" htmlFor="ln-emi">
            <MoneyInput id="ln-emi" value={emi} onChange={setEmi} required />
          </Field>
          <Field label="Interest, % a year" htmlFor="ln-rate">
            <Input
              id="ln-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total EMIs" htmlFor="ln-total" hint="Optional, e.g. 36">
            <Input
              id="ln-total"
              inputMode="numeric"
              value={totalEmis}
              onChange={(e) => setTotalEmis(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          {!isCard && (
            <Field label="EMI date" htmlFor="ln-day">
              <Select
                id="ln-day"
                value={emiDay}
                onChange={(e) => setEmiDay(e.target.value)}
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {ordinal(i + 1)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <Field
          label="Owed now"
          htmlFor="ln-owed"
          hint="From your latest statement or the lender's app. It goes down as you mark EMIs paid."
        >
          <MoneyInput id="ln-owed" value={owed} onChange={setOwed} required />
        </Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Foreclosure charge, %" htmlFor="ln-fee" hint="Optional">
            <Input
              id="ln-fee"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </Field>
          <label className="flex items-start gap-2 pb-6 text-sm">
            <Checkbox
              checked={gst}
              onChange={(e) => setGst(e.target.checked)}
            />
            Plus 18% GST
          </label>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : loan ? "Save loan" : "Add loan"}
        </Button>
      </form>
    </Sheet>
  );
}

/** Loans: totals, then each loan with its next EMI and progress. */
export function LoanList({
  loans,
  cards,
  today,
}: {
  loans: Loan[];
  cards: CardRef[];
  today: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Loan | "new" | null>(null);
  const close = useCallback(() => setSheet(null), []);
  const views = loans
    .map((l) => loanView(l, today))
    .sort(
      (a, b) =>
        Number(a.closed) - Number(b.closed) ||
        (a.next?.date ?? "9999").localeCompare(b.next?.date ?? "9999"),
    );
  const t = loanTotals(views);

  return (
    <section aria-labelledby="loans-h" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="loans-h" className="text-lg font-semibold">
          Loans
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSheet("new")}
        >
          <Plus /> Add a loan
        </Button>
      </div>
      {views.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          Track a home, personal, car or credit card loan: what&apos;s left, the
          next EMI, and when you&apos;ll be done.
        </p>
      ) : (
        <>
          {t.owed > 0 && (
            <p className="tabular text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatINRCompact(t.owed)}
              </span>{" "}
              owed · {formatINR(t.monthlyEmi)} a month in EMIs
              {t.debtFree && !t.openEnded
                ? ` · debt-free by ${monthYear(t.debtFree)}`
                : ""}
            </p>
          )}
          <ul className="space-y-3">
            {views.map((v) => {
              const isOpen = open === v.loan.id;
              const card = cards.find((c) => c.id === v.loan.cardId);
              return (
                <li
                  key={v.loan.id}
                  className={cn(
                    "rounded-2xl border bg-card",
                    isOpen && "border-primary",
                  )}
                >
                  <div className="relative flex items-start gap-3 p-4">
                    <span
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <Landmark className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : v.loan.id)}
                        className="block text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
                      >
                        <span className="block break-words font-semibold leading-snug">
                          {v.loan.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {loanTypeLabel(v.loan.type)}
                          {card ? ` · ${card.label}` : ""}
                        </span>
                      </button>
                      {v.closed ? (
                        <p className="text-sm font-medium text-success">
                          Paid off
                        </p>
                      ) : (
                        <NextEmi v={v} />
                      )}
                      <Progress
                        value={v.progress * 100}
                        tone="neutral"
                        label={`${v.loan.name} repaid`}
                        className="h-1.5"
                      />
                      <p className="tabular flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {v.repaid !== null && v.loan.principal
                            ? `${formatINRCompact(v.repaid)} of ${formatINRCompact(v.loan.principal)} repaid`
                            : `${formatINRCompact(v.state.balance)} owed`}
                        </span>
                        {v.emisLine && (
                          <span className="shrink-0">{v.emisLine}</span>
                        )}
                      </p>
                      {v.state.endDate && !v.closed && (
                        <p className="text-xs text-muted-foreground">
                          Ends {monthYear(v.state.endDate)}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </div>
                  {isOpen && (
                    <LoanDetails
                      v={v}
                      cards={cards}
                      onEdit={() => setSheet(v.loan)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {sheet && (
        <LoanSheet
          loan={sheet === "new" ? null : sheet}
          cards={cards}
          today={today}
          onClose={close}
        />
      )}
    </section>
  );
}
