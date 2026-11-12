import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { formatDate } from "@/lib/format";
import { RELEASES } from "@/lib/guides";

export const metadata: Metadata = { title: "What's new" };

/** Every past update, newest first. */
export default function WhatsNewPage() {
  return (
    <main className="space-y-4">
      <BackLink fallback="/settings" label="Settings" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          What&apos;s new
        </h1>
        <p className="text-sm text-muted-foreground">
          Every update, newest first.
        </p>
      </div>
      <ol className="space-y-3">
        {RELEASES.map((r) => (
          <li
            key={`${r.date}-${r.title}`}
            className="surface-card space-y-3 rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">{r.title}</h2>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(r.date)}
              </span>
            </div>
            <ul className="space-y-2.5">
              {r.items.map((it) => (
                <li key={it.title} className="flex gap-2.5 text-sm">
                  <Sparkles
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{it.title}.</span>{" "}
                    <span className="text-muted-foreground">{it.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
