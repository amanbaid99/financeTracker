"use client";

import {
  Check,
  ChevronDown,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  Receipt,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { CardAdvisor } from "@/components/card-advisor";
import { CardFeaturesSheet } from "@/components/card-features";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  averageBill,
  headlineMilestone,
  nextUnpaid,
  milestoneState,
  PERIOD_LABELS,
  periodBounds,
  type Bill,
  type Card,
  type MilestoneState,
  type Period,
} from "@/lib/cards";
import {
  deleteBill,
  deleteCard,
  deleteMilestone,
  saveBill,
  saveCard,
  saveMilestone,
  setBillPaid,
  updateMilestoneSpend,
} from "@/lib/cards-actions";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIOD_WORD: Record<Period, string> = {
  card_year: "card year",
  calendar_year: "year",
  quarter: "quarter",
  month: "month",
  once: "period",
};

function useRun(onDone?: (id?: string) => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; id?: string }>,
  ) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong");
      router.refresh();
      onDone?.(res.id);
    });
  const errorText = error && (
    <p
      role="alert"
      className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
    >
      {error}
    </p>
  );
  return { pending, run, errorText };
}

function statusLine(s: MilestoneState): { text: string; tone: string } {
  if (s.stale)
    return {
      text: `New ${PERIOD_WORD[s.period]}: update your spend`,
      tone: "text-warning",
    };
  const what = s.reward || s.name;
  switch (s.status) {
    case "achieved":
      return { text: `${what}: reached`, tone: "text-success" };
    case "missed":
      return { text: `${what}: missed`, tone: "text-danger" };
    case "behind":
      return {
        text: `${formatINRCompact(s.remaining)} to go for ${what}, behind pace`,
        tone: "text-warning",
      };
    default:
      return {
        text: `${formatINRCompact(s.remaining)} to go for ${what}${s.daysLeft !== null ? ` · ${s.daysLeft} days left` : ""}`,
        tone: "text-success",
      };
  }
}

function MilestoneRow({
  s,
  onEdit,
}: {
  s: MilestoneState;
  onEdit: () => void;
}) {
  const [spent, setSpent] = useState<number | null>(s.spentNow);
  const { pending, run, errorText } = useRun();
  const dirty = (spent ?? 0) !== s.spentNow || s.stale;
  const tone =
    s.status === "achieved"
      ? "success"
      : s.status === "behind" || s.stale
        ? "warning"
        : s.status === "missed"
          ? "danger"
          : "primary";
  let pace = "";
  if (s.status === "achieved") pace = "Reached";
  else if (s.status === "missed") pace = "The date has passed";
  else if (s.neededPerMonth !== null)
    pace = `About ${formatINR(s.neededPerMonth)} a month to make it`;

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{s.name}</p>
          <p className="text-xs text-muted-foreground">
            {s.reward ? `${s.reward} · ` : ""}
            {s.period === "once"
              ? `by ${formatDate(s.end)}`
              : `${PERIOD_LABELS[s.period].toLowerCase()}, ends ${formatDate(s.end)}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Edit milestone ${s.name}`}
          onClick={onEdit}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      </div>
      <Progress
        value={s.progress * 100}
        tone={tone}
        label={`${s.name} progress`}
      />
      <p className="tabular text-xs text-muted-foreground">
        {formatINR(s.spentNow)} of {formatINR(s.target)}
        {s.remaining > 0 ? ` · ${formatINR(s.remaining)} to go` : ""}
        {pace ? ` · ${pace}` : ""}
      </p>
      {s.stale && (
        <p className="rounded-lg bg-warning-soft p-2 text-xs text-warning">
          A new {PERIOD_WORD[s.period]} started on {formatDate(s.start)}. Enter
          what you&apos;ve spent since then.
        </p>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateMilestoneSpend({ id: s.id, spent: spent ?? 0 }));
        }}
      >
        <MoneyInput
          className="flex-1"
          aria-label={`${s.name}: spent so far`}
          value={spent}
          onChange={setSpent}
          placeholder="Spent so far"
        />
        <Button
          type="submit"
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={pending || !dirty}
        >
          {pending ? "Saving…" : "Update"}
        </Button>
      </form>
      {errorText}
    </li>
  );
}

function CardSheet({
  card,
  onClose,
  onSaved,
}: {
  card: Card | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const [label, setLabel] = useState(card?.label ?? "");
  const [fee, setFee] = useState<number | null>(card?.annualFee ?? null);
  const [yearStart, setYearStart] = useState(card?.yearStart ?? "");
  const [rewards, setRewards] = useState(card?.rewards ?? "");
  const [benefits, setBenefits] = useState((card?.benefits ?? []).join("\n"));
  const [bestFor, setBestFor] = useState<SpendCategory[]>(
    (card?.bestFor ?? []) as SpendCategory[],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useRun((id) => {
    onSaved(id);
    onClose();
  });

  return (
    <Sheet title={card ? "Edit card" : "Add a card"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveCard({
              id: card?.id ?? null,
              label,
              annualFee: fee,
              yearStart: yearStart || null,
              rewards: rewards.trim() || null,
              benefits: benefits
                .split("\n")
                .map((b) => b.trim())
                .filter(Boolean),
              bestFor,
            }),
          );
        }}
      >
        <Field
          label="Card name"
          htmlFor="c-label"
          hint="Never enter the card number."
        >
          <Input
            id="c-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            placeholder="e.g. HDFC Regalia Gold"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Annual fee" htmlFor="c-fee">
            <MoneyInput
              id="c-fee"
              value={fee}
              onChange={setFee}
              placeholder="0"
            />
          </Field>
          <Field label="Card year starts" htmlFor="c-year">
            <Input
              id="c-year"
              type="date"
              value={yearStart}
              onChange={(e) => setYearStart(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Rewards (optional)" htmlFor="c-rewards">
          <Input
            id="c-rewards"
            value={rewards}
            onChange={(e) => setRewards(e.target.value)}
            maxLength={200}
            placeholder="e.g. 4 points per ₹150, 1 point = ₹0.50"
          />
        </Field>
        <Field label="Benefits, one per line" htmlFor="c-benefits">
          <textarea
            id="c-benefits"
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={4}
            placeholder={
              "4 lounge visits a quarter\n5% cashback on travel\nFuel surcharge waiver"
            }
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
          />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Best for</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SPEND_CATEGORIES) as SpendCategory[]).map((c) => {
              const on = bestFor.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setBestFor((s) =>
                      on ? s.filter((x) => x !== c) : [...s, c],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {SPEND_CATEGORIES[c]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Used to suggest which card to use.
          </p>
        </fieldset>
        {errorText}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : card ? "Save card" : "Add card"}
        </Button>
        {card && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              confirmDelete
                ? run(() => deleteCard(card.id))
                : setConfirmDelete(true)
            }
          >
            {confirmDelete ? "Tap again to delete this card" : "Delete card"}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

const PRESETS = [
  {
    name: "Annual fee waiver",
    period: "card_year" as Period,
    reward: "Annual fee waived",
  },
  { name: "Milestone bonus", period: "card_year" as Period, reward: "" },
  {
    name: "Quarterly lounge unlock",
    period: "quarter" as Period,
    reward: "Lounge access next quarter",
  },
  { name: "Welcome bonus", period: "once" as Period, reward: "" },
];

function MilestoneSheet({
  cardId,
  milestone,
  onClose,
}: {
  cardId: string;
  milestone: MilestoneState | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(milestone?.name ?? "");
  const [target, setTarget] = useState<number | null>(
    milestone?.target ?? null,
  );
  const [period, setPeriod] = useState<Period>(
    milestone?.period ?? "card_year",
  );
  const [deadline, setDeadline] = useState(milestone?.deadline ?? "");
  const [reward, setReward] = useState(milestone?.reward ?? "");
  const [spent, setSpent] = useState<number | null>(
    milestone?.spentNow ?? null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useRun(onClose);

  return (
    <Sheet
      title={milestone ? "Edit milestone" : "Add a milestone"}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveMilestone({
              id: milestone?.id ?? null,
              cardId,
              name,
              target: target ?? 0,
              period,
              deadline: period === "once" ? deadline || null : null,
              reward: reward.trim() || null,
              spent: spent ?? 0,
            }),
          );
        }}
      >
        {!milestone && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setName(p.name);
                  setPeriod(p.period);
                  if (p.reward) setReward(p.reward);
                }}
                className="rounded-full border px-3 py-1 text-xs hover:border-primary hover:bg-primary-soft"
              >
                + {p.name}
              </button>
            ))}
          </div>
        )}
        <Field label="Milestone" htmlFor="m-name">
          <Input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Spend target" htmlFor="m-target">
            <MoneyInput
              id="m-target"
              value={target}
              onChange={setTarget}
              placeholder="e.g. 4,00,000"
              required
            />
          </Field>
          <Field label="Resets" htmlFor="m-period">
            <Select
              id="m-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {period === "once" && (
          <Field label="Spend it by" htmlFor="m-deadline">
            <Input
              id="m-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </Field>
        )}
        <Field label="What you get (optional)" htmlFor="m-reward">
          <Input
            id="m-reward"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            maxLength={120}
            placeholder="e.g. 10,000 bonus points"
          />
        </Field>
        <Field label="Spent so far this period" htmlFor="m-spent">
          <MoneyInput
            id="m-spent"
            value={spent}
            onChange={setSpent}
            placeholder="0"
          />
        </Field>
        {errorText}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : milestone ? "Save milestone" : "Add milestone"}
        </Button>
        {milestone && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              confirmDelete
                ? run(() => deleteMilestone(milestone.id))
                : setConfirmDelete(true)
            }
          >
            {confirmDelete ? "Tap again to delete" : "Delete milestone"}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const monthLabel = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function BillSheet({
  cardId,
  bill,
  today,
  onClose,
}: {
  cardId: string;
  bill: Bill | null;
  today: string;
  onClose: () => void;
}) {
  const [month, setMonth] = useState((bill?.month ?? today).slice(0, 7));
  const [amount, setAmount] = useState<number | null>(bill?.amount ?? null);
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? "");
  const [paid, setPaid] = useState(bill?.paid ?? false);
  const [note, setNote] = useState(bill?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useRun(onClose);

  return (
    <Sheet title={bill ? "Edit bill" : "Log a bill"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveBill({
              id: bill?.id ?? null,
              cardId,
              month,
              amount: amount ?? 0,
              dueDate: dueDate || null,
              paid,
              note: note.trim() || null,
            }),
          );
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Statement month" htmlFor="b-month">
            <Input
              id="b-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </Field>
          <Field label="Bill amount" htmlFor="b-amount">
            <MoneyInput
              id="b-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0"
              required
            />
          </Field>
        </div>
        <Field label="Due date (optional)" htmlFor="b-due">
          <Input
            id="b-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="b-note">
          <Input
            id="b-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="e.g. Flights for Goa"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          Already paid
        </label>
        {errorText}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : bill ? "Save bill" : "Log bill"}
        </Button>
        {bill && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="w-full"
            disabled={pending}
            onClick={() =>
              confirmDelete
                ? run(() => deleteBill(bill.id))
                : setConfirmDelete(true)
            }
          >
            {confirmDelete ? "Tap again to delete" : "Delete bill"}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

function BillRow({
  bill,
  today,
  onEdit,
}: {
  bill: Bill;
  today: string;
  onEdit: () => void;
}) {
  const { pending, run, errorText } = useRun();
  const overdue = !bill.paid && bill.dueDate !== null && bill.dueDate < today;
  const name = monthLabel(bill.month);
  return (
    <li className="space-y-1 py-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name} bill`}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{name}</span>
            <span className="tabular font-medium">
              {formatINR(bill.amount)}
            </span>
          </p>
          <p
            className={cn(
              "truncate text-xs",
              overdue ? "text-danger" : "text-muted-foreground",
            )}
          >
            {bill.dueDate
              ? `${overdue ? "Overdue, was due" : "Due"} ${formatDate(bill.dueDate)}`
              : "No due date"}
            {bill.note ? ` · ${bill.note}` : ""}
          </p>
        </button>
        <Button
          type="button"
          size="sm"
          variant={bill.paid ? "secondary" : "outline"}
          disabled={pending}
          aria-pressed={bill.paid}
          aria-label={`${name} bill ${bill.paid ? "paid" : "not paid"}`}
          onClick={() =>
            run(() => setBillPaid({ id: bill.id, paid: !bill.paid }))
          }
          className={cn("w-20", bill.paid && "text-success")}
        >
          {bill.paid ? (
            <>
              <Check /> Paid
            </>
          ) : (
            "Mark paid"
          )}
        </Button>
      </div>
      {errorText}
    </li>
  );
}

function BillsSection({
  card,
  today,
  onLog,
  onEdit,
}: {
  card: Card;
  today: string;
  onLog: () => void;
  onEdit: (b: Bill) => void;
}) {
  const [all, setAll] = useState(false);
  const avg = averageBill(card.bills);
  const shown = all ? card.bills : card.bills.slice(0, 6);
  return (
    <section className="space-y-1" aria-label={`${card.label} bills`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Monthly bills</h3>
        {avg !== null && (
          <span className="text-xs text-muted-foreground">
            Avg {formatINR(avg)} a month
          </span>
        )}
      </div>
      {card.bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Log each month&apos;s statement to see what you spend on this card.
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map((b) => (
            <BillRow
              key={`${b.id}-${b.paid}`}
              bill={b}
              today={today}
              onEdit={() => onEdit(b)}
            />
          ))}
        </ul>
      )}
      {card.bills.length > 6 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${card.bills.length} bills`}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onLog}
      >
        <Receipt /> Log bill
      </Button>
    </section>
  );
}

type SheetState =
  | { kind: "card"; card: Card | null }
  | { kind: "milestone"; cardId: string; milestone: MilestoneState | null }
  | { kind: "bill"; cardId: string; bill: Bill | null }
  | { kind: "features"; card: Card | null }
  | null;

export function CardList({ cards, today }: { cards: Card[]; today: string }) {
  const [open, setOpen] = useState<string | null>(
    cards.length === 1 ? cards[0].id : null,
  );
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = useCallback(() => setSheet(null), []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => setSheet({ kind: "card", card: null })}
        >
          <Plus /> Add a card
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setSheet({ kind: "features", card: null })}
        >
          <FileText /> From features
        </Button>
      </div>

      {cards.length > 0 && <CardAdvisor cards={cards} today={today} />}

      {cards.length === 0 ? (
        <div className="space-y-2 rounded-2xl border bg-card p-6 text-center">
          <CreditCard className="mx-auto size-8 text-primary" aria-hidden />
          <p className="font-semibold">
            Track your cards&apos; benefits and milestones
          </p>
          <p className="text-sm text-muted-foreground">
            Add a card, list what it gives you, and track spend milestones like
            fee waivers and bonus points.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => {
            const states = c.milestones.map((m) =>
              milestoneState(m, today, c.yearStart),
            );
            const head = headlineMilestone(states);
            const line = head
              ? statusLine(head)
              : {
                  text: "Add a milestone to track",
                  tone: "text-muted-foreground",
                };
            const due = nextUnpaid(c.bills);
            const isOpen = open === c.id;
            const year = c.yearStart
              ? periodBounds("card_year", today, c.yearStart, null)
              : null;
            return (
              <li
                key={c.id}
                className={cn(
                  "rounded-2xl border bg-card",
                  isOpen && "border-primary",
                )}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : c.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                    aria-hidden
                  >
                    <CreditCard className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{c.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.annualFee
                          ? `${formatINR(c.annualFee)} fee`
                          : "No annual fee"}
                      </span>
                    </div>
                    {head && (
                      <Progress
                        value={head.progress * 100}
                        tone={
                          line.tone === "text-warning"
                            ? "warning"
                            : line.tone === "text-danger"
                              ? "danger"
                              : "success"
                        }
                        label={`${c.label} milestone progress`}
                      />
                    )}
                    <p
                      className={cn("truncate text-xs font-medium", line.tone)}
                    >
                      {line.text}
                    </p>
                    {due && (
                      <p className="truncate text-xs text-muted-foreground">
                        Bill {formatINR(due.amount)}
                        {due.dueDate
                          ? ` due ${formatDate(due.dueDate)}`
                          : " unpaid"}
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
                </button>

                {isOpen && (
                  <div className="space-y-5 border-t px-4 pb-4 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <dl className="min-w-0 space-y-1 text-sm">
                        {year && (
                          <div>
                            <dt className="inline text-muted-foreground">
                              Card year:{" "}
                            </dt>
                            <dd className="inline">
                              {formatDate(year.start)} to {formatDate(year.end)}
                            </dd>
                          </div>
                        )}
                        {c.rewards && (
                          <div>
                            <dt className="inline text-muted-foreground">
                              Rewards:{" "}
                            </dt>
                            <dd className="inline">{c.rewards}</dd>
                          </div>
                        )}
                      </dl>
                      <div className="flex shrink-0 flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSheet({ kind: "card", card: c })}
                        >
                          <Pencil /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSheet({ kind: "features", card: c })
                          }
                        >
                          <FileText /> Read features
                        </Button>
                      </div>
                    </div>

                    <BillsSection
                      card={c}
                      today={today}
                      onLog={() =>
                        setSheet({ kind: "bill", cardId: c.id, bill: null })
                      }
                      onEdit={(b) =>
                        setSheet({ kind: "bill", cardId: c.id, bill: b })
                      }
                    />

                    {c.bestFor.length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5"
                        aria-label={`${c.label} is best for`}
                      >
                        {c.bestFor.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary"
                          >
                            {SPEND_CATEGORIES[b as SpendCategory] ?? b}
                          </span>
                        ))}
                      </div>
                    )}

                    {c.benefits.length > 0 && (
                      <section
                        className="space-y-1"
                        aria-label={`${c.label} benefits`}
                      >
                        <h3 className="text-sm font-semibold">Benefits</h3>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm">
                          {c.benefits.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section
                      className="space-y-1"
                      aria-label={`${c.label} milestones`}
                    >
                      <h3 className="text-sm font-semibold">Milestones</h3>
                      {states.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Add spend milestones like a fee waiver or bonus points
                          to track your progress.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {states.map((s) => (
                            <MilestoneRow
                              key={`${s.id}-${s.spent}-${s.spentAsOf}`}
                              s={s}
                              onEdit={() =>
                                setSheet({
                                  kind: "milestone",
                                  cardId: c.id,
                                  milestone: s,
                                })
                              }
                            />
                          ))}
                        </ul>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          setSheet({
                            kind: "milestone",
                            cardId: c.id,
                            milestone: null,
                          })
                        }
                      >
                        <Plus /> Add milestone
                      </Button>
                    </section>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sheet?.kind === "card" && (
        <CardSheet
          card={sheet.card}
          onClose={close}
          onSaved={(id) => id && setOpen(id)}
        />
      )}
      {sheet?.kind === "milestone" && (
        <MilestoneSheet
          cardId={sheet.cardId}
          milestone={sheet.milestone}
          onClose={close}
        />
      )}
      {sheet?.kind === "features" && (
        <CardFeaturesSheet card={sheet.card} onClose={close} />
      )}
      {sheet?.kind === "bill" && (
        <BillSheet
          cardId={sheet.cardId}
          bill={sheet.bill}
          today={today}
          onClose={close}
        />
      )}
    </div>
  );
}
