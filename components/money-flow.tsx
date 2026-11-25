import NextLink from "next/link";
import { formatINR } from "@/lib/format";
import type { MoneyFlow } from "@/lib/money-flow";

/** Two small stats: saved a month and going into investments a month. */
export function MoneyFlowStats({ flow }: { flow: MoneyFlow }) {
  if (flow.saving === null && flow.investing === 0) return null;
  return (
    <section aria-label="Each month" className="grid grid-cols-2 gap-3">
      <NextLink
        href="/goals/budget"
        className="surface-card rounded-2xl border border-border/70 bg-card p-3"
      >
        <p className="text-xs text-muted-foreground">Saved a month</p>
        <p className="tabular mt-1 text-lg font-semibold">
          {flow.saving !== null ? formatINR(flow.saving) : "Not set"}
        </p>
        <p className="text-xs text-muted-foreground">
          {flow.savingRate !== null
            ? `${flow.savingRate}% of take-home`
            : "Set it on Budget"}
        </p>
      </NextLink>
      <NextLink
        href="/goals/budget#sips"
        className="surface-card rounded-2xl border border-border/70 bg-card p-3"
      >
        <p className="text-xs text-muted-foreground">Into investments</p>
        <p className="tabular mt-1 text-lg font-semibold">
          {formatINR(flow.investing)}
        </p>
        <p className="text-xs text-muted-foreground">
          {flow.notInvested
            ? `${formatINR(flow.notInvested)} not in a SIP`
            : "a month in SIPs"}
        </p>
      </NextLink>
    </section>
  );
}
