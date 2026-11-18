import { describe, expect, it } from "vitest";
import { evaluateGold, GOLD_MODEL, trackingMetrics, type GoldSources } from "@/lib/radar/gold-model";
import { replayResearch } from "@/lib/radar/paper-replay";
import type { Candle } from "@/lib/radar/contracts";

const isin = "INF000000001";
const dates: string[] = [];
for (let t = Date.parse("2026-11-16T00:00:00Z"); dates.length < 252; t -= 86400000) {
  const date = new Date(t);
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) dates.unshift(date.toISOString().slice(0, 10));
}
const values = dates.map((_, i) => i < 150 ? 100 + i * 0.05 : i < 210 ? 120 - (i - 150) * 0.15 : 110 + Math.sin(i * 1.2));
const candles: Candle[] = dates.map((date, i) => ({ date, open: values[i], close: values[i], high: values[i], low: values[i], volume: 200000 }));
const last = values.at(-1)!;
const sources: GoldSources = {
  isin,
  navHistory: { source: "https://source.invalid/nav", points: dates.map((date, i) => ({ date, value: values[i], availableAt: `${date}T18:00:00+05:30` })) },
  benchmark: { source: "https://source.invalid/gold", basis: "domestic-gold-INR", points: dates.map((date, i) => ({ date, value: values[i] * 1000, availableAt: `${date}T18:00:00+05:30` })) },
};
const input = {
  candles, adjustmentsVerified: true, turnoverBasisVerified: true, sources, isin,
  nav: { isin, nav: last, goldEtf: true, date: "2026-11-16", schemeCode: "123", name: "Synthetic Gold ETF", source: "AMFI" },
  depth: { bid: last * 0.999, ask: last * 1.001, spreadPct: 0.2, marketTime: "2026-11-17T04:29:00Z", timestampVerified: true, fetchedAt: "2026-11-17T04:30:00Z" },
  expectedSession: "2026-11-16", now: "2026-11-17T04:30:00Z",
};

describe("Gold paper model", () => {
  it("produces only a paper candidate from complete dated evidence, with no score or release override", () => {
    const study = evaluateGold(input);
    expect(study.missing).toEqual([]);
    expect(study.risks).toEqual([]);
    expect(study.paperDecision).toBe("Buy candidate");
    expect(study.release).toBe("paper");
    expect(study.version).toBe(GOLD_MODEL.version);
    expect(study).not.toHaveProperty("score");
  });
  it.each([
    ["missing sources", { sources: undefined }],
    ["unverified adjustments", { adjustmentsVerified: false }],
    ["incompatible volume basis", { turnoverBasisVerified: false }],
    ["short history", { candles: candles.slice(1) }],
    ["stale close", { expectedSession: "2026-11-17" }],
    ["missing quote timestamp", { depth: { ...input.depth, timestampVerified: false } }],
    ["future quote", { depth: { ...input.depth, marketTime: "2026-11-17T04:31:00Z" } }],
    ["old quote", { depth: { ...input.depth, marketTime: "2026-11-17T04:00:00Z" } }],
    ["mismatched ISIN", { isin: "INF000000002" }],
    ["invalid NAV", { nav: { ...input.nav, nav: NaN } }],
    ["invalid assessment time", { now: "bad" }],
  ])("blocks decisions for %s", (_, change) => {
    const study = evaluateGold({ ...input, ...change });
    expect(study.paperDecision).toBeNull();
    expect(study.missing.length).toBeGreaterThan(0);
  });
  it("refuses future publication, missing benchmark sessions and inconsistent final NAV", () => {
    for (const changed of [
      { ...sources, navHistory: { ...sources.navHistory, points: sources.navHistory.points.map((p, i) => i === 251 ? { ...p, availableAt: "2026-11-17T05:00:00Z" } : p) } },
      { ...sources, benchmark: { ...sources.benchmark, points: sources.benchmark.points.slice(1) } },
      { ...sources, navHistory: { ...sources.navHistory, points: sources.navHistory.points.map((p, i) => i === 251 ? { ...p, value: p.value + 1 } : p) } },
    ]) expect(evaluateGold({ ...input, sources: changed }).paperDecision).toBeNull();
  });
  it("blocks a long gap rather than treating sparse history as daily returns", () => {
    const move = (points: GoldSources["benchmark"]["points"]) => points.map((p, i) => i < 100 ? {
      ...p,
      date: new Date(Date.parse(p.date) - 30 * 86400000).toISOString().slice(0, 10),
    } : p);
    const study = evaluateGold({ ...input, sources: {
      ...sources,
      benchmark: { ...sources.benchmark, points: move(sources.benchmark.points) },
      navHistory: { ...sources.navHistory, points: move(sources.navHistory.points) },
    } });
    expect(study.paperDecision).toBeNull();
  });
  it("does not accept another currency basis or unsourced benchmark", () => {
    for (const benchmark of [
      { ...sources.benchmark, basis: "gold-USD" },
      { ...sources.benchmark, source: "not-a-source" },
    ]) {
      const study = evaluateGold({ ...input, sources: { ...sources, benchmark } as GoldSources });
      expect(study.paperDecision).toBeNull();
    }
  });
  it("recomputes spread from actual bid/ask instead of trusting a stored percentage", () => {
    const study = evaluateGold({ ...input, depth: { ...input.depth, bid: 100, ask: 102, spreadPct: 0 } });
    expect(study.paperDecision).toBe("Wait");
    expect(study.risks).toContain("The current spread exceeds 0.5%.");
  });
  it("an excessive premium or illiquid trading blocks a paper candidate", () => {
    const premium = evaluateGold({ ...input, candles: candles.map((c, i) => i === 251 ? { ...c, open: last * 1.02, high: last * 1.02, low: last * 1.02, close: last * 1.02 } : c) });
    expect(premium.paperDecision).toBe("Wait");
    expect(premium.risks).toContain("The closing premium exceeds 1%.");
    expect(evaluateGold({ ...input, candles: candles.map((c) => ({ ...c, volume: 100 })) }).paperDecision).toBe("Wait");
  });
  it("rejects duplicate dates and invalid OHLC without reordering or fabricating data", () => {
    for (const bad of [
      candles.map((c, i) => i === 1 ? { ...c, date: candles[0].date } : c),
      candles.map((c, i) => i === 1 ? { ...c, high: 1 } : c),
    ]) expect(evaluateGold({ ...input, candles: bad }).paperDecision).toBeNull();
  });
  it("calculates tracking from return differences independently of price scale", () => {
    const equal = trackingMetrics(values, values.map((v) => v * 1000))!;
    expect(equal.errorPct).toBeCloseTo(0, 10);
    expect(equal.differencePct).toBeCloseTo(0, 10);
    const nav = Array.from({ length: 253 }, (_, i) => 100 * 1.001 ** i);
    const benchmark = Array(253).fill(100);
    expect(trackingMetrics(nav, benchmark)!.differencePct).toBeCloseTo((1.001 ** 252 - 1) * 100, 8);
    expect(trackingMetrics(nav, benchmark)!.errorPct).toBeCloseTo(0, 8);
    expect(trackingMetrics(nav.slice(1), benchmark)).toBeNull();
    expect(trackingMetrics([0], [1])).toBeNull();
  });
});

const bars = (values: number[], first = "2026-11-16") => values.map((value, i) => ({
  date: new Date(Date.parse(`${first}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10),
  open: value, high: value, low: value, close: value, volume: 100,
}));
describe("point-in-time paper replay", () => {
  it("executes the prior signal at the next open with costs and conserves cash", () => {
    const rows = replayResearch({ candles: bars([100, 200, 200]), signals: [{ session: "2026-11-16", availableAt: "2026-11-16T18:00:00+05:30", decision: "Buy candidate" }], initialCash: 10000, monthlyCash: 0, costBps: 0 });
    const model = rows.find((r) => r.strategy === "model")!;
    expect(model.purchases).toBe(1);
    expect(model.cash).toBe(7500);
    expect(model.finalValue).toBe(10000); // No purchase at yesterday's 100 close.
    expect(rows.find((r) => r.strategy === "immediate")!.finalValue).toBe(20000);
  });
  it("does not trade on an unpublished or exactly-at-open signal", () => {
    for (const availableAt of ["2026-11-17T10:00:00+05:30", "2026-11-17T09:15:00+05:30"]) {
      const rows = replayResearch({ candles: bars([100, 200]), signals: [{ session: "2026-11-16", availableAt, decision: "Buy candidate" }], initialCash: 10000, monthlyCash: 0 });
      expect(rows[0].purchases).toBe(0);
      expect(rows[0].cash).toBe(10000);
    }
  });
  it("charges explicit costs and never treats contributions as returns", () => {
    const rows = replayResearch({ candles: bars(Array(35).fill(100), "2026-10-20"), signals: [], initialCash: 10000, monthlyCash: 5000, costBps: 100 });
    expect(rows.every((r) => r.contributed === 15000)).toBe(true);
    const immediate = rows.find((r) => r.strategy === "immediate")!;
    expect(immediate.fees).toBeCloseTo(15000 - 15000 / 1.01, 8);
    expect(immediate.profit).toBeCloseTo(-immediate.fees, 8);
    expect(immediate.maxDrawdownPct).toBeLessThan(2);
    expect(rows[0].maxDrawdownPct).toBe(0);
    expect(rows[0].averageCashPct).toBe(100);
  });
  it("measures a true drawdown independently of fresh contributions", () => {
    const row = replayResearch({ candles: bars([100, 50, 50], "2026-10-31"), signals: [], initialCash: 10000, monthlyCash: 10000, costBps: 0 }).find((r) => r.strategy === "immediate")!;
    expect(row.maxDrawdownPct).toBeCloseTo(50); // The overnight loss occurs before new cash arrives at the open.
  });
  it("rejects duplicate signal dates, pre-close availability, bad bars and invalid costs", () => {
    const signal = { session: "2026-11-16", availableAt: "2026-11-16T18:00:00+05:30", decision: "Wait" as const };
    const base = { candles: bars([100, 100]), signals: [signal], initialCash: 10000, monthlyCash: 0 };
    expect(() => replayResearch({ ...base, signals: [signal, signal] })).toThrow();
    expect(() => replayResearch({ ...base, signals: [{ ...signal, availableAt: "2026-11-16T12:00:00+05:30" }] })).toThrow();
    expect(() => replayResearch({ ...base, candles: bars([100, 0]) })).toThrow();
    expect(() => replayResearch({ ...base, costBps: -1 })).toThrow();
  });
});
