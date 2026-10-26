"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { MoneyInput } from "@/components/money-input";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { SPEND_CATEGORIES, type SpendCategory } from "@/lib/card-advisor";
import type { Check, Item, MilestoneDraft, Review } from "@/lib/card-extract";
import { setAskEnabled } from "@/lib/ask/actions";
import { extractCardFeatures } from "@/lib/card-extract-actions";
import { PERIOD_LABELS, type Card } from "@/lib/cards";
import { saveCard, saveMilestone } from "@/lib/cards-actions";
import { formatINR } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

async function pdfText(file: File, password: string): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  if (file.size > 4_300_000) throw new Error("This file is over 4 MB.");
  const res = await fetch("/api/pdf_text", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: new Blob([`${password}\n`, file]),
  });
  let body: { ok?: boolean; text?: string; message?: string; code?: string };
  try {
    body = await res.json();
  } catch {
    throw new Error(
      "The PDF reader isn't available right now. Try again in a minute.",
    );
  }
  if (!res.ok || !body.ok || !body.text) {
    const e = new Error(body.message ?? "Couldn't read this PDF.");
    (e as Error & { code?: string }).code = body.code;
    throw e;
  }
  return body.text;
}

function Badge({ check, why }: { check: Check; why: string }) {
  return (
    <span
      title={why}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        check === "confirmed"
          ? "bg-success-soft text-success"
          : "bg-warning-soft text-warning",
      )}
    >
      {check === "confirmed" ? (
        <CircleCheck className="size-3" aria-hidden />
      ) : (
        <CircleAlert className="size-3" aria-hidden />
      )}
      {check === "confirmed" ? "Confirmed" : "Check this"}
    </span>
  );
}

function Row({
  item,
  checked,
  onChange,
  label,
  disabled,
  note,
  children,
}: {
  item: Item<unknown>;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 py-2.5">
      <Checkbox
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">{children}</div>
          {!disabled && <Badge check={item.check} why={item.why} />}
        </div>
        <p className="text-xs text-muted-foreground">{note ?? item.why}</p>
      </div>
    </li>
  );
}

const sameMilestone = (
  a: { target: number; period: string },
  b: { target: number; period: string },
) => a.target === b.target && a.period === b.period;

function ReviewStep({
  card,
  review,
  onDone,
}: {
  card: Card | null;
  review: Review;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const ok = (i: Item<unknown> | null) => i?.check === "confirmed";

  const [label, setLabel] = useState(
    card?.label ?? review.cardName?.value ?? "",
  );
  const [useFee, setUseFee] = useState(
    ok(review.annualFee) && review.annualFee?.value !== card?.annualFee,
  );
  const [fee, setFee] = useState<number | null>(
    review.annualFee?.value ?? null,
  );
  const [useRewards, setUseRewards] = useState(ok(review.rewards));
  const [rewards, setRewards] = useState(review.rewards?.value ?? "");
  const existingBenefits = new Set(
    (card?.benefits ?? []).map((b) => b.toLowerCase()),
  );
  const [benefits, setBenefits] = useState(
    review.benefits.map(
      (b) => ok(b) && !existingBenefits.has(b.value.toLowerCase()),
    ),
  );
  const onCard = (m: MilestoneDraft) =>
    (card?.milestones ?? []).some((x) => sameMilestone(x, m));
  const blocked = (m: MilestoneDraft) => onCard(m) || m.period === "once";
  const [milestones, setMilestones] = useState(
    review.milestones.map((m) => ok(m) && !blocked(m.value)),
  );
  const [bestFor, setBestFor] = useState<Set<SpendCategory>>(
    () =>
      new Set([
        ...((card?.bestFor ?? []) as SpendCategory[]),
        ...review.bestFor.filter((b) => ok(b)).map((b) => b.value),
      ]),
  );

  const confirmed = [
    review.annualFee,
    review.rewards,
    ...review.benefits,
    ...review.milestones,
    ...review.bestFor,
  ].filter(ok).length;
  const toCheck = [
    review.annualFee,
    review.rewards,
    ...review.benefits,
    ...review.milestones,
    ...review.bestFor,
  ].filter((i) => i && !ok(i)).length;

  const save = () =>
    start(async () => {
      setError("");
      const pickedBenefits = review.benefits
        .filter((_, i) => benefits[i])
        .map((b) => b.value);
      const allBenefits = [...(card?.benefits ?? [])];
      for (const b of pickedBenefits)
        if (!allBenefits.some((x) => x.toLowerCase() === b.toLowerCase()))
          allBenefits.push(b);
      const res = await saveCard({
        id: card?.id ?? null,
        label: label.trim(),
        annualFee: useFee ? fee : (card?.annualFee ?? null),
        yearStart: card?.yearStart ?? null,
        rewards: useRewards ? rewards.trim() || null : (card?.rewards ?? null),
        benefits: allBenefits.slice(0, 30),
        bestFor: [...bestFor],
      });
      if (!res.ok || !res.id)
        return setError(res.ok ? "Couldn't save the card." : res.error);
      for (const [i, m] of review.milestones.entries()) {
        if (!milestones[i]) continue;
        const r = await saveMilestone({
          id: null,
          cardId: res.id,
          name: m.value.name,
          target: m.value.target,
          period: m.value.period,
          deadline: null,
          reward: m.value.reward,
        });
        if (!r.ok) return setError(r.error);
      }
      router.refresh();
      onDone();
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {review.readings > 1
          ? `Read ${review.readings} times and checked against your document: ${confirmed} confirmed, ${toCheck} to check.`
          : "Only one reading came back, so check each item."}{" "}
        Tick what you want to keep. Nothing is saved until you tap Save.
      </p>

      {!card && (
        <Field
          label="Card name"
          htmlFor="f-label"
          hint="Never enter the card number."
        >
          <Input
            id="f-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            required
          />
        </Field>
      )}

      {(review.annualFee || review.rewards) && (
        <section aria-label="Fee and rewards">
          <h3 className="text-sm font-semibold">Fee and rewards</h3>
          <ul className="divide-y">
            {review.annualFee && (
              <Row
                item={review.annualFee}
                checked={useFee}
                onChange={setUseFee}
                label="Keep annual fee"
                note={
                  card?.annualFee != null &&
                  card.annualFee !== review.annualFee.value
                    ? `Now ${formatINR(card.annualFee)} on this card. ${review.annualFee.why}`
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0">Annual fee</span>
                  <MoneyInput
                    aria-label="Annual fee"
                    value={fee}
                    onChange={setFee}
                    className="w-32"
                  />
                </div>
              </Row>
            )}
            {review.rewards && (
              <Row
                item={review.rewards}
                checked={useRewards}
                onChange={setUseRewards}
                label="Keep rewards"
              >
                <Input
                  aria-label="Rewards"
                  value={rewards}
                  onChange={(e) => setRewards(e.target.value)}
                  maxLength={200}
                />
              </Row>
            )}
          </ul>
        </section>
      )}

      {review.milestones.length > 0 && (
        <section aria-label="Milestones found">
          <h3 className="text-sm font-semibold">Milestones</h3>
          <ul className="divide-y">
            {review.milestones.map((m, i) => {
              const dup = blocked(m.value);
              return (
                <Row
                  key={`${m.value.target}-${m.value.period}`}
                  item={m}
                  checked={milestones[i]}
                  disabled={dup}
                  onChange={(v) =>
                    setMilestones((s) => s.map((x, j) => (j === i ? v : x)))
                  }
                  label={`Keep milestone ${m.value.name}`}
                  note={
                    onCard(m.value)
                      ? "Already on this card."
                      : dup
                        ? "Needs an end date. Add it with Add milestone."
                        : undefined
                  }
                >
                  <p className="font-medium">{m.value.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatINR(m.value.target)} ·{" "}
                    {PERIOD_LABELS[m.value.period].toLowerCase()}
                    {m.value.reward ? ` · ${m.value.reward}` : ""}
                  </p>
                </Row>
              );
            })}
          </ul>
        </section>
      )}

      {review.benefits.length > 0 && (
        <section aria-label="Benefits found">
          <h3 className="text-sm font-semibold">Benefits</h3>
          <ul className="divide-y">
            {review.benefits.map((b, i) => {
              const dup = existingBenefits.has(b.value.toLowerCase());
              return (
                <Row
                  key={b.value}
                  item={b}
                  checked={benefits[i]}
                  disabled={dup}
                  onChange={(v) =>
                    setBenefits((s) => s.map((x, j) => (j === i ? v : x)))
                  }
                  label={`Keep benefit ${b.value}`}
                  note={dup ? "Already on this card." : undefined}
                >
                  {b.value}
                </Row>
              );
            })}
          </ul>
        </section>
      )}

      {review.bestFor.length > 0 && (
        <section aria-label="Best for" className="space-y-2">
          <h3 className="text-sm font-semibold">Best for</h3>
          <p className="text-xs text-muted-foreground">
            Used to suggest which card to use. Tap to change.
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SPEND_CATEGORIES) as SpendCategory[]).map((c) => {
              const on = bestFor.has(c);
              const found = review.bestFor.find((b) => b.value === c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setBestFor((s) => {
                      const n = new Set(s);
                      if (on) n.delete(c);
                      else n.add(c);
                      return n;
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "text-muted-foreground",
                    found && !on && "border-dashed",
                  )}
                >
                  {SPEND_CATEGORIES[c]}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Button
        type="button"
        className="w-full"
        disabled={pending || !label.trim()}
        onClick={save}
      >
        {pending ? "Saving…" : card ? "Save to card" : "Add card"}
      </Button>
    </div>
  );
}

/** Reads a card's features from a PDF or a description, then lets you pick what to keep. */
export function CardFeaturesSheet({
  card,
  onClose,
}: {
  card: Card | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [askPassword, setAskPassword] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [needsAi, setNeedsAi] = useState(false);
  const [pending, start] = useTransition();

  const read = (allowAi = false) =>
    start(async () => {
      setError("");
      if (allowAi) {
        const on = await setAskEnabled(true);
        if (!on.ok) return setError(on.error ?? "Couldn't turn on AI.");
        setNeedsAi(false);
      }
      let source = text;
      if (mode === "pdf") {
        if (!file) return setError("Pick the card's features PDF first.");
        try {
          source = await pdfText(file, password);
        } catch (e) {
          if ((e as { code?: string }).code === "password")
            setAskPassword(true);
          return setError(
            e instanceof Error ? e.message : "Couldn't read this PDF.",
          );
        }
      }
      const res = await extractCardFeatures({ text: source });
      if (!res.ok) {
        if (res.needsAi) return setNeedsAi(true);
        return setError(res.error);
      }
      if (
        !res.review.annualFee &&
        !res.review.rewards &&
        !res.review.benefits.length &&
        !res.review.milestones.length
      )
        return setError(
          "No card features found in this. Try the card's key facts or benefits document.",
        );
      setReview(res.review);
    });

  return (
    <Sheet
      title={
        review
          ? "Check what was found"
          : card
            ? `Read ${card.label} features`
            : "Add a card from its features"
      }
      onClose={onClose}
    >
      {review ? (
        <ReviewStep card={card} review={review} onDone={onClose} />
      ) : (
        <div className="space-y-4">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
            role="tablist"
            aria-label="How to add features"
          >
            {(
              [
                ["pdf", "Upload PDF"],
                ["text", "Describe it"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={mode === v}
                onClick={() => setMode(v)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm",
                  mode === v
                    ? "bg-card font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {mode === "pdf" ? (
            <div className="space-y-3" role="tabpanel">
              <Field
                label="Card features PDF"
                htmlFor="f-pdf"
                hint="The bank's key facts, benefits guide or MITC. Not a statement."
              >
                <Input
                  id="f-pdf"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              {askPassword && (
                <Field label="PDF password" htmlFor="f-pass">
                  <Input
                    id="f-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
            </div>
          ) : (
            <Field label="What does your card give you?" htmlFor="f-text">
              <textarea
                id="f-text"
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={8000}
                placeholder={
                  "e.g. Annual fee 4,999, waived on 8 lakh spend in a card year. 4 points per 100 on travel. 10,000 bonus points at 12 lakh. 6 domestic lounge visits a year."
                }
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
              />
            </Field>
          )}

          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            AI reads this twice and every fact is checked against your text.
            Card numbers, emails and phone numbers are masked first. The file
            isn&apos;t kept, and nothing is saved until you choose what to keep.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft p-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
          {needsAi ? (
            <div className="space-y-3 rounded-lg border border-primary p-3 text-sm">
              <p className="font-medium">Allow AI to read this?</p>
              <p className="text-muted-foreground">
                The text is sent to AI models through OpenRouter, with card
                numbers, emails and phone numbers masked. This turns on the same
                AI switch as Ask, which you can turn off in Settings.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setNeedsAi(false)}
                >
                  Not now
                </Button>
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => read(true)}
                >
                  {pending ? "Reading…" : "Allow and read"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={() => read()}
            >
              {pending ? "Reading…" : "Read features"}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
