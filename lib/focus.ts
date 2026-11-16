// "Where am I, and what are the few things that matter right now?"
// Pure: callers pass today and the data. At most three things, most
// important first, so there is never a long list to worry about.

import { formatINR } from "./format";
import { goalStatus } from "./goal-status";
import type { Runway } from "./runway";
import type { TrackedGoal } from "./tracker";

export interface FocusItem {
  key: string;
  title: string;
  why: string;
  href: string;
  tone: "do" | "calm";
}

export interface Focus {
  /** One calm sentence: where you are. */
  where: string;
  tone: "good" | "close" | "short";
  /** Small facts under the sentence. */
  facts: { label: string; value: string }[];
  items: FocusItem[];
  /** What you can stop thinking about. */
  rest: string;
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

const daysApart = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Between jobs: getting to salary is the only job. */
export function betweenFocus(opts: {
  today: string;
  runway: Runway;
  /** One-off items added on the runway page (card dues, money owed). */
  itemCount: number;
  heldGoals: number;
}): Focus {
  const { runway: r, today } = opts;
  const { best, worst, owedToYou } = r;
  let where: string;
  let tone: Focus["tone"];
  if (worst.left >= 0) {
    where = `You're covered till salary, even if it comes on ${dayMonth(worst.until)}.`;
    tone = "good";
  } else if (worst.leftWithOwed >= 0 && owedToYou > 0) {
    where = `You're covered once the ${formatINR(owedToYou)} owed to you comes in.`;
    tone = "close";
  } else if (best.left >= 0) {
    where = `You're covered if salary comes by ${dayMonth(best.until)}. A small gap if it's ${dayMonth(worst.until)}.`;
    tone = "close";
  } else {
    where = `There's a gap of ${formatINR(-worst.leftWithOwed)} before salary. It's a number you can plan for.`;
    tone = "short";
  }

  const items: FocusItem[] = [];
  if (opts.itemCount === 0)
    items.push({
      key: "setup",
      title: "Add your bank balances and card dues",
      why: "Two minutes, once. Then the numbers here are really yours.",
      href: "/goals/runway",
      tone: "do",
    });
  items.push(
    worst.weekly > 0
      ? {
          key: "spend",
          title: `Spend up to ${formatINR(worst.weekly)} a week`,
          why: "Food, travel and day-to-day things. Stay under it and you're on plan.",
          href: "/goals/runway",
          tone: "do",
        }
      : {
          key: "spend",
          title: "Only spend on what can't wait",
          why: "Clothes, outings and treats can wait till salary.",
          href: "/goals/runway",
          tone: "do",
        },
  );
  const next = worst.lines.find(
    (l) => l.counted && l.source !== "living" && l.date >= today,
  );
  if (next) {
    const days = daysApart(today, next.date);
    items.push({
      key: "next",
      title: `Next payment: ${formatINR(next.amount)} on ${dayMonth(next.date)}`,
      why: `${next.label}${days <= 7 ? ", this week" : `, in ${days} days`}. Keep this much in the bank.`,
      href: "/goals/runway",
      tone: "do",
    });
  }
  if (owedToYou > 0)
    items.push({
      key: "owed",
      title: `Ask for the ${formatINR(owedToYou)} owed to you`,
      why: "A friendly reminder now makes January easier.",
      href: "/goals/runway",
      tone: "do",
    });

  return {
    where,
    tone,
    facts: [
      { label: "Ready to use", value: formatINR(r.liquid) },
      {
        label: `Due till ${dayMonth(worst.until)}`,
        value: formatINR(worst.due),
      },
    ],
    items: items.slice(0, 3),
    rest:
      opts.heldGoals > 0
        ? `Your ${opts.heldGoals === 1 ? "other goal waits" : `${opts.heldGoals} other goals wait`} till salary. That's the plan, not a problem.`
        : "Everything else can wait till salary.",
  };
}

/** Working normally: the goals that need you, then the next small step. */
export function usualFocus(opts: {
  today: string;
  goals: TrackedGoal[];
  hasBudget: boolean;
  hasPlan: boolean;
  /** Last time any investment value was edited, if known. */
  lastUpdated: string | null;
}): Focus {
  const { today, goals } = opts;
  const st = goals.map((g) => ({ g, s: goalStatus(g, today) }));
  const urgent = st.filter((x) => x.s.tone === "danger");
  const behind = st.filter((x) => x.s.tone === "warning");
  const fine = st.filter((x) => x.s.tone === "success").length;

  const items: FocusItem[] = [];
  for (const x of [...urgent, ...behind].slice(0, 2))
    items.push({
      key: `goal:${x.g.id}`,
      title: `Look at ${x.g.name}`,
      why: `${x.s.label}. Open it to see the one thing to do.`,
      href: `/goals?open=${x.g.id}`,
      tone: "do",
    });
  if (!opts.hasBudget)
    items.push({
      key: "budget",
      title: "Set your budget",
      why: "Income and costs, once. It tells the plan what you can invest.",
      href: "/goals/budget",
      tone: "do",
    });
  else if (!opts.hasPlan)
    items.push({
      key: "plan",
      title: "Make a plan",
      why: "Split what you can invest across your goals.",
      href: "/goals?do=plan",
      tone: "do",
    });
  if (opts.lastUpdated && daysApart(opts.lastUpdated.slice(0, 10), today) > 35)
    items.push({
      key: "update",
      title: "Update your values",
      why: "It's been over a month. Fresh numbers keep the plan honest.",
      href: "/goals?do=update",
      tone: "do",
    });

  const where =
    urgent.length > 0
      ? `${urgent.length === 1 ? "One goal needs" : `${urgent.length} goals need`} a look. The rest are fine.`
      : behind.length > 0
        ? `Mostly on track. ${behind.length === 1 ? "One goal is" : `${behind.length} goals are`} a little behind.`
        : fine > 0
          ? "You're on track. Nothing needs you today."
          : "You're set up. Add money to a goal to get it moving.";
  return {
    where,
    tone: urgent.length > 0 ? "short" : behind.length > 0 ? "close" : "good",
    facts: [],
    items: items.slice(0, 3),
    rest:
      items.length > 0
        ? "That's all. Everything else is ticking along."
        : "Nothing to do. Check back after your next salary.",
  };
}
