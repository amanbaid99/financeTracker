"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Compass, CreditCard, Pencil } from "lucide-react";
import type { Card } from "@/lib/cards";
import {
  cardStrategy,
  type CardStrategy as Strategy,
} from "@/lib/card-strategy";
import { saveCardStrategy } from "@/lib/cards-actions";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/forms/field";

export function CardStrategy({ cards }: { cards: Card[] }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(cards[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Strategy>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!cards.length) return null;
  const active = cards.find((c) => c.id === selected) ?? cards[0];
  const draft = drafts[active.id] ?? cardStrategy(active);
  const ready = cards.filter((c) => cardStrategy(c).useFor);
  function update(change: Partial<Strategy>) {
    setDrafts((d) => ({ ...d, [active.id]: { ...draft, ...change } }));
  }
  function save() {
    start(async () => {
      setError("");
      try {
        const res = await saveCardStrategy({
          cardId: active.id,
          strategy: draft,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.refresh();
        setEditing(false);
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }
  return (
    <section
      aria-label="Card strategy"
      className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-sm"
    >
      <details className="group">
        <summary className="flex min-h-24 cursor-pointer list-none items-center gap-3 bg-gradient-to-br from-primary-soft/70 via-primary-soft/20 to-card p-5 [&::-webkit-details-marker]:hidden">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Compass className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Card strategy</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Your go-to cards, at a glance
            </span>
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-primary transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="px-5 pb-2">
          <div className="flex items-center justify-between gap-3 py-2">
            <p className="text-xs text-muted-foreground">
              A personal reminder. No live calculations.
            </p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setDrafts({});
                setEditing(true);
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-primary"
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </button>
          </div>
          {ready.length ? (
            <ul className="divide-y divide-border/60">
              {ready.map((card, i) => {
                const rule = cardStrategy(card);
                return (
                  <li key={card.id} className="py-4">
                    <div className="flex items-start gap-3">
                      <span className="tabular mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-relaxed">
                          {rule.useFor}
                        </h3>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <CreditCard
                            className="size-3.5 shrink-0"
                            aria-hidden
                          />
                          {card.label}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                          {rule.remember}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pb-4 text-sm text-muted-foreground">
              Add a short reminder for where you prefer to use each card.
            </p>
          )}
          <p className="border-t py-3 text-[11px] leading-relaxed text-muted-foreground">
            Caps aren’t tracked here. Check current eligibility and charges with
            your bank.
          </p>
        </div>
      </details>
      {editing && (
        <Sheet title="Edit card strategy" onClose={() => setEditing(false)}>
          <fieldset disabled={pending} className="space-y-4">
            <Field label="Card">
              <Select
                aria-label="Strategy card"
                value={active.id}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setError("");
                }}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Use this card for">
              <Input
                aria-label="Use this card for"
                value={draft.useFor}
                onChange={(e) => update({ useFor: e.target.value })}
                maxLength={180}
                placeholder="For example, groceries and utilities"
              />
            </Field>
            <Field
              label="Remember"
              hint="Optional: caps, exclusions or a rule you want to follow."
            >
              <textarea
                aria-label="Strategy reminder"
                value={draft.remember}
                onChange={(e) => update({ remember: e.target.value })}
                maxLength={300}
                rows={5}
                className="w-full rounded-xl border bg-background p-3 text-sm"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Clear the first line to hide this card from your strategy. This
              won’t change benefits or milestones.
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              type="button"
              className="w-full"
              disabled={pending}
              onClick={save}
            >
              {pending ? "Saving…" : "Save reminder"}
            </Button>
          </fieldset>
        </Sheet>
      )}
    </section>
  );
}
