"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatINR } from "@/lib/format";

const SERIES = [
  { key: "essentials", label: "Essentials", color: "var(--series-1)" },
  { key: "savings", label: "Savings", color: "var(--series-2)" },
  { key: "wants", label: "Wants", color: "var(--series-3)" },
] as const;

type Split = { essentials: number; savings: number; wants: number };

function TooltipBox({ active, payload }: { active?: boolean; payload?: { dataKey?: string | number; value?: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-2 text-xs shadow-md">
      {payload.map((p) => {
        const s = SERIES.find((x) => x.key === p.dataKey);
        return (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: s?.color }} aria-hidden />
            <span className="text-muted-foreground">{s?.label}</span>
            <span className="tabular ml-auto font-medium text-foreground">{formatINR(p.value ?? 0)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** One 100% bar of base income: essentials, savings, wants. Legend and table carry identity too. */
export function BudgetChart({ split, base }: { split: Split; base: number }) {
  const data = [{ name: "Base income", ...split }];
  const visible = SERIES.filter((s) => split[s.key] > 0);
  return (
    <figure className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
            <span className="tabular font-medium text-foreground">
              {base > 0 ? `${Math.round((split[s.key] / base) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
      <div className="h-12" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
            <XAxis type="number" hide domain={[0, Math.max(1, base, split.essentials)]} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip content={<TooltipBox />} cursor={false} />
            {visible.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={2}
                radius={
                  visible.length === 1 ? 4 : i === 0 ? [4, 0, 0, 4] : i === visible.length - 1 ? [0, 4, 4, 0] : 0
                }
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Base income {formatINR(base)}: essentials {formatINR(split.essentials)}, savings {formatINR(split.savings)},
        wants {formatINR(split.wants)}.
      </figcaption>
    </figure>
  );
}
