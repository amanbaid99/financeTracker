import { describe, expect, it } from "vitest";
import { priceUpdates } from "@/lib/prices";

const FILE = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
  "",
  "Open Ended Schemes(Other Scheme - Index Funds)",
  "",
  "100001;INF000A01011;-;Sample Index Fund - Direct Growth;25.5;17-Nov-2026",
  "Open Ended Schemes(Other Scheme - Gold ETF)",
  "100002;INF000A01029;-;Sample Gold ETF;113.59;17-Nov-2026",
].join("\n");

const h = (over: Partial<Parameters<typeof priceUpdates>[0][number]>) => ({
  id: "1",
  name: "Fund",
  kind: "mutual_fund",
  value: 1000,
  units: 40,
  isin: "INF000A01011",
  ...over,
});

describe("priceUpdates", () => {
  it("values units at the latest NAV, for funds and gold ETFs", () => {
    const { updates, skipped } = priceUpdates(
      [
        h({}),
        h({
          id: "2",
          kind: "gold",
          units: 10,
          isin: "INF000A01029",
          value: 1000,
        }),
      ],
      FILE,
    );
    expect(skipped).toEqual([]);
    expect(updates.map((u) => [u.id, u.newValue, u.date])).toEqual([
      ["1", 1020, "2026-11-17"],
      ["2", 1136, "2026-11-17"],
    ]);
  });

  it("says what's missing instead of guessing", () => {
    const { updates, skipped } = priceUpdates(
      [
        h({ id: "a", isin: null }),
        h({ id: "b", units: null }),
        h({ id: "c", isin: "INF999Z99999" }),
        h({ id: "d", kind: "epf" }),
      ],
      FILE,
    );
    expect(updates).toEqual([]);
    expect(skipped.map((s) => [s.id, s.reason])).toEqual([
      ["a", "Add its ISIN"],
      ["b", "Add units held"],
      ["c", "No price found for this ISIN"],
    ]);
  });
});
