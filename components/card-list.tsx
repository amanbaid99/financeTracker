"use client";

import { ChevronDown, CreditCard, FileText, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { CardAdvisor } from "@/components/card-advisor";
import { CardFeaturesSheet } from "@/components/card-features";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  averageBill,
  cardsForReview,
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
} from "@/lib/cards-actions";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import { formatDate, formatINR } from "@/lib/format";
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
      try {
        const res = await fn();
        if (!res.ok) return setError(res.error ?? "Something went wrong");
        router.refresh();
        onDone?.(res.id);
      } catch {
        setError("Could not save. Check your connection and try again.");
      }
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

function MilestoneRow({
  s,
  noCardYear,
  emi = 0,
  onEdit,
}: {
  s: MilestoneState;
  noCardYear: boolean;
  /** Loan EMIs on the card, left out of each bill. */
  emi?: number;
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
          className="size-11"
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
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">
          How this is counted
        </summary>
        <p className="pb-2 text-xs text-muted-foreground">
          {sources.length
            ? `Counted from ${sources.join(" + ")}`
            : "No bills logged in this period yet"}
          {emi > 0 && s.billCount > 0
            ? `, leaving out ${formatINR(emi)} of loan EMI a bill`
            : ""}
          {s.period === "card_year" && noCardYear
            ? ". Using Jan to Dec; set the card year in About this card."
            : ""}
        </p>
      </details>
    </li>
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
                    "min-h-11 rounded-full border px-3 py-1 text-xs",
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
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>
          {pending ? "Saving…" : card ? "Save card" : "Add card"}
        </Button>
        {card && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="min-h-11 w-full"
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
                className="min-h-11 rounded-full border px-3 py-1 text-xs hover:border-primary hover:bg-primary-soft"
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
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>
          {pending ? "Saving…" : milestone ? "Save milestone" : "Add milestone"}
        </Button>
        {milestone && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="min-h-11 w-full"
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
  const [note, setNote] = useState(bill?.note ?? "");
  const [more, setMore] = useState(Boolean(bill?.note));
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
              // Statements are logged for milestones only, never as money
              // owed, so they're always stored as settled.
              dueDate: null,
              paid: true,
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
        {more ? (
          <>
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
            className="min-h-11"
            onClick={() => setMore(true)}
          >
            Add a note
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          The statement counts toward this card&apos;s milestones. It isn&apos;t
          tracked as money you owe.
        </p>
        {errorText}
        <Button type="submit" className="min-h-11 w-full" disabled={pending}>
          {pending ? "Saving…" : bill ? "Save bill" : "Log bill"}
        </Button>
        {bill && (
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "ghost"}
            size="sm"
            className="min-h-11 w-full"
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

function BillRow({ bill, onEdit }: { bill: Bill; onEdit: () => void }) {
  const name = monthLabel(bill.month);
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name} bill`}
        className="min-h-11 w-full py-2 text-left"
      >
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span>{name}</span>
          <span className="tabular font-medium">{formatINR(bill.amount)}</span>
        </p>
        {bill.note && (
          <p className="truncate text-xs text-muted-foreground">{bill.note}</p>
        )}
      </button>
    </li>
  );
}

function BillsSection({
  card,
  onLog,
  onEdit,
}: {
  card: Card;
  onLog: () => void;
  onEdit: (b: Bill) => void;
}) {
  const [all, setAll] = useState(false);
  const avg = averageBill(card.bills);
  const ordered = [...card.bills].sort((x, y) =>
    y.month.localeCompare(x.month),
  );
  const shown = all ? ordered : ordered.slice(0, 4);
  return (
    <section className="space-y-1" aria-label={`${card.label} bills`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Statements</h3>
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          variant="outline"
          onClick={onLog}
        >
          <Plus /> Log bill
        </Button>
      </div>
      {card.bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Log each statement and it counts toward your milestones.
        </p>
      ) : (
        <>
          {avg !== null && (
            <p className="text-xs text-muted-foreground">
              Average statement: {formatINR(avg)}/month
            </p>
          )}
          <ul className="divide-y">
            {shown.map((b) => (
              <BillRow key={b.id} bill={b} onEdit={() => onEdit(b)} />
            ))}
          </ul>
          {ordered.length > 4 && (
            <button
              type="button"
              className="min-h-11 text-sm font-medium text-primary"
              onClick={() => setAll(!all)}
            >
              {all ? "Show fewer" : `Show all ${ordered.length}`}
            </button>
          )}
        </>
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
        className="flex min-h-11 w-full items-center justify-between text-sm font-semibold"
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={onEdit}
            >
              <Pencil /> Edit card
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
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
  openCardId,
  onOpenChange,
  action = null,
}: {
  cards: Card[];
  today: string;
  initialOpen?: string | null;
  openCardId?: string | null;
  onOpenChange?: (id: string | null) => void;
  /** From the + menu: "bill" logs a bill, "card" adds a card. */
  action?: string | null;
}) {
  const [localOpen, setLocalOpen] = useState<string | null>(initialOpen);
  const open = openCardId === undefined ? localOpen : openCardId;
  const setOpen = onOpenChange ?? setLocalOpen;
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
      {cards.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {cards.length} {cards.length === 1 ? "card" : "cards"}. Log
            statements to track milestones.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => setSheet({ kind: "card", card: null })}
          >
            <Plus /> Add a card
          </Button>
        </div>
      )}
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
          {cardsForReview(cards, today).map((c) => {
            const states = c.milestones.map((m) => milestoneState(m, today, c));
            const latest = [...c.bills].sort((x, y) =>
              y.month.localeCompare(x.month),
            )[0];
            const isOpen = open === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "surface-card overflow-hidden rounded-2xl border border-border/70 bg-card",
                  isOpen && "border-primary",
                )}
              >
                {/* The whole header opens the card (the name's button covers it). */}
                <div className="relative p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <CreditCard className="size-5" />
                    </span>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : c.id)}
                      className="min-w-0 flex-1 break-words pt-1 text-left font-semibold leading-snug after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-primary"
                    >
                      {c.label}
                    </button>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {latest ? (
                      <>
                        {monthLabel(latest.month)} statement:{" "}
                        <span className="tabular font-medium text-foreground">
                          {formatINR(latest.amount)}
                        </span>
                      </>
                    ) : (
                      "No statements logged"
                    )}
                  </p>
                </div>

                {isOpen && (
                  <div className="expand-in space-y-4 border-t px-4 pb-4 pt-2">
                    <BillsSection
                      card={c}
                      onLog={() =>
                        setSheet({ kind: "bill", card: c, bill: null })
                      }
                      onEdit={(b) =>
                        setSheet({ kind: "bill", card: c, bill: b })
                      }
                    />

                    <section
                      aria-label={`${c.label} milestones`}
                      className="border-t pt-3"
                    >
                      <h3 className="text-sm font-semibold">Milestones</h3>
                      {states.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                          Add a milestone like a fee waiver or bonus points.
                          Your logged bills count toward it automatically.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {states
                            .filter(
                              (s) =>
                                s.status !== "achieved" &&
                                s.status !== "missed",
                            )
                            .map((s) => (
                              <MilestoneRow
                                key={s.id}
                                s={s}
                                noCardYear={!c.yearStart}
                                emi={c.emiPerBill}
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
                      {states.some(
                        (s) => s.status === "achieved" || s.status === "missed",
                      ) && (
                        <details className="border-t">
                          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                            Past and reached milestones
                          </summary>
                          <ul>
                            {states
                              .filter(
                                (s) =>
                                  s.status === "achieved" ||
                                  s.status === "missed",
                              )
                              .map((s) => (
                                <MilestoneRow
                                  key={s.id}
                                  s={s}
                                  noCardYear={!c.yearStart}
                                  emi={c.emiPerBill}
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
                        </details>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11 w-full"
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
