import { Sparkles } from "lucide-react";
import type { SimplifyHint } from "@/lib/simplify";

/** Read-only ways to make the portfolio simpler. */
export function SimplifyCard({ hints }: { hints: SimplifyHint[] }) {
  if (!hints.length) return null;
  return (
    <section
      aria-labelledby="simplify-h"
      className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
    >
      <h2
        id="simplify-h"
        className="flex items-center gap-1.5 text-base font-semibold"
      >
        <Sparkles className="size-4 text-primary" aria-hidden /> Simplify your
        portfolio
      </h2>
      <ul className="space-y-3">
        {hints.map((h) => (
          <li key={h.id} className="space-y-0.5 text-sm">
            <p className="font-medium">{h.title}</p>
            <p className="text-muted-foreground">{h.text}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Review ideas only. Check linked payments before closing accounts, and tax or charges before selling.
      </p>
    </section>
  );
}
