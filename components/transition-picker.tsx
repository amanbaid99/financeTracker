"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setTransitionFund } from "@/lib/actions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface PickItem {
  id: string;
  label: string;
  kindLabel: string;
  value: number;
  picked: boolean;
}

/** Tap a holding to use it (or stop using it) while between incomes. */
export function TransitionPicker({ items }: { items: PickItem[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState(() => new Set(items.filter((i) => i.picked).map((i) => i.id)));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function toggle(id: string) {
    const on = !picked.has(id);
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    setError("");
    start(async () => {
      const res = await setTransitionFund({ holdingId: id, on });
      if (!res.ok) {
        setError(res.error);
        setPicked((s) => {
          const n = new Set(s);
          if (on) n.delete(id);
          else n.add(id);
          return n;
        });
        return;
      }
      router.refresh();
    });
  }

  if (!items.length) return <p className="text-sm text-muted-foreground">Add your bank accounts and investments first.</p>;

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {items.map((i) => {
          const on = picked.has(i.id);
          return (
            <li key={i.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Use ${i.label} while between jobs`}
                onClick={() => toggle(i.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm",
                  on ? "border-primary bg-primary-soft" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    on && "border-primary bg-primary text-primary-foreground",
                  )}
                  aria-hidden
                >
                  {on && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{i.kindLabel}</span>
                </span>
                <span className="tabular shrink-0">{formatINR(i.value)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground" role="status">
        {pending ? "Saving…" : "PPF, EPF and NPS aren't listed: they're locked for retirement."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
