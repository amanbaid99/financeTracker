"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { HELP, searchHelp } from "@/lib/help";

/** Searchable questions, grouped by section; tap one to read the answer. */
export function HelpList() {
  const [query, setQuery] = useState("");
  const found = searchHelp(query);
  const sections = [...new Set(HELP.map((t) => t.section))].filter((s) =>
    found.some((t) => t.section === s),
  );
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search help"
          placeholder="Search, like net worth or EMI"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      {found.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing matches &quot;{query}&quot;. Try a shorter word.
        </p>
      )}
      {sections.map((s) => (
        <section key={s} aria-labelledby={`help-${s}`} className="space-y-2">
          <h2 id={`help-${s}`} className="px-0.5 font-semibold">
            {s}
          </h2>
          <ul className="surface-card divide-y rounded-2xl border border-border/70 bg-card">
            {found
              .filter((t) => t.section === s)
              .map((t) => (
                <li key={t.id} id={t.id}>
                  <details
                    className="group px-4"
                    open={query.trim().length > 2 || undefined}
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {t.q}
                    </summary>
                    <div className="space-y-2 pb-3 text-sm text-muted-foreground">
                      {t.a.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
