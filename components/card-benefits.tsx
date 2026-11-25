"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plane, Sparkles } from "lucide-react";
import { type Card, PERIOD_LABELS } from "@/lib/cards";
import {
  benefitsCurrent,
  PAYMENT_CHANNELS,
  rewardLabel,
  rewardValueLabel,
  compareCardRewards,
  loungeAllowance,
} from "@/lib/card-benefits";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import { logLoungeVisit, deleteLoungeVisit } from "@/lib/cards-actions";
import { formatINR, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/sheet";
import { MoneyInput } from "@/components/money-input";
import { Field } from "@/components/forms/field";
import { CardSetupSheet } from "@/components/card-setup";
import { CardFeaturesSheet } from "@/components/card-features";
import { cn } from "@/lib/utils";

function LoungeLog({
  card,
  ruleId,
  today,
  onClose,
}: {
  card: Card;
  ruleId: string;
  today: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [visits, setVisits] = useState("1");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    close = false,
  ) =>
    start(async () => {
      setError("");
      try {
        const res = await action();
        if (!res.ok) {
          setError(res.error ?? "Couldn't update visits.");
          return;
        }
        router.refresh();
        if (close) onClose();
      } catch {
        setError("Couldn't update visits. Try again.");
      }
    });
  const logs = (card.loungeVisits ?? []).filter((v) => v.ruleId === ruleId);
  return (
    <Sheet title="Lounge visits" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Log only visits you actually used. This does not check bank
          eligibility.
        </p>
        <fieldset disabled={pending} className="space-y-3">
          <Field label="Visit date">
            <Input
              type="date"
              aria-label="Lounge visit date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Visits used from this allowance">
            <Input
              type="number"
              aria-label="Lounge visits used"
              min="1"
              max="99"
              value={visits}
              onChange={(e) => setVisits(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            className="w-full"
            disabled={pending || !date || !Number(visits)}
            onClick={() =>
              run(
                () =>
                  logLoungeVisit({
                    cardId: card.id,
                    ruleId,
                    date,
                    visits: Number(visits),
                  }),
                true,
              )
            }
          >
            {pending ? "Saving…" : "Log visit"}
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {logs.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold">Your visit log</h3>
            <ul className="divide-y">
              {logs.map((v) => (
                <li
                  key={v.id}
                  className="flex min-h-11 items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {formatDate(v.date)} · {v.visits} visit
                    {v.visits === 1 ? "" : "s"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => deleteLoungeVisit(v.id))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}
export function CardBenefitsHub({
  cards,
  today,
}: {
  cards: Card[];
  today: string;
}) {
  const [tab, setTab] = useState<"spend" | "lounges">("spend");
  const [category, setCategory] = useState<SpendCategory>("online"),
    [amount, setAmount] = useState<number | null>(1000);
  const [merchant, setMerchant] = useState("");
  const [channel, setChannel] =
    useState<keyof typeof PAYMENT_CHANNELS>("online");
  const [manage, setManage] = useState(false),
    [edit, setEdit] = useState<Card | null>(null),
    [read, setRead] = useState<Card | null>(null);
  const [log, setLog] = useState<{ cardId: string; ruleId: string } | null>(
    null,
  );
  const matches = compareCardRewards(cards, category, amount ?? 0, today, {
    merchant: merchant.trim(),
    channel,
  });
  const ranked = matches.filter(
      (m, i) => matches.findIndex((x) => x.cardId === m.cardId) === i,
    ),
    top = ranked[0];
  const loungeCards = cards.filter((c) => c.featureDetails?.lounges.length);
  const logCard = log ? cards.find((c) => c.id === log.cardId) : null;
  if (!cards.length) return null;
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-card"
      aria-label="Card benefits"
    >
      <div className="flex border-b p-1">
        {(
          [
            ["spend", "Which card?", Sparkles],
            ["lounges", "Lounges", Plane],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm",
              tab === key
                ? "bg-primary-soft font-semibold text-primary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {tab === "spend" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Spending on">
                <Select
                  aria-label="Spending category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SpendCategory)}
                >
                  {Object.entries(SPEND_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount">
                <MoneyInput
                  aria-label="Card spending amount"
                  value={amount}
                  onChange={setAmount}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Store / app">
                <Input
                  aria-label="Store or app"
                  placeholder="e.g. Amazon"
                  value={merchant}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMerchant(v);
                    if (/^phonepe$/i.test(v.trim())) setChannel("phonepe");
                    else if (/^amazon\s*pay$/i.test(v.trim()))
                      setChannel("amazon_pay");
                  }}
                  maxLength={80}
                />
              </Field>
              <Field label="Paid using">
                <Select
                  aria-label="Payment method"
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as keyof typeof PAYMENT_CHANNELS)
                  }
                >
                  {Object.entries(PAYMENT_CHANNELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {top && !!amount ? (
              <>
                <div className="rounded-xl bg-primary-soft p-4">
                  <p className="text-xs text-primary">
                    Suggested for this purchase
                  </p>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{top.label}</h2>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-semibold">
                        {formatINR(top.upperReward)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        up to, before redemption fees
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{rewardLabel(top.rule)}</p>
                  {top.rule.points && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rewardValueLabel(top.rule)}
                    </p>
                  )}
                </div>
                {ranked.length > 1 && (
                  <ul className="divide-y" aria-label="Other card estimates">
                    {ranked.slice(1).map((m) => (
                      <li
                        key={m.cardId}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span>{m.label}</span>
                        <span className="shrink-0 font-medium">
                          Up to {formatINR(m.upperReward)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <details className="text-xs text-muted-foreground">
                  <summary className="min-h-11 cursor-pointer py-3 text-primary">
                    Limits & conditions
                  </summary>
                  <p className="whitespace-pre-wrap">
                    {top.rule.conditions ||
                      "Check issuer eligibility and exclusions."}
                  </p>
                  {top.rule.cap !== null && (
                    <p className="mt-2">
                      Cash-value cap: {formatINR(top.rule.cap)}
                      {top.rule.capPeriod
                        ? ` · ${PERIOD_LABELS[top.rule.capPeriod]}`
                        : ""}
                    </p>
                  )}
                  {top.rule.points?.cap != null && (
                    <p className="mt-2">
                      Points cap: {top.rule.points.cap.toLocaleString("en-IN")}
                      {top.rule.capPeriod
                        ? ` · ${PERIOD_LABELS[top.rule.capPeriod]}`
                        : ""}
                    </p>
                  )}
                  <p className="mt-2">
                    Caps assume no prior usage. Rates do not stack. Merchant
                    eligibility and redemption conditions still apply.
                  </p>
                </details>
              </>
            ) : (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                {!amount
                  ? "Enter a purchase amount."
                  : "No matching reward rate yet. Try the store and payment method, or edit your card benefits."}
              </p>
            )}
          </>
        ) : (
          <>
            {!loungeCards.length && (
              <p className="text-sm text-muted-foreground">
                Add your lounge allowance in Edit benefits.
              </p>
            )}
            {loungeCards.map((card) => (
              <section key={card.id} className="space-y-2">
                <h3 className="text-sm font-semibold">{card.label}</h3>
                {card.featureDetails!.lounges.map((rule) => {
                  const a = loungeAllowance(card, rule, today),
                    current = benefitsCurrent(card.featureDetails!, today);
                  return (
                    <div key={rule.id} className="rounded-xl bg-muted p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {rule.name}
                          </p>
                          <p className="mt-1 font-semibold">
                            {!current
                              ? "Terms need review"
                              : a.conditional
                                ? "Lounge or voucher choice"
                                : a.annualUnverified
                                  ? `${a.periodRemaining} this quarter`
                                  : a.remaining === null
                                    ? "Set card year first"
                                    : `${a.remaining} of ${rule.visits} left`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {PERIOD_LABELS[rule.period]} · based on your log
                          </p>
                          {rule.annualLimit && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Max {rule.annualLimit.visits} a year
                              {rule.annualLimit.period === "unknown"
                                ? "; year reset not confirmed"
                                : ""}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 shrink-0"
                          onClick={() =>
                            setLog({ cardId: card.id, ruleId: rule.id })
                          }
                        >
                          Visit log
                        </Button>
                      </div>
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="min-h-11 cursor-pointer py-3 text-primary">
                          Access conditions
                        </summary>
                        <p>
                          {rule.conditions ||
                            "Confirm eligibility with the issuer."}
                        </p>
                      </details>
                    </div>
                  );
                })}
              </section>
            ))}
            <p className="text-xs text-muted-foreground">
              A remaining allowance does not confirm entry eligibility.
            </p>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4">
        <Link
          href="/ask?topic=cards"
          className="inline-flex min-h-11 items-center text-sm text-primary"
        >
          Ask about my cards
        </Link>
        <button
          type="button"
          onClick={() => setManage(true)}
          className="min-h-11 text-sm text-primary"
        >
          Edit benefits
        </button>
      </div>
      {manage && (
        <Sheet title="Your card benefits" onClose={() => setManage(false)}>
          <ul className="divide-y">
            {cards.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="min-h-14 w-full py-3 text-left"
                  onClick={() => {
                    setManage(false);
                    setEdit(card);
                  }}
                >
                  <span className="block font-semibold">{card.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {card.featureDetails?.rewardRules.length
                      ? `${card.featureDetails.rewardRules.length} reward rates · tap to edit`
                      : "Add rewards, lounges and milestones"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
      {edit && (
        <CardSetupSheet
          initialStep={1}
          card={edit}
          onSaved={() => {}}
          onClose={() => setEdit(null)}
          onRead={() => {
            setRead(edit);
            setEdit(null);
          }}
        />
      )}
      {read && <CardFeaturesSheet card={read} onClose={() => setRead(null)} />}
      {log && logCard && (
        <LoungeLog
          card={logCard}
          ruleId={log.ruleId}
          today={today}
          onClose={() => setLog(null)}
        />
      )}
    </section>
  );
}
