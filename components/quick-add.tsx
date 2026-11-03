"use client";

import {
  FileUp,
  Plus,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GuideButton, useGuides } from "@/components/guides";
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
];

/** Where an action goes from this page: updates stay on Portfolio, and Import comes back to it. */
function hrefFor(href: string, path: string): string {
  if (path !== "/portfolio") return href;
  if (href === "/goals?do=update") return "/portfolio?do=update";
  if (href === "/import") return "/import?from=portfolio";
  return href;
}

export function hasQuickActions(path: string): boolean {
  return !["/ask", "/settings", "/goals/new", "/import"].some((prefix) =>
    path.startsWith(prefix),
  );
}

/** One docked action for adding and updating, without covering page content. */
export function QuickAdd() {
  const path = usePathname();
  const { seen, markSeen } = useGuides();
  const [open, setOpen] = useState(false);
  const actions =
    path === "/portfolio"
      ? [
          {
            href: "/portfolio?do=add",
            label: "Add an investment or saving",
            hint: "Track something you hold",
            icon: Wallet,
          },
          ...ACTIONS,
        ]
      : ACTIONS;
  const close = useCallback(() => setOpen(false), []);
  // Each tab's first-visit guide already points to the + button, so there's
  // no separate hint bubble.
  if (!hasQuickActions(path)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!seen.has("quick-add")) markSeen("quick-add");
          setOpen(true);
        }}
        aria-label="Add or update"
        className="press inline-flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm hover:brightness-110"
      >
        <Plus className="size-6" aria-hidden />
      </button>
      {open && (
        <Sheet title="What would you like to do?" onClose={close}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Your everyday shortcuts
            </p>
            <GuideButton id="quick-add" autoShow={false} />
          </div>
          <ul className="grid grid-cols-2 gap-2">
            {actions.map((a) => (
              <li key={a.href}>
                <Link
                  href={hrefFor(a.href, path)}
                  transitionTypes={["tab"]}
                  onClick={(e) => {
                    close();
                    // Already on that page: open it in place, keeping what's open.
                    const href = hrefFor(a.href, path);
                    const [to, query] = href.split("?");
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
