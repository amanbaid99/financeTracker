"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// In-app history for this tab, so Back returns to the exact screen you came
// from (with its open goal, filter or tab). Opened from a link or a fresh
// launch, there's no history and Back goes to the parent page instead.
const KEY = "nav-history";
const EVENT = "nav-history-change";

function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Where each screen sits, for the Back label. */
const LABELS: [RegExp, string][] = [
  [/^\/goals\/plan/, "Your plan"],
  [/^\/goals\/budget/, "Budget"],
  [/^\/goals\/new/, "New goal"],
  [/^\/goals/, "Goals"],
  [/^\/portfolio\/net-worth/, "Net worth"],
  [/^\/portfolio/, "Portfolio"],
  [/^\/cards/, "Credit"],
  [/^\/ask/, "Ask"],
  [/^\/import/, "Import"],
  [/^\/settings/, "Settings"],
  [/^\/help/, "Help"],
  [/^\/whats-new/, "What's new"],
];
const labelFor = (path: string) =>
  LABELS.find(([re]) => re.test(path))?.[1] ?? "Back";

/** Records each screen you visit. Mounted once in the app layout. */
export function NavHistory() {
  const path = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => {
    const here = query ? `${path}?${query}` : path;
    try {
      const stack = read();
      const prev = stack.at(-2);
      // Going back pops the screen we left, instead of adding a loop.
      if (prev === here) stack.pop();
      else if (stack.at(-1)?.split("?")[0] === path)
        stack[stack.length - 1] = here;
      else stack.push(here);
      sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-30)));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Storage blocked: Back falls back to the parent page.
    }
  }, [path, query]);
  return null;
}

function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
const previous = () => read().at(-2) ?? "";

/**
 * Back to the previous in-app screen, or to `fallback` when there isn't
 * one. The label names where it goes.
 */
export function BackLink({
  fallback,
  label,
}: {
  fallback: string;
  /** The parent's name, shown until we know the real previous screen. */
  label: string;
}) {
  const router = useRouter();
  const prev = useSyncExternalStore(subscribe, previous, () => "");
  const text = prev ? labelFor(prev.split("?")[0]) : label;
  return (
    <Link
      href={prev || fallback}
      onClick={(e) => {
        if (!prev) return;
        e.preventDefault();
        router.back();
      }}
      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden /> {text}
    </Link>
  );
}
