"use client";

import {
  CreditCard,
  FileUp,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/sheet";

/** Event sent when a + action targets the page you're already on. */
export const QUICK_ACTION = "tracker:quick-action";

/** Runs `fn` when the + menu asks this page for `action`. */
export function useQuickAction(action: string, fn: () => void) {
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail === action) fn();
    };
    window.addEventListener(QUICK_ACTION, on);
    return () => window.removeEventListener(QUICK_ACTION, on);
  }, [action, fn]);
}

const ACTIONS = [
  {
    href: "/goals/new",
    label: "New goal",
    hint: "Something to save for",
    icon: Target,
  },
  {
    href: "/goals?do=update",
    label: "Update values",
    hint: "New amounts for your investments",
    icon: RefreshCw,
  },
  {
    href: "/cards?do=bill",
    label: "Log a card bill",
    hint: "Counts toward milestones",
    icon: Receipt,
  },
  {
    href: "/goals?do=plan",
    label: "Plan my money",
    hint: "Split what you can invest",
    icon: Sparkles,
  },
  {
    href: "/import",
    label: "Import statement",
    hint: "Update every fund from a CAS",
    icon: FileUp,
  },
  {
    href: "/cards?do=card",
    label: "Add a card",
    hint: "Benefits and milestones",
    icon: CreditCard,
  },
];

/** One button for every "add" or "update" in the app. Hidden where it'd get in the way. */
export function QuickAdd() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (
    path.startsWith("/ask") ||
    path.startsWith("/settings") ||
    path.startsWith("/goals/new") ||
    path.startsWith("/import")
  )
    return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add or update"
        className="press fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 sm:right-[max(1rem,calc(50%-24rem+1rem))]"
      >
        <Plus className="size-6" aria-hidden />
      </button>
      {open && (
        <Sheet title="What would you like to do?" onClose={close}>
          <ul className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  transitionTypes={["tab"]}
                  onClick={(e) => {
                    close();
                    // Already on that page: open it in place, keeping what's open.
                    const [to, query] = a.href.split("?");
                    const action = new URLSearchParams(query).get("do");
                    if (action && to === path) {
                      e.preventDefault();
                      window.dispatchEvent(
                        new CustomEvent(QUICK_ACTION, { detail: action }),
                      );
                    }
                  }}
                  className="press flex h-full flex-col gap-2 rounded-xl border bg-card p-3 hover:border-primary"
                >
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary"
                    aria-hidden
                  >
                    <a.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium leading-tight">
                    {a.label}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {a.hint}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
