"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet } from "@/components/sheet";
import { Input } from "@/components/ui/input";
import {
  saveAllMappings,
  saveGoalMapping,
  snoozeSuggestion,
} from "@/lib/goal-suggestion-actions";
import { formatINR } from "@/lib/format";
import type { MappingSuggestion, TidySuggestion } from "@/lib/goal-suggestions";

type Holding = { id: string; label: string; value: number };

/**
 * Suggestions on Goals: which money covers which goal (Accept or Change), and
 * ways to keep things simple (Not now hides one for a week).
 */
export function GoalSuggestions({
  mappings,
  tidy,
  holdings,
}: {
  mappings: MappingSuggestion[];
  tidy: TidySuggestion[];
  holdings: Holding[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [changing, setChanging] = useState<MappingSuggestion | null>(null);
  const [all, setAll] = useState(false);
  const total = mappings.length + tidy.length;
  if (!total) return null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "Something went wrong.");
      setChanging(null);
      router.refresh();
    });
  const shown = all ? mappings : mappings.slice(0, 3);
  const shownTidy = all
    ? tidy
    : tidy.slice(0, Math.max(0, 3 - shown.length) || 1);
  const hidden = total - shown.length - shownTidy.length;

  return (
    <section
      aria-labelledby="sugg-h"
      className="surface-card space-y-4 rounded-2xl border border-primary/20 bg-card p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="sugg-h" className="flex items-center gap-1.5 font-semibold">
          <Lightbulb className="size-4 text-primary" aria-hidden /> Suggestions
        </h2>
        <span className="text-sm text-muted-foreground">{total}</span>
      </div>

      {shown.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Which money covers which goal
            </p>
            {mappings.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    saveAllMappings({
                      rows: mappings.flatMap((m) =>
                        m.proposed.map((r) => ({
                          goalId: m.goalId,
                          investmentId: r.investmentId,
                          percent: r.percent,
                        })),
                      ),
                    }),
                  )
                }
              >
                Accept all
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {shown.map((m) => (
              <li key={m.key} className="space-y-2 py-3 first:pt-0">
                <p className="text-sm">
                  Cover <b>{m.goalName}</b> with{" "}
                  {m.proposed.map((r, i) => (
                    <span key={r.investmentId}>
                      {i > 0 && (i === m.proposed.length - 1 ? " and " : ", ")}
                      <b>{r.label}</b> ({formatINR(r.value)})
                    </span>
                  ))}
                </p>
                <p className="text-xs text-muted-foreground">Now: {m.now}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    aria-label={`Accept for ${m.goalName}`}
                    onClick={() =>
                      run(() =>
                        saveGoalMapping({
                          goalId: m.goalId,
                          rows: m.proposed.map((r) => ({
                            investmentId: r.investmentId,
                            percent: r.percent,
                          })),
                        }),
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    aria-label={`Change for ${m.goalName}`}
                    onClick={() => setChanging(m)}
                  >
                    Change
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => snoozeSuggestion(m.key))}
                  >
                    Not now
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shownTidy.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">
            Keep it simple
          </p>
          <ul className="divide-y">
            {shownTidy.map((t) => (
              <li key={t.key} className="space-y-2 py-3 first:pt-0">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">{t.text}</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/goals?do=update"
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                    })}
                  >
                    Done, update amounts
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => snoozeSuggestion(t.key))}
                  >
                    Not now
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            The app doesn&apos;t buy or sell anything. Check exit loads and tax
            before you move money.
          </p>
        </div>
      )}

      {hidden > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setAll(true)}
        >
          Show {hidden} more
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {changing && (
        <ChangeSheet
          suggestion={changing}
          holdings={holdings}
          pending={pending}
          error={error}
          onClose={() => !pending && setChanging(null)}
          onSave={(rows) =>
            run(() => saveGoalMapping({ goalId: changing.goalId, rows }))
          }
        />
      )}
    </section>
  );
}

function ChangeSheet({
  suggestion,
  holdings,
  pending,
  error,
  onClose,
  onSave,
}: {
  suggestion: MappingSuggestion;
  holdings: Holding[];
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (rows: { investmentId: string; percent: number }[]) => void;
}) {
  const [share, setShare] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      suggestion.proposed.map((r) => [
        r.investmentId,
        String(Math.round(r.percent)),
      ]),
    ),
  );
  const rows = holdings
    .map((h) => ({ investmentId: h.id, percent: Number(share[h.id] || 0) }))
    .filter((r) => r.percent > 0);
  const bad = rows.some((r) => !(r.percent > 0 && r.percent <= 100));
  return (
    <Sheet title={`What covers ${suggestion.goalName}?`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!bad) onSave(rows);
        }}
      >
        <p className="text-sm text-muted-foreground">
          Set how much of each holding is for this goal. Leave the rest empty.
        </p>
        <ul className="divide-y">
          {holdings.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <span className="block break-words font-medium">{h.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatINR(h.value)}
                </span>
              </span>
              <span className="flex w-24 shrink-0 items-center gap-1">
                <Input
                  aria-label={`${h.label} share for ${suggestion.goalName}, %`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  value={share[h.id] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setShare((s) => ({ ...s, [h.id]: e.target.value }))
                  }
                />
                <span className="text-sm text-muted-foreground">%</span>
              </span>
            </li>
          ))}
        </ul>
        {bad && (
          <p role="alert" className="text-sm text-danger">
            Use a share from 1 to 100%.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending || bad}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Sheet>
  );
}
