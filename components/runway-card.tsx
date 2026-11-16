import { ChevronRight, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import type { Runway } from "@/lib/runway";
import { cn } from "@/lib/utils";

export interface RunwayView {
  runway: Runway;
}

const dayMonth = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]}`;
};

/** The answer to "am I okay till salary?", in one sentence first. */
export function runwayHeadline(r: Runway): {
  text: string;
  tone: "good" | "close" | "short";
} {
  const { best, worst, owedToYou } = r;
  if (worst.left >= 0)
    return {
      text: `You're covered, even if salary comes on ${dayMonth(worst.until)}.`,
      tone: "good",
    };
  if (worst.leftWithOwed >= 0 && owedToYou > 0)
    return {
      text: `You're covered till ${dayMonth(worst.until)} once the ${formatINR(owedToYou)} owed to you comes in.`,
      tone: "close",
    };
  if (best.left >= 0)
    return {
      text: `Covered if salary comes by ${dayMonth(best.until)}. A small gap if it's ${dayMonth(worst.until)}.`,
      tone: "close",
    };
  return {
    text: `There's a gap to close before salary. Here's how much, and when.`,
    tone: "short",
  };
}

const left = (n: number) =>
  n >= 0 ? `${formatINR(n)} to spare` : `${formatINR(-n)} short`;

export function RunwayCard({
  view,
  link = true,
}: {
  view: RunwayView;
  link?: boolean;
}) {
  const r = view.runway;
  const head = runwayHeadline(r);
  const Icon = head.tone === "good" ? ShieldCheck : TriangleAlert;
  return (
    <section
      aria-labelledby="runway-h"
      data-guide="runway"
      className={cn(
        "surface-card space-y-3 rounded-2xl border bg-card p-4",
        head.tone === "good" ? "border-success/30" : "border-warning/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl",
            head.tone === "good"
              ? "bg-success-soft text-success"
              : "bg-warning-soft text-warning",
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2
            id="runway-h"
            className="text-xs font-medium text-muted-foreground"
          >
            Covered till salary
          </h2>
          <p className="font-semibold leading-snug">{head.text}</p>
        </div>
      </div>
      <dl className="space-y-1.5 text-sm">
        {[r.best, r.worst].map((s, i) => (
          <div
            key={s.until + i}
            className="flex items-baseline justify-between gap-3"
          >
            <dt className="text-muted-foreground">
              If salary comes {dayMonth(s.until)}
            </dt>
            <dd
              className={cn(
                "tabular font-medium",
                s.left >= 0 ? "text-success" : "text-warning",
              )}
            >
              {left(s.left)}
            </dd>
          </div>
        ))}
        {r.owedToYou > 0 && (
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <dt>Plus money owed to you</dt>
            <dd className="tabular">+{formatINR(r.owedToYou)}</dd>
          </div>
        )}
      </dl>
      <p className="rounded-lg bg-muted p-2.5 text-sm">
        {r.worst.weekly > 0 ? (
          <>
            Spend up to{" "}
            <b className="tabular">{formatINR(r.worst.weekly)} a week</b> on
            day-to-day things, and you stay on plan.
          </>
        ) : (
          <>Hold off on spending that can wait until the gap is closed.</>
        )}
      </p>
      {link && (
        <Link
          href="/liabilities/salary"
          className="-mb-1 flex min-h-11 items-center justify-between border-t pt-1 text-sm font-medium text-primary"
        >
          See what&apos;s due and when
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}
