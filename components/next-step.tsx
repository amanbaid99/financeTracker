"use client";

import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import NextLink from "next/link";
import { formatINR } from "@/lib/format";
import type { MoneyPlan } from "@/lib/allocate";
import type { Budget } from "@/lib/budget";

const HIDDEN_KEY = "next-step-hidden";
function readHidden(): string {
  try {
    return localStorage.getItem(HIDDEN_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribeHidden(fn: () => void) {
  window.addEventListener(HIDDEN_KEY, fn);
  return () => window.removeEventListener(HIDDEN_KEY, fn);
}

/**
 * One thing to do next, only when there is one: set a budget, start a SIP
 * plan, or set up this month's SIPs. "Not now" hides it on this device.
 */
export function NextStep({
  plan,
  budget,
  steps,
  needed,
  onStart,
}: {
  plan: Pick<MoneyPlan, "monthlyTotal"> | null;
  budget: Pick<Budget, "income" | "planMonthly">;
  steps: number;
  needed: number;
  onStart?: () => void;
}) {
  const raw = useSyncExternalStore(subscribeHidden, readHidden, () => "[]");
  let hidden: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    hidden = Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    hidden = [];
  }
  const hide = (key: string) => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden, key]));
    } catch {
      // Storage blocked: it comes back next time.
    }
    window.dispatchEvent(new Event(HIDDEN_KEY));
  };
  const round = (n: number) => Math.round(n / 1000) * 1000;
  const options: {
    key: string;
    title: string;
    text: string;
    action: { label: string; href?: string; onClick?: () => void };
  }[] = [];
  if (plan && steps > 0)
    options.push({
      key: `steps-${plan.monthlyTotal}-${steps}`,
      title: `Set up ${steps} ${steps === 1 ? "SIP" : "SIPs"} this month`,
      text: "Your plan says where each one goes. Tick them off once they're set up.",
      action: { label: "See plan", href: "/goals/plan" },
    });
  if (!plan && budget.income <= 0)
    options.push({
      key: "budget",
      title: "Set your monthly budget",
      text: "Add your take-home pay and costs. The app works out what you can invest.",
      action: { label: "Set budget", href: "/goals/budget" },
    });
  if (!plan)
    options.push({
      key: "sip",
      title: "Start a SIP plan",
      text:
        budget.income > 0 && budget.planMonthly > 0
          ? `Your budget leaves ${formatINR(budget.planMonthly)} a month. See how to split it across your goals.`
          : needed > 0
            ? `Your goals need about ${formatINR(round(needed))} a month more. Split what you can across them.`
            : "Split what you can invest each month across your goals.",
      action: onStart
        ? { label: "Start", onClick: onStart }
        : { label: "Start", href: "/goals?do=plan" },
    });
  const step = options.find((o) => !hidden.includes(o.key));
  if (!step) return null;
  const button =
    "inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground";
  return (
    <section
      aria-label="Next step"
      className="surface-card space-y-3 rounded-2xl border border-primary/15 bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
          aria-hidden
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-primary">Next step</p>
          <h2 className="font-semibold">{step.title}</h2>
          <p className="text-sm text-muted-foreground">{step.text}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => hide(step.key)}
          className="min-h-11 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
        >
          Not now
        </button>
        {step.action.href ? (
          <NextLink href={step.action.href} className={button}>
            {step.action.label}
          </NextLink>
        ) : (
          <button
            type="button"
            onClick={step.action.onClick}
            className={button}
          >
            {step.action.label}
          </button>
        )}
      </div>
    </section>
  );
}
