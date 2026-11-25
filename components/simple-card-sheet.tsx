"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/sheet";
import { Field } from "@/components/forms/field";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/money-input";
import { saveCard, deleteCard } from "@/lib/cards-actions";
import { emptyBenefits, type LoungeRule } from "@/lib/card-benefits";
import { PERIOD_LABELS, type Card } from "@/lib/cards";

export function SimpleCardSheet({
  card,
  onClose,
  onSaved,
}: {
  card: Card | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(card?.label ?? "");
  const [fee, setFee] = useState(card?.annualFee ?? 0);
  const [year, setYear] = useState(card?.yearStart ?? "");
  const [day, setDay] = useState(card?.statementDay?.toString() ?? "");
  const [lounges, setLounges] = useState<LoungeRule[]>(
    card?.featureDetails?.lounges ?? [],
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function update(id: string, change: Partial<LoungeRule>) {
    setLounges((ls) => ls.map((l) => (l.id === id ? { ...l, ...change } : l)));
  }
  function save() {
    start(async () => {
      setError("");
      try {
        const changed =
          JSON.stringify(lounges) !==
          JSON.stringify(card?.featureDetails?.lounges ?? []);
        const res = await saveCard({
          id: card?.id ?? null,
          label: name,
          annualFee: fee,
          yearStart: year || null,
          statementDay: day ? Number(day) : null,
          rewards: card?.rewards ?? null,
          benefits: card?.benefits ?? [],
          ...(changed
            ? {
                reviewedBenefits: {
                  ...(card?.featureDetails ?? emptyBenefits()),
                  source: card?.featureDetails?.source ?? "Entered by you",
                  lounges,
                },
                humanConfirmed: true as const,
              }
            : {}),
        });
        if (!res.ok) {
          setError(res.error ?? "Couldn't save card.");
          return;
        }
        router.refresh();
        onSaved(res.id);
        onClose();
      } catch {
        setError("Couldn't save. Try again.");
      }
    });
  }
  return (
    <Sheet title={card ? "Edit card" : "Add a card"} onClose={onClose}>
      <fieldset disabled={pending} className="space-y-4">
        <Field label="Card name">
          <Input
            aria-label="Card name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </Field>
        <Field label="Annual fee">
          <MoneyInput aria-label="Annual fee" value={fee} onChange={(v) => setFee(v ?? 0)} />
        </Field>
        <Field
          label="Card year starts"
          hint="Used for annual spend and fee-waiver tracking."
        >
          <Input
            type="date"
            aria-label="Card year starts"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </Field>
        <Field label="Statement day (optional)">
          <Input
            type="number"
            min={1}
            max={31}
            aria-label="Statement day (optional)"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </Field>
        <section className="space-y-3 border-t pt-3">
          <h3 className="font-semibold">Lounge allowances</h3>
          {lounges.map((l) => (
            <div key={l.id} className="space-y-3 rounded-xl border p-3">
              <Field label="Allowance name">
                <Input
                  aria-label="Allowance name" value={l.name}
                  onChange={(e) => update(l.id, { name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Visits">
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    aria-label="Visits" value={l.visits || ""}
                    onChange={(e) =>
                      update(l.id, { visits: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Resets">
                  <Select
                    aria-label="Resets" value={l.period}
                    onChange={(e) =>
                      update(l.id, {
                        period: e.target.value as LoungeRule["period"],
                      })
                    }
                  >
                    {(
                      [
                        "month",
                        "quarter",
                        "calendar_year",
                        "card_year",
                      ] as const
                    ).map((p) => (
                      <option key={p} value={p}>
                        {PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Annual visit limit (optional)">
                <Input
                  type="number"
                  min={1}
                  max={999}
                  aria-label="Annual visit limit (optional)" value={l.annualLimit?.visits ?? ""}
                  onChange={(e) =>
                    update(l.id, {
                      annualLimit: e.target.value
                        ? {
                            visits: Number(e.target.value),
                            period: l.annualLimit?.period ?? "unknown",
                          }
                        : undefined,
                    })
                  }
                />
              </Field>
              {l.annualLimit && (
                <Field label="Annual limit resets">
                  <Select
                    aria-label="Annual limit resets" value={l.annualLimit.period}
                    onChange={(e) =>
                      update(l.id, {
                        annualLimit: {
                          visits: l.annualLimit!.visits,
                          period: e.target.value as
                            "calendar_year" | "card_year" | "unknown",
                        },
                      })
                    }
                  >
                    <option value="unknown">Not confirmed</option>
                    <option value="calendar_year">Calendar year</option>
                    <option value="card_year">Card year</option>
                  </Select>
                </Field>
              )}
              <Field label="Access conditions">
                <Input
                  aria-label="Access conditions" value={l.conditions}
                  onChange={(e) => update(l.id, { conditions: e.target.value })}
                />
              </Field>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={l.conditional ?? false}
                  onChange={(e) =>
                    update(l.id, { conditional: e.target.checked })
                  }
                />
                Choice of lounge access or another reward
              </label>
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  setLounges((ls) => ls.filter((x) => x.id !== l.id))
                }
              >
                Remove allowance
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            type="button"
            disabled={lounges.length >= 8}
            onClick={() =>
              setLounges((ls) => [
                ...ls,
                {
                  id: crypto.randomUUID(),
                  name: "Domestic lounge",
                  visits: 1,
                  period: "quarter",
                  conditions: "",
                  evidence: "Entered and confirmed by you",
                },
              ])
            }
          >
            Add lounge allowance
          </Button>
        </section>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={!name.trim() || pending}
          onClick={save}
        >
          {pending ? "Saving…" : "Save card"}
        </Button>
        {card && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-danger"
            onClick={() => {
              if (
                !confirm(
                  "Delete this card and its bills, milestones and lounge logs?",
                )
              )
                return;
              start(async () => {
                try {
                  const r = await deleteCard(card.id);
                  if (!r.ok) {
                    setError(r.error ?? "Couldn't delete card.");
                    return;
                  }
                  router.refresh();
                  onClose();
                } catch {
                  setError("Couldn't delete. Try again.");
                }
              });
            }}
          >
            Delete card
          </Button>
        )}
      </fieldset>
    </Sheet>
  );
}
