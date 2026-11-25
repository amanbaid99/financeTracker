import { ChevronDown, Compass } from "lucide-react";
import type { Card } from "@/lib/cards";
import { cardSpendGuide } from "@/lib/card-strategy";

const SPENDS: Record<string, string> = {
  Amazon: "Amazon online",
  "Other online": "Other online",
  "Pay through PhonePe": "Bills via PhonePe",
  "Swiggy & Zomato": "Swiggy / Zomato",
  "Flights & foreign spends": "Travel / forex",
  "Other eligible spends": "Offline / big buys",
  "Merchant Scan & Pay": "Merchant UPI",
};
function cardBadge(name: string): { name: string; color: string } {
  const n = name.toLowerCase();
  if (n.includes("phonepe"))
    return { name: "SBI PhonePe", color: "bg-blue-950 text-white" };
  if (n.includes("amazon"))
    return { name: "Amazon ICICI", color: "bg-black text-white" };
  if (n.includes("millennia"))
    return { name: "Millennia", color: "bg-sky-200 text-sky-950" };
  if (n.includes("travelone"))
    return { name: "HSBC", color: "bg-neutral-700 text-white" };
  return { name, color: "bg-muted text-foreground" };
}

export function CardStrategy({ cards }: { cards: Card[] }) {
  const rows = cardSpendGuide(cards).flatMap((g) => g.rows);
  if (!rows.length) return null;
  const hasEstimate = rows.some((r) => r.reason.startsWith("≈"));
  return (
    <section
      aria-label="Card strategy"
      className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm"
    >
      <details className="group/strategy">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 bg-primary-soft/50 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Compass className="size-4 text-primary" aria-hidden />
          <h2 className="flex-1">Which card to use</h2>
          <ChevronDown
            className="size-4 text-primary transition-transform group-open/strategy:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="px-3">
          <table className="w-full table-fixed text-left text-xs">
            <caption className="sr-only">
              Your card choices by spend type
            </caption>
            <thead>
              <tr className="text-[11px] font-normal text-muted-foreground">
                <th scope="col" className="w-[42%] py-2 pl-1 font-normal">
                  Spend
                </th>
                <th scope="col" className="w-[37%] py-2 font-normal">
                  Card
                </th>
                <th
                  scope="col"
                  className="w-[21%] py-2 pr-1 text-right font-normal"
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row) => {
                const badge = cardBadge(row.cardName);
                const estimate = row.reason.startsWith("≈");
                const value = row.reason.match(/≈?[\d.]+%/)?.[0] ?? row.reason;
                return (
                  <tr key={`${row.cardId}-${row.label}`}>
                    <th
                      scope="row"
                      className="py-3 pl-1 pr-2 font-medium leading-snug"
                    >
                      {SPENDS[row.label] ?? row.label}
                    </th>
                    <td className="py-3 pr-1">
                      <span
                        title={row.cardName}
                        aria-label={row.cardName}
                        className={`inline-block rounded-md px-1.5 py-1 text-[11px] font-medium leading-snug ${badge.color}`}
                      >
                        {badge.name}
                      </span>
                    </td>
                    <td
                      className="tabular py-3 pr-1 text-right font-semibold"
                      aria-label={row.reason}
                    >
                      {value}
                      {estimate ? "*" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasEstimate && (
            <p className="border-t border-border/50 py-2 text-[10px] text-muted-foreground">
              *HSBC: estimated Accor value at ₹1.80/point.
            </p>
          )}
          <details className="border-t border-border/50">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-[11px] text-muted-foreground [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-3" aria-hidden />
              Caps & conditions
            </summary>
            <ul className="space-y-2 pb-3 text-xs leading-relaxed text-muted-foreground">
              {rows.map((r) => (
                <li key={`${r.cardId}-${r.label}`}>
                  <span className="font-medium text-foreground">
                    {SPENDS[r.label] ?? r.label}:{" "}
                  </span>
                  {r.limit}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </details>
    </section>
  );
}
