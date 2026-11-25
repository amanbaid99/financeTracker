"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plane, Sparkles } from "lucide-react";
import { type Card, PERIOD_LABELS } from "@/lib/cards";
import {
  benefitsCurrent,
  bestCardPerCategory,
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
  const [category, setCategory] = useState<SpendCategory>("online");
  const [amount, setAmount] = useState<number | null>(1000);
  const [edit, setEdit] = useState<Card | null>(null);
  const [read, setRead] = useState<Card | null>(null);
  const [log, setLog] = useState<{ cardId: string; ruleId: string } | null>(
    null,
  );
  const matches = compareCardRewards(cards, category, amount ?? 0, today);
  const top = matches[0];
  const loungeCards = cards.filter((c) => c.featureDetails?.lounges.length);
  const incomplete = cards.filter(
    (c) => !c.featureDetails || !benefitsCurrent(c.featureDetails, today),
  );
  const logCard = log ? cards.find((c) => c.id === log.cardId) : null;
  if (!cards.length) return null;
  return (
    <section
      className="rounded-2xl border bg-card p-4 sm:p-5"
      aria-label="Card benefits"
    >
      <div className="mb-4 flex gap-2 rounded-xl bg-muted p-1">
        {(
          [
            ["spend", "Which card?", Sparkles],
            ["lounges", "Lounges", Plane],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key as string}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key as typeof tab)}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm",
              tab === key
                ? "bg-card font-semibold shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label as string}
          </button>
        ))}
      </div>
      {tab === "spend" ? (
        <div className="space-y-3">
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
          {top && !!amount ? (
            <div className="rounded-xl bg-primary-soft p-4">
              <p className="text-xs text-muted-foreground">
                Suggested card for this spend
              </p>
              <p className="mt-1 font-semibold">{top.label}</p>
              <p className="mt-1 text-sm">
                Up to {formatINR(top.upperReward)} · {rewardLabel(top.rule)}
              </p>
              {top.rule.points && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {rewardValueLabel(top.rule)}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                {top.rule.conditions ||
                  "Check merchant eligibility and exclusions with your issuer."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Caps already used and merchant eligibility are not tracked.
                Point values apply to your chosen redemption.
              </p>
            </div>
          ) : (
            <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {amount
                ? "No comparable reward rate for this category yet. Add the rate, and a point value if needed, in Edit benefits."
                : "Enter a spending amount to compare."}
            </p>
          )}
          {matches.length > 1 && (
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer py-3 text-primary">
                Compare other cards
              </summary>
              <ul className="space-y-2">
                {matches.slice(1).map((m) => (
                  <li
                    key={`${m.cardId}-${m.rule.id}`}
                    className="rounded-lg bg-muted p-3"
                  >
                    <p className="font-medium">
                      {m.label} · {rewardLabel(m.rule)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.rule.conditions || "Check issuer conditions."}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {!loungeCards.length && (
            <p className="text-sm text-muted-foreground">
              Review your card&apos;s lounge allowance to start tracking visits.
            </p>
          )}
          {loungeCards.map((card) => (
            <div key={card.id} className="space-y-3">
              <h3 className="font-semibold">{card.label}</h3>
              {card.featureDetails!.lounges.map((rule) => {
                const a = loungeAllowance(card, rule, today);
                const current = benefitsCurrent(card.featureDetails!, today);
                return (
                  <div key={rule.id} className="rounded-xl bg-muted p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{rule.name}</p>
                        <p className="text-lg font-semibold">
                          {!current
                            ? "Terms expired"
                            : a.remaining === null
                              ? "Set card year first"
                              : `${a.remaining} of ${rule.visits} left`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {PERIOD_LABELS[rule.period]} · based on your log
                        </p>
                        {a.end && current && (
                          <p className="text-xs text-muted-foreground">
                            Period ends {formatDate(a.end)}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 shrink-0"
                        onClick={() =>
                          setLog({ cardId: card.id, ruleId: rule.id })
                        }
                      >
                        Visit log
                      </Button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                      {rule.conditions ||
                        "Check issuer eligibility, eligible lounges and guest charges before visiting."}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {tab === "spend" && (
        <details className="mt-3 border-t pt-1">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            Which card for each category?
          </summary>
          <p className="mb-2 text-xs text-muted-foreground">
            For a {formatINR(amount ?? 0)} purchase, using your saved rates and
            caps.
          </p>
          <ul className="divide-y">
            {bestCardPerCategory(cards, amount ?? 0, today).map(
              ({ category: cat, best }) => (
                <li key={cat}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left text-sm"
                    onClick={() => setCategory(cat)}
                  >
                    <span>{SPEND_CATEGORIES[cat]}</span>
                    <span className="max-w-[60%] text-right">
                      <span className="block font-medium">
                        {best?.label ?? "Add reward details"}
                      </span>
                      {best && (
                        <span className="text-xs text-muted-foreground">
                          Up to {formatINR(best.upperReward)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </details>
      )}
      <Link
        href="/ask?topic=cards"
        className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline decoration-dotted underline-offset-4"
      >
        Ask about my cards
      </Link>
      <details className="mt-3 border-t pt-1">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          Your card terms
          {incomplete.length ? ` · ${incomplete.length} to review` : ""}
        </summary>
        <ul className="divide-y">
          {cards.map((card) => (
            <li key={card.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{card.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {card.featureDetails
                      ? `Reviewed ${formatDate(card.featureDetails.reviewedAt.slice(0, 10))}${benefitsCurrent(card.featureDetails, today) ? "" : " · expired"}`
                      : "No reviewed terms yet"}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 shrink-0 text-sm text-primary underline decoration-dotted underline-offset-4"
                  onClick={() => setEdit(card)}
                >
                  Edit benefits
                </button>
              </div>
              {card.featureDetails?.details && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer py-2 text-primary">
                    Benefits & conditions
                  </summary>
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {card.featureDetails.details}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Source: {card.featureDetails.source}
                  </p>
                </details>
              )}
            </li>
          ))}
        </ul>
      </details>
      {edit && (
        <CardSetupSheet
          initialStep={1}
          onSaved={() => {}}
          card={edit}
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
