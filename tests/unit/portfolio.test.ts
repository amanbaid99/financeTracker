import { describe, expect, it } from "vitest";
import { assetClassOf, buildPortfolio } from "@/lib/portfolio";
import type { Investment } from "@/lib/tracker";

const inv = (over: Partial<Investment> & { id: string }): Investment => ({
  kind: "mutual_fund",
  name: null,
  category: "other",
  value: 0,
  monthlySip: 0,
  returnPct: null,
  invested: null,
  ...over,
});

describe("asset classes", () => {
  it.each([
    [{ kind: "mutual_fund", category: "flexi_cap" }, "equity"],
    [{ kind: "stock", category: "direct_equity" }, "equity"],
    [{ kind: "mutual_fund", category: "liquid_fund" }, "debt"],
    [{ kind: "mutual_fund", category: "arbitrage" }, "debt"],
    [{ kind: "fd", category: "fd_rd" }, "debt"],
    [{ kind: "mutual_fund", category: "balanced_advantage" }, "hybrid"],
    [{ kind: "gold", category: "gold" }, "gold"],
    [{ kind: "savings", category: "savings_account" }, "cash"],
    [{ kind: "nps", category: "nps" }, "retirement"],
    [{ kind: "other", category: "other" }, "other"],
  ])("%o is %s", (i, cls) => expect(assetClassOf(i)).toBe(cls));
});

describe("portfolio", () => {
  const p = buildPortfolio([
    inv({ id: "a", name: "Index SIP", category: "equity_index", value: 600_000, invested: 450_000, monthlySip: 10_000 }),
    inv({ id: "b", name: "DSP liquid", category: "liquid_fund", value: 300_000, invested: 290_000 }),
    inv({ id: "c", kind: "stock", category: "direct_equity", value: 100_000 }),
    inv({ id: "d", kind: "savings", category: "savings_account", value: 0 }),
  ]);

  it("totals and splits by asset class in a fixed order", () => {
    expect(p.total).toBe(1_000_000);
    expect(p.monthlySips).toBe(10_000);
    expect(p.classes.map((c) => [c.key, c.value, c.slot])).toEqual([
      ["equity", 700_000, 1],
      ["debt", 300_000, 2],
    ]);
    expect(p.classes[0].share).toBeCloseTo(0.7);
  });

  it("groups by kind of fund, biggest first, and leaves out empty holdings", () => {
    expect(p.kinds.map((k) => k.label)).toEqual(["Equity index fund", "Liquid fund", "Stocks"]);
    expect(p.holdings.map((h) => h.id)).toEqual(["a", "b", "c"]);
  });

  it("shows growth only where the amount invested is known", () => {
    expect(p.holdings[0]).toMatchObject({ gain: 150_000 });
    expect(p.holdings[0].gainPct).toBeCloseTo(1 / 3);
    expect(p.holdings[2].gain).toBeNull();
    expect(p.growth).toMatchObject({ invested: 740_000, value: 900_000, gain: 160_000, known: 2, of: 3 });
  });

  it("is empty with nothing held", () => {
    expect(buildPortfolio([])).toMatchObject({ total: 0, classes: [], holdings: [], growth: null });
  });
});
