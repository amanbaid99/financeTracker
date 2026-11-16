import {
  ChevronRight,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { Focus } from "@/lib/focus";
import { cn } from "@/lib/utils";

/** Where you are in one sentence, and at most three things to focus on. */
export function FocusCard({ focus }: { focus: Focus }) {
  const Icon =
    focus.tone === "good"
      ? ShieldCheck
      : focus.tone === "short"
        ? TriangleAlert
        : Sparkles;
  return (
    <section
      aria-labelledby="focus-h"
      data-guide="runway"
      className={cn(
        "surface-card space-y-4 rounded-2xl border bg-card p-4",
        focus.tone === "good" ? "border-success/30" : "border-warning/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
            focus.tone === "good"
              ? "bg-success-soft text-success"
              : "bg-warning-soft text-warning",
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2
            id="focus-h"
            className="text-xs font-medium text-muted-foreground"
          >
            Where you are
          </h2>
          <p className="font-semibold leading-snug">{focus.where}</p>
        </div>
      </div>

      {focus.facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3">
          {focus.facts.map((f, i) => (
            <div key={f.label} className={cn(i > 0 && "border-l pl-3")}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold tracking-tight">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {focus.items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            {focus.items.length === 1
              ? "The one thing to focus on"
              : `Focus on these ${focus.items.length}`}
          </h3>
          <ol className="space-y-2">
            {focus.items.map((it, i) => (
              <li key={it.key}>
                <Link
                  href={it.href}
                  className="press flex items-center gap-3 rounded-xl border border-border/70 p-3 hover:border-primary/40"
                >
                  <span
                    className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">
                      {it.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {it.why}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{focus.rest}</p>
    </section>
  );
}
