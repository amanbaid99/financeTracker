"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { quickUpdate } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface QuickItem {
  id: string;
  label: string;
  sub?: string;
  value: number;
}

export interface QuickSections {
  banks: QuickItem[];
  investments: QuickItem[];
  cards: QuickItem[];
  loans: QuickItem[];
  goals: QuickItem[];
}

const SECTIONS: { key: keyof QuickSections; title: string; hint: string; empty: string; href: string }[] = [
  { key: "banks", title: "Bank accounts", hint: "Balance today", empty: "No bank accounts", href: "/holdings/new" },
  { key: "investments", title: "Investments", hint: "Current value", empty: "No investments", href: "/holdings" },
  { key: "cards", title: "Credit cards", hint: "Total outstanding", empty: "No cards", href: "/details/cards" },
  { key: "loans", title: "Loans", hint: "Amount still owed", empty: "No loans", href: "/details/liabilities" },
  { key: "goals", title: "Saved directly for goals", hint: "Money set aside outside linked holdings", empty: "No goals", href: "/goals" },
];

export function QuickUpdateForm({ sections }: { sections: QuickSections }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(
      (Object.keys(sections) as (keyof QuickSections)[]).flatMap((k) => sections[k].map((i) => [`${k}:${i.id}`, i.value])),
    ),
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const changed = (k: keyof QuickSections) =>
    sections[k].filter((i) => (values[`${k}:${i.id}`] ?? 0) !== i.value).map((i) => ({ id: i.id, v: values[`${k}:${i.id}`] ?? 0 }));
  const changedCount = (Object.keys(sections) as (keyof QuickSections)[]).reduce((s, k) => s + changed(k).length, 0);

  function save() {
    setMsg(null);
    start(async () => {
      const res = await quickUpdate({
        holdings: [...changed("banks"), ...changed("investments")].map((x) => ({ id: x.id, value: x.v })),
        cards: changed("cards").map((x) => ({ id: x.id, outstanding: x.v })),
        liabilities: changed("loans").map((x) => ({ id: x.id, outstanding: x.v })),
        goals: changed("goals").map((x) => ({ id: x.id, saved: x.v })),
      });
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: `Saved ${changedCount} update${changedCount === 1 ? "" : "s"}. Your plan is recalculated.` });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 pb-20">
      {SECTIONS.map((sec) => {
        const items = sections[sec.key];
        return (
          <section key={sec.key} className="space-y-2 rounded-xl border bg-card p-4" aria-labelledby={`qu-${sec.key}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 id={`qu-${sec.key}`} className="text-sm font-semibold">
                {sec.title}
              </h2>
              <a href={sec.href} className="text-xs text-primary underline-offset-2 hover:underline">
                {items.length ? "Add or edit" : "Add"}
              </a>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{sec.empty}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{sec.hint}</p>
                <ul className="space-y-2">
                  {items.map((i) => {
                    const key = `${sec.key}:${i.id}`;
                    const dirty = (values[key] ?? 0) !== i.value;
                    return (
                      <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1 basis-40">
                          <p className="truncate text-sm">{i.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {dirty ? `Was ${formatINR(i.value)}` : i.sub}
                          </p>
                        </div>
                        <MoneyInput
                          className={cn("w-full sm:w-44", dirty && "[&_input]:border-primary")}
                          aria-label={`${i.label} ${sec.hint.toLowerCase()}`}
                          value={values[key]}
                          onChange={(v) => setValues((s) => ({ ...s, [key]: v }))}
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground" role="status">
            {msg ? (
              <span className={msg.ok ? "text-success" : "text-danger"}>{msg.text}</span>
            ) : changedCount ? (
              `${changedCount} change${changedCount === 1 ? "" : "s"} not saved yet`
            ) : (
              "Change any amount, then save."
            )}
          </p>
          <Button type="button" onClick={save} disabled={pending || changedCount === 0}>
            {pending ? "Saving…" : "Save all"}
          </Button>
        </div>
      </div>
    </div>
  );
}
