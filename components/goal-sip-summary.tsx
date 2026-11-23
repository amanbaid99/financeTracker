import type { HybridResult } from "@/lib/hybrid-engine";
import { formatINR } from "@/lib/format";
/** Goal totals and their destinations, using the immutable saved snapshot. */
export function GoalSipSummary({ result }: { result: HybridResult }) {
  return (
    <ul className="divide-y">
      {[...result.goals]
        .sort(
          (a, b) =>
            (result.fundingOrder?.indexOf(a.goalId) ?? 0) -
            (result.fundingOrder?.indexOf(b.goalId) ?? 0),
        )
        .filter((g) => g.recommendedMonthly > 0)
        .map((g) => (
          <li key={g.goalId} className="space-y-2 py-3">
            <div className="flex justify-between gap-3 font-semibold">
              <span>{g.goalName}</span>
              <span className="tabular shrink-0">
                {formatINR(g.recommendedMonthly)}/mo
              </span>
            </div>
            {(result.vehicles ?? []).flatMap((v) =>
              v.parts
                .filter((p) => p.goalId === g.goalId && p.monthly > 0)
                .map((p) => (
                  <div
                    key={v.key}
                    className="flex justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="min-w-0 break-words">{v.label}</span>
                    <span className="tabular shrink-0">
                      {formatINR(p.monthly)}
                    </span>
                  </div>
                )),
            )}
          </li>
        ))}
    </ul>
  );
}
