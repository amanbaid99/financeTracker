import { Check, ChevronRight, MapPin, Pause } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { RoadStep, Roadmap, StepStatus } from "@/lib/roadmap";
import { cn } from "@/lib/utils";

const NODE: Record<StepStatus, string> = {
  done: "bg-success text-white border-success",
  on: "bg-card border-success text-success",
  hold: "bg-muted border-muted-foreground/40 text-muted-foreground",
  needs: "bg-card border-warning text-warning",
  info: "bg-primary-soft border-primary text-primary",
};
const LABEL: Record<StepStatus, string> = {
  done: "Done",
  on: "On plan",
  hold: "On hold",
  needs: "Needs you",
  info: "",
};

const when = (s: RoadStep) => {
  if (!s.date) return "";
  const [y, m] = s.date.split("-");
  const mon = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[
    Number(m) - 1
  ];
  return s.key === "salary" ? formatDate(s.date) : `${mon} ${y}`;
};

function Node({ status }: { status: StepStatus }) {
  return (
    <span
      className={cn(
        "relative z-10 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        NODE[status],
      )}
      aria-hidden
    >
      {status === "done" && <Check className="size-3.5" />}
      {status === "hold" && <Pause className="size-3" />}
      {status === "on" && <span className="size-2 rounded-full bg-success" />}
      {status === "needs" && (
        <span className="size-2 rounded-full bg-warning" />
      )}
    </span>
  );
}

function Step({ s }: { s: RoadStep }) {
  const body = (
    <>
      <Node status={s.status} />
      <span className="min-w-0 flex-1 pb-5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {when(s)}
          </span>
          {LABEL[s.status] && (
            <span
              className={cn(
                "text-[11px] font-medium",
                s.status === "needs"
                  ? "text-warning"
                  : s.status === "hold"
                    ? "text-muted-foreground"
                    : "text-success",
              )}
            >
              {LABEL[s.status]}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block break-words font-medium">{s.title}</span>
            <span className="block text-sm text-muted-foreground">{s.sub}</span>
          </span>
          {s.href && (
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
        </span>
      </span>
    </>
  );
  return (
    <li className="relative">
      {s.href ? (
        <Link href={s.href} className="press flex gap-3 rounded-lg">
          {body}
        </Link>
      ) : (
        <div className="flex gap-3">{body}</div>
      )}
    </li>
  );
}

/** The plan as steps on a line, with where you are now at the top. */
export function RoadmapView({ map, today }: { map: Roadmap; today: string }) {
  const counts = (["on", "hold", "needs"] as const)
    .map((k) => ({ k, n: map.ahead.filter((s) => s.status === k).length }))
    .filter((c) => c.n > 0);
  const years: { year: string; steps: RoadStep[] }[] = [];
  for (const s of map.ahead) {
    const y = s.date!.slice(0, 4);
    if (years.at(-1)?.year !== y) years.push({ year: y, steps: [] });
    years.at(-1)!.steps.push(s);
  }
  return (
    <div className="space-y-4">
      <section className="surface-card space-y-1 rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {map.ahead.length} {map.ahead.length === 1 ? "step" : "steps"} ahead
          {map.ahead[0]
            ? `. Next: ${map.ahead[0].title}, ${when(map.ahead[0])}.`
            : "."}
        </p>
        {counts.length > 0 && (
          <p className="text-sm font-medium">
            {counts
              .map((c) => `${c.n} ${LABEL[c.k].toLowerCase()}`)
              .join(" · ")}
          </p>
        )}
      </section>

      {map.done.length > 0 && (
        <details className="surface-card rounded-2xl border border-border/70 bg-card px-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
            Done so far
            <span className="text-success">{map.done.length}</span>
          </summary>
          <ol className="pb-2">
            {map.done.map((s) => (
              <Step key={s.key} s={s} />
            ))}
          </ol>
        </details>
      )}

      <div
        data-guide="roadmap"
        className="surface-card relative rounded-2xl border border-border/70 bg-card p-4"
      >
        {/* The line the steps sit on. */}
        <span
          className="absolute bottom-6 left-[1.7rem] top-6 w-0.5 bg-border"
          aria-hidden
        />
        <div className="relative flex items-center gap-3 pb-5">
          <span
            className="relative z-10 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            aria-hidden
          >
            <MapPin className="size-3.5" />
          </span>
          <span>
            <span className="block text-xs font-medium text-primary">
              You are here
            </span>
            <span className="block font-medium">{formatDate(today)}</span>
          </span>
        </div>
        {years.map((y) => (
          <section key={y.year} aria-label={y.year}>
            <p className="relative z-10 mb-3 ml-9 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {y.year}
            </p>
            <ol>
              {y.steps.map((s) => (
                <Step key={s.key} s={s} />
              ))}
            </ol>
          </section>
        ))}
        {map.ahead.length === 0 && (
          <p className="ml-9 text-sm text-muted-foreground">
            Add a goal with a date to see it here.
          </p>
        )}
      </div>

      {map.undated.length > 0 && (
        <section className="surface-card space-y-1 rounded-2xl border border-border/70 bg-card p-4">
          <h2 className="font-semibold">Whenever you get there</h2>
          <p className="text-xs text-muted-foreground">
            Goals without a date, until money is going in.
          </p>
          <ol className="pt-2">
            {map.undated.map((s) => (
              <Step key={s.key} s={s} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
