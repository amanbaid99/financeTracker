"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Card, PERIOD_LABELS } from "@/lib/cards";
import { benefitsCurrent, loungeAllowance } from "@/lib/card-benefits";
import { logLoungeVisit, deleteLoungeVisit } from "@/lib/cards-actions";
import { formatDate } from "@/lib/format";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
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
export function CardLounges({ card, today }: { card: Card; today: string }) {
  const [log, setLog] = useState<{ cardId: string; ruleId: string } | null>(
    null,
  );
  if (!card.featureDetails?.lounges.length) return null;
  return (
    <section
      aria-label={`${card.label} lounge benefits`}
      className="space-y-2 border-t pt-3"
    >
      <h3 className="text-sm font-semibold">Lounge benefits</h3>{" "}
      {[card].map((card) => (
        <section key={card.id} className="space-y-2">
          {card.featureDetails!.lounges.map((rule) => {
            const a = loungeAllowance(card, rule, today),
              current = benefitsCurrent(card.featureDetails!, today);
            return (
              <div key={rule.id} className="rounded-xl bg-muted p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{rule.name}</p>
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
                    onClick={() => setLog({ cardId: card.id, ruleId: rule.id })}
                  >
                    Visit log
                  </Button>
                </div>
                <details className="mt-1 text-xs text-muted-foreground">
                  <summary className="min-h-11 cursor-pointer py-3 text-primary">
                    Access conditions
                  </summary>
                  <p>
                    {rule.conditions || "Confirm eligibility with the issuer."}
                  </p>
                </details>
              </div>
            );
          })}
        </section>
      ))}
      {log && (
        <LoungeLog
          card={card}
          ruleId={log.ruleId}
          today={today}
          onClose={() => setLog(null)}
        />
      )}
    </section>
  );
}
