"use client";

import {
  Check,
  ChevronDown,
  Circle,
  CreditCard,
  FileText,
  Pencil,
  Plus,
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
  liveUnbilled,
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
  updateUnbilled,
} from "@/lib/cards-actions";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { clearParam } from "@/lib/clear-param";
import { useQuickAction } from "@/components/quick-add";
import { cn } from "@/lib/utils";

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

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const monthLabel = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const shortMonth = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];

function statusLine(s: MilestoneState): { text: string; tone: string } {
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
  noCardYear,
  onEdit,
}: {
  s: MilestoneState;
  noCardYear: boolean;
  onEdit: () => void;
}) {
  const tone =
    s.status === "achieved"
      ? "success"
      : s.status === "behind"
        ? "warning"
        : s.status === "missed"
          ? "danger"
          : "primary";
  let pace = "";
  if (s.status === "achieved") pace = "Reached";
  else if (s.status === "missed") pace = "The date has passed";
  else if (s.neededPerMonth !== null)
    pace = `about ${formatINR(s.neededPerMonth)} a month`;

  const sources: string[] = [];
  if (s.billCount > 0)
    sources.push(s.billCount === 1 ? `1 bill` : `${s.billCount} bills`);
  if (s.unbilledNow > 0)
    sources.push(`${formatINR(s.unbilledNow)} not billed yet`);

  return (
    <li className="space-y-1.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{s.reward || s.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatINR(s.spentNow)} of {formatINR(s.target)}
            {s.end ? ` by ${formatDate(s.end)}` : ""}
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
        {s.remaining > 0 ? `${formatINR(s.remaining)} to go` : ""}
        {s.remaining > 0 && pace ? " · " : ""}
        {pace}
      </p>
      <p className="text-xs text-muted-foreground">
        {sources.length
          ? `Counted from ${sources.join(" + ")}`
          : "No bills logged in this period yet"}
        {s.period === "card_year" && noCardYear
          ? ". Using Jan to Dec; set the card year in About this card."
          : ""}
      </p>
    </li>
  );
}

/** Spend since the last bill, once per card; counts toward every milestone. */
function UnbilledRow({ card }: { card: Card }) {
  const live = liveUnbilled(card);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<number | null>(live || null);
  const { pending, run, errorText } = useRun(() => setEditing(false));
  const latest = card.bills[0]?.month;
  const label = latest
    ? `Spent since your ${shortMonth(latest)} bill`
    : "Spent so far, not billed yet";

  if (!editing)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="text-muted-foreground">{label}: </span>
          <span className="tabular font-medium">{formatINR(live)}</span>
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${label}`}
        >
          {live ? "Change" : "Add"}
        </Button>
      </div>
    );
  return (
    <form
      className="space-y-2 rounded-lg bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateUnbilled({ cardId: card.id, amount: amount ?? 0 }));
      }}
    >
      <p className="text-xs text-muted-foreground">
        Counts toward this card&apos;s milestones until you log the next bill.
      </p>
      <div className="flex items-end gap-2">
        <MoneyInput
          className="flex-1"
          aria-label={label}
          value={amount}
          onChange={setAmount}
          placeholder="0"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
      {errorText}
    </form>
  );
}

function CardSheet({
  card,
  onClose,
  onSaved,
  onFeatures,
}: {
  card: Card | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
  /** New cards only: switch to filling it in from a features PDF. */
  onFeatures?: () => void;
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
      {!card && onFeatures && (
        <button
          type="button"
          onClick={onFeatures}
          className="press mb-4 flex w-full items-center gap-3 rounded-xl bg-primary-soft p-3 text-left text-sm text-primary"
        >
          <FileText className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">
              Fill it in from its features
            </span>
            <span className="block text-xs">
              Upload the PDF or describe the card
            </span>
          </span>
        </button>
      )}
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
        <p className="text-xs text-muted-foreground">
          Progress is counted from the bills you log for this card.
        </p>
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

/** The month after the latest bill, or this month if that's in the future. */
function nextBillMonth(card: Card, today: string): string {
  const latest = card.bills[0]?.month;
  if (!latest) return today.slice(0, 7);
  const [y, m] = latest.split("-").map(Number);
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return next > today.slice(0, 7) ? today.slice(0, 7) : next;
}

function BillSheet({
  card,
  bill,
  today,
  onClose,
}: {
  card: Card;
  bill: Bill | null;
  today: string;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(
    bill ? bill.month.slice(0, 7) : nextBillMonth(card, today),
  );
  const [amount, setAmount] = useState<number | null>(bill?.amount ?? null);
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? "");
  // Bills for past months are usually paid already.
  const [paid, setPaid] = useState(bill?.paid ?? month < today.slice(0, 7));
  const [note, setNote] = useState(bill?.note ?? "");
  const [more, setMore] = useState(Boolean(bill?.dueDate || bill?.note));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { pending, run, errorText } = useRun(onClose);

  return (
    <Sheet
      title={bill ? "Edit bill" : `Log a ${card.label} bill`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            saveBill({
              id: bill?.id ?? null,
              cardId: card.id,
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
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          Paid
        </label>
        {more ? (
          <>
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
          </>
        ) : (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setMore(true)}
          >
            Add due date or note
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          The bill counts toward this card&apos;s milestones.
        </p>
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
  const sub = [
    bill.dueDate && !bill.paid
      ? `${overdue ? "Overdue, was due" : "Due"} ${formatDate(bill.dueDate)}`
      : "",
    bill.note ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name} bill`}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span>{name}</span>
            <span className="tabular font-medium">
              {formatINR(bill.amount)}
            </span>
          </p>
          {sub && (
            <p
              className={cn(
                "truncate text-xs",
                overdue ? "text-danger" : "text-muted-foreground",
              )}
            >
              {sub}
            </p>
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          aria-pressed={bill.paid}
          aria-label={`${name} bill ${bill.paid ? "paid" : "not paid"}`}
          title={bill.paid ? "Paid. Tap to mark unpaid." : "Tap to mark paid"}
          onClick={() =>
            run(() => setBillPaid({ id: bill.id, paid: !bill.paid }))
          }
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
            bill.paid
              ? "bg-success-soft text-success"
              : "border text-muted-foreground",
          )}
        >
          {bill.paid ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Circle className="size-3.5" aria-hidden />
          )}
          {bill.paid ? "Paid" : "Unpaid"}
        </button>
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
  const shown = all ? card.bills : card.bills.slice(0, 3);
  return (
    <section className="space-y-1" aria-label={`${card.label} bills`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          Bills
          {avg !== null && (
            <span className="font-normal text-muted-foreground">
              {" "}
              · avg {formatINR(avg)}/month
            </span>
          )}
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={onLog}>
          <Plus /> Log bill
        </Button>
      </div>
      {card.bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Log each statement and it counts toward your milestones.
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
      {card.bills.length > 3 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${card.bills.length} bills`}
        </Button>
      )}
    </section>
  );
}

function AboutCard({
  card,
  today,
  onEdit,
  onFeatures,
}: {
  card: Card;
  today: string;
  onEdit: () => void;
  onFeatures: () => void;
}) {
  const [open, setOpen] = useState(false);
  const year = card.yearStart
    ? periodBounds("card_year", today, card.yearStart, null)
    : null;
  return (
    <section aria-label={`About ${card.label}`} className="border-t pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-sm font-semibold"
      >
        About this card
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <dl className="space-y-1">
            <div>
              <dt className="inline text-muted-foreground">Annual fee: </dt>
              <dd className="inline">
                {card.annualFee ? formatINR(card.annualFee) : "None"}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Card year: </dt>
              <dd className="inline">
                {year
                  ? `${formatDate(year.start)} to ${formatDate(year.end)}`
                  : "Not set (Jan to Dec is used)"}
              </dd>
            </div>
            {card.rewards && (
              <div>
                <dt className="inline text-muted-foreground">Rewards: </dt>
                <dd className="inline">{card.rewards}</dd>
              </div>
            )}
          </dl>
          {card.bestFor.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5"
              aria-label={`${card.label} is best for`}
            >
              {card.bestFor.map((b) => (
                <span
                  key={b}
                  className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary"
                >
                  {SPEND_CATEGORIES[b as SpendCategory] ?? b}
                </span>
              ))}
            </div>
          )}
          {card.benefits.length > 0 && (
            <ul
              className="list-disc space-y-0.5 pl-5"
              aria-label={`${card.label} benefits`}
            >
              {card.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil /> Edit card
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onFeatures}
            >
              <FileText /> Read features
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

type SheetState =
  | { kind: "card"; card: Card | null }
  | { kind: "milestone"; cardId: string; milestone: MilestoneState | null }
  | { kind: "bill"; card: Card; bill: Bill | null }
  | { kind: "features"; card: Card | null }
  | { kind: "pick" }
  | null;

export function CardList({
  cards,
  today,
  initialOpen = null,
  action = null,
}: {
  cards: Card[];
  today: string;
  initialOpen?: string | null;
  /** From the + menu: "bill" logs a bill, "card" adds a card. */
  action?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(
    initialOpen ?? (cards.length === 1 ? cards[0].id : null),
  );
  const [sheet, setSheet] = useState<SheetState>(() => {
    if (action === "card" || (action === "bill" && cards.length === 0))
      return { kind: "card", card: null };
    if (action === "bill")
      return cards.length === 1
        ? { kind: "bill", card: cards[0], bill: null }
        : { kind: "pick" };
    return null;
  });
  const close = useCallback(() => {
    setSheet(null);
    clearParam("do");
  }, []);
  useQuickAction(
    "card",
    useCallback(() => setSheet({ kind: "card", card: null }), []),
  );
  useQuickAction(
    "bill",
    useCallback(
      () =>
        setSheet(
          cards.length === 0
            ? { kind: "card", card: null }
            : cards.length === 1
              ? { kind: "bill", card: cards[0], bill: null }
              : { kind: "pick" },
        ),
      [cards],
    ),
  );

  return (
    <div className="space-y-4">
      {cards.length === 0 ? (
        <div className="space-y-2 rounded-2xl border bg-card p-6 text-center">
          <CreditCard className="mx-auto size-8 text-primary" aria-hidden />
          <p className="font-semibold">
            Track your cards&apos; benefits and milestones
          </p>
          <p className="text-sm text-muted-foreground">
            Add a card, log its monthly bills, and see how close you are to fee
            waivers and bonus points.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2">
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
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => {
            const states = c.milestones.map((m) => milestoneState(m, today, c));
            const head = headlineMilestone(states);
            const line = head
              ? statusLine(head)
              : {
                  text: "Add a milestone to track",
                  tone: "text-muted-foreground",
                };
            const due = nextUnpaid(c.bills);
            const isOpen = open === c.id;
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
                  className="press flex w-full items-center gap-3 p-4 text-left"
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
                  <div className="expand-in space-y-4 border-t px-4 pb-4 pt-2">
                    <section aria-label={`${c.label} milestones`}>
                      {states.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          Add a milestone like a fee waiver or bonus points.
                          Your logged bills count toward it automatically.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {states.map((s) => (
                            <MilestoneRow
                              key={s.id}
                              s={s}
                              noCardYear={!c.yearStart}
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
                        variant="ghost"
                        size="sm"
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

                    {states.length > 0 && (
                      <UnbilledRow
                        key={`${c.unbilled}-${c.unbilledAsOf}-${c.bills[0]?.month}`}
                        card={c}
                      />
                    )}

                    <BillsSection
                      card={c}
                      today={today}
                      onLog={() =>
                        setSheet({ kind: "bill", card: c, bill: null })
                      }
                      onEdit={(b) =>
                        setSheet({ kind: "bill", card: c, bill: b })
                      }
                    />

                    <AboutCard
                      card={c}
                      today={today}
                      onEdit={() => setSheet({ kind: "card", card: c })}
                      onFeatures={() => setSheet({ kind: "features", card: c })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {cards.length > 0 && <CardAdvisor cards={cards} today={today} />}

      {sheet?.kind === "card" && (
        <CardSheet
          card={sheet.card}
          onClose={close}
          onSaved={(id) => id && setOpen(id)}
          onFeatures={() => setSheet({ kind: "features", card: null })}
        />
      )}
      {sheet?.kind === "milestone" && (
        <MilestoneSheet
          cardId={sheet.cardId}
          milestone={sheet.milestone}
          onClose={close}
        />
      )}
      {sheet?.kind === "pick" && (
        <Sheet title="Which card's bill?" onClose={close}>
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(c.id);
                    setSheet({ kind: "bill", card: c, bill: null });
                  }}
                  className="press flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:border-primary"
                >
                  <CreditCard className="size-5 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.bills[0]
                        ? `Last bill: ${monthLabel(c.bills[0].month)}`
                        : "No bills yet"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {sheet?.kind === "features" && (
        <CardFeaturesSheet card={sheet.card} onClose={close} />
      )}
      {sheet?.kind === "bill" && (
        <BillSheet
          card={sheet.card}
          bill={sheet.bill}
          today={today}
          onClose={close}
        />
      )}
    </div>
  );
}
