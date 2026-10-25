// One-line status for a goal, shared by the list and the goal page.

import { formatDate, formatINR } from "./format";
import type { TrackedGoal } from "./tracker";

export type Tone = "success" | "warning" | "danger" | "muted";

export const monthYear = (iso: string | null) => formatDate(iso).split(" ").slice(1).join(" ");

export function goalHeadline(g: TrackedGoal): { text: string; tone: Tone } {
  const loan = g.type === "loan_payoff";
  switch (g.status) {
    case "reached":
      return { text: loan ? "Enough saved to close the loan" : "Goal reached", tone: "success" };
    case "overdue":
      return { text: "Target date has passed", tone: "danger" };
    case "behind":
      return { text: `Needs ${formatINR(g.extraSipNeeded)} more a month`, tone: "warning" };
    case "no_investments":
      if (loan && g.emisCloseFirst) return { text: `EMIs close it in ${monthYear(g.reachDate)}`, tone: "muted" };
      return g.targetDate
        ? { text: `Save ${formatINR(g.extraSipNeeded)} a month to get there`, tone: "muted" }
        : { text: "Add an investment to start", tone: "muted" };
    case "on_track":
      if (loan && g.emisCloseFirst) return { text: `EMIs close it in ${monthYear(g.reachDate)}`, tone: "success" };
      if (g.targetDate) return { text: `On track for ${monthYear(g.targetDate)}`, tone: "success" };
      if (g.reachDate) return { text: `${loan ? "Can close it" : "Reached"} around ${monthYear(g.reachDate)}`, tone: "success" };
      return { text: "Not reached at this pace", tone: "warning" };
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted-foreground",
};

export const TONE_BAR: Record<Tone, "success" | "warning" | "danger" | "primary"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  muted: "primary",
};
