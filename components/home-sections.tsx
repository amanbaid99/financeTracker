import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
} from "lucide-react";
import { signedINR } from "@/components/net-worth-card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatINR, formatINRCompact } from "@/lib/format";
import { goalStatus } from "@/lib/goal-status";
import { focusGoals, type HomeTone, type Payment } from "@/lib/home";
import type { TrackedGoal } from "@/lib/tracker";
import { cn } from "@/lib/utils";

const TONE: Record<
  HomeTone,
  { box: string; icon: string; Icon: typeof CircleCheck }
> = {
  success: { box: "bg-success-soft", icon: "text-success", Icon: CircleCheck },
  warning: {
    box: "bg-warning-soft",
    icon: "text-warning",
    Icon: TriangleAlert,
  },
  danger: { box: "bg-danger-soft", icon: "text-danger", Icon: CircleAlert },
};

/** Am I okay? One line, plus how much there is to do. */
export function HomeStatus({
  tone,
  text,
  todo,
}: {
  tone: HomeTone;
  text: string;
  todo: number;
}) {
  const t = TONE[tone];
  return (
    <section
      aria-label="How you're doing"
      className={cn("flex items-start gap-3 rounded-2xl p-4", t.box)}
    >
      <t.Icon className={cn("mt-0.5 size-5 shrink-0", t.icon)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="break-words font-semibold">{text}</p>
        <p className="text-sm text-muted-foreground">
          {todo === 0
            ? "Nothing to do right now."
            : `${todo} ${todo === 1 ? "thing" : "things"} to do this month.`}
        </p>
      </div>
    </section>
  );
}

const shortDate = (iso: string) => formatDate(iso).replace(/ \d{4}$/, "");

/** Money going out in the next 30 days, so you know what to keep ready. */
export function ComingUp({ payments }: { payments: Payment[] }) {
  if (!payments.length) return null;
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const biggest = [...payments].sort((a, b) => b.amount - a.amount)[0];
  return (
    <Link
      href="/cards"
      aria-label="Payments in the next 30 days"
      className="press flex items-center gap-3 rounded-2xl border bg-card p-4"
    >
      <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          <span className="tabular">{formatINR(total)}</span> going out in the
          next 30 days
        </span>
        <span className="block break-words text-xs text-muted-foreground">
          {payments.length === 1
            ? `${biggest.name} on ${shortDate(biggest.date)}`
            : `${payments.length} payments · biggest: ${biggest.name}, ${formatINR(biggest.amount)} on ${shortDate(biggest.date)}`}
        </span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
    </Link>
  );
}

/** Top three goals with a few words each; the emergency fund in months. */
export function HomeGoals({
  goals,
  today,
  between,
  emergencyMonths,
}: {
  goals: TrackedGoal[];
  today: string;
  between: boolean;
  emergencyMonths: number | null;
}) {
  const focus = focusGoals(goals, today);
  if (!goals.length)
    return (
      <section
        data-guide="home-focus"
        className="space-y-2 rounded-2xl border bg-card p-4"
      >
        <h2 className="font-semibold">What are you saving for?</h2>
        <p className="text-sm text-muted-foreground">
          Add a goal to give your money a direction.
        </p>
        <Link
          href="/goals/new"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary"
        >
          Add your first goal
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>
    );
  if (!focus.length)
    return (
      <Link
        href="/goals"
        data-guide="home-focus"
        className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border bg-card px-4 text-sm"
      >
        <span>Every goal is covered.</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  return (
    <section
      aria-labelledby="home-goals"
      data-guide="home-focus"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <Link
        href="/goals"
        className="flex min-h-12 items-center justify-between gap-3 px-4"
      >
        <h2 id="home-goals" className="text-sm font-semibold">
          Focus goals
        </h2>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      <ul className="divide-y px-4">
        {focus.map((g) => {
          const s = goalStatus(g, today, between);
          const short = g.cover?.short ?? 0;
          const right =
            s.tone === "success" || s.tone === "muted" || short <= 0
              ? s.label
              : `${formatINRCompact(short)} short`;
          const detail =
            g.type === "emergency_fund" && emergencyMonths !== null
              ? `Covers ${emergencyMonths} ${emergencyMonths === 1 ? "month" : "months"} of costs`
              : `${formatINRCompact(g.current)} of ${formatINRCompact(g.futureTarget)}`;
          return (
            <li key={g.id}>
              <Link
                href={`/goals?open=${encodeURIComponent(g.id)}`}
                className="press block space-y-2 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-sm font-medium">
                    {g.name}
                  </h3>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      s.tone === "danger"
                        ? "text-danger"
                        : s.tone === "warning"
                          ? "text-warning"
                          : s.tone === "success"
                            ? "text-success"
                            : "text-muted-foreground",
                    )}
                  >
                    {right}
                  </span>
                </div>
                <Progress
                  value={g.progress * 100}
                  label={`${g.name} progress`}
                  className="h-1"
                />
                <p className="tabular text-xs text-muted-foreground">
                  {detail}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Own, owe and spare in small numbers; net worth as one quiet line. */
export function MoneySummary({
  assets,
  liabilities,
  spare,
}: {
  assets: number;
  liabilities: number;
  spare: number;
}) {
  const cell = (label: string, value: number) => (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular truncate text-sm font-semibold">
        {formatINRCompact(value)}
      </dd>
    </div>
  );
  return (
    <section aria-label="Your money" data-guide="net-worth">
      <Link
        href="/assets"
        aria-label="View net worth and holdings"
        className="press block space-y-3 rounded-2xl border bg-card p-4"
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <h2 className="font-semibold">Your money</h2>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Net worth{" "}
            <span className="tabular font-medium text-foreground">
              {signedINR(assets - liabilities)}
            </span>
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {cell("You own", assets)}
          {cell("You owe", liabilities)}
          {cell("Spare", spare)}
        </dl>
      </Link>
    </section>
  );
}
