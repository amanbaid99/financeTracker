import { describe, expect, it, vi } from "vitest";
import {
  amfiDate,
  fetchAmfiNav,
  parseAmfiNav,
  parseDepth,
  type EtfEvidence,
} from "@/lib/radar/etf-data";
import { previousCompletedSession } from "@/lib/radar/calendar";
import {
  ruleSettingsSchema,
  ruleSignal,
  type RuleSettings,
} from "@/lib/radar/rule-signal";
import { analyseRadar } from "@/lib/radar/analysis";
const isin = "INF000000001";
const header =
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date";
const text = `${header}\nOpen Ended Schemes(Other Scheme - Gold ETF)\n123;${isin};-;Synthetic Gold ETF;;;100.1256;16-Nov-2026\n`;
const today = "2026-11-17",
  now = "2026-11-17T04:30:00Z",
  expectedSession = "2026-11-16";
const rules: RuleSettings = {
  rulesEnabled: true,
  holdingConfirmed: false,
  priceBelow: 110,
  drawdownPct: null,
  sellAbove: null,
  sellBelow: null,
};
const analysis = analyseRadar({
  candles: [
    {
      date: expectedSession,
      open: 100,
      high: 110,
      low: 90,
      close: 100,
      volume: 1000,
    },
  ],
  asset: "gold_etf",
  today,
  expectedSession,
  adjustmentsVerified: false,
  priceBelow: 110,
  drawdownPct: null,
});
const evidence: EtfEvidence = {
  nav: {
    isin,
    schemeCode: "123",
    name: "Synthetic",
    nav: 100,
    date: expectedSession,
    goldEtf: true,
    source: "AMFI",
  },
  depth: {
    bid: 99.9,
    ask: 100.1,
    spreadPct: 0.2,
    marketTime: "2026-11-17T04:29:00Z",
    timestampVerified: true,
    fetchedAt: now,
  },
  errors: [],
};
const input = {
  analysis,
  rules,
  asset: "equity" as const,
  expectedSession,
  now,
};

describe("official NAV and market depth", () => {
  it("matches by ISIN in the current feed, preserves decimal NAV and detects Gold ETF category", () => {
    const nav = parseAmfiNav(text, isin);
    expect(nav?.nav).toBe(100.1256);
    expect(nav?.goldEtf).toBe(true);
    expect(nav?.date).toBe(expectedSession);
    expect(parseAmfiNav(text, "INF000000002")).toBeNull();
  });
  it("supports the old six-column feed and never picks a fund of fund by name", () => {
    const old = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\nOpen Ended Schemes(Other Scheme - Fund of Funds)\n123;${isin};-;Synthetic Gold Fund of Fund;99.1234;16-Nov-2026`;
    expect(parseAmfiNav(old, isin)?.nav).toBe(99.1234);
    expect(parseAmfiNav(old, isin)?.goldEtf).toBe(false);
  });
  it("rejects impossible dates, duplicate ISIN matches and malformed NAV", () => {
    expect(amfiDate("31-Feb-2026")).toBeNull();
    expect(amfiDate("29-Feb-2024")).toBe("2024-02-29");
    expect(amfiDate("16-Nope-2026")).toBeNull();
    expect(() =>
      parseAmfiNav(text + `456;${isin};-;Other;;;101;16-Nov-2026`, isin),
    ).toThrow(/more than one/);
    expect(() => parseAmfiNav(text.replace("100.1256", "N.A."), isin)).toThrow(
      /invalid/,
    );
  });
  it("does not forward credentials or private names to the public NAV source", async () => {
    const request = vi.fn().mockResolvedValue(new Response(text));
    await fetchAmfiNav(isin, request);
    expect(request.mock.calls[0][0]).toBe(
      "https://portal.amfiindia.com/spages/NAVAll.txt",
    );
    expect(request.mock.calls[0][1].headers).toBeUndefined();
  });
  it("does not leak a failed request or substitute stale NAV", async () => {
    const request = vi.fn().mockRejectedValue(new Error("private-token"));
    await expect(fetchAmfiNav(isin, request)).rejects.toThrow(
      "AMFI NAV could not be reached. Try again later.",
    );
  });
  it("calculates spread but leaves freshness unverified when quote time is absent", () => {
    const body = {
      status: "success",
      data: {
        NSE_123: {
          market_depth: {
            depth: [
              {
                buy: { price: "99.90", quantity: "1,000" },
                sell: { price: "100.10", quantity: "20" },
              },
            ],
          },
        },
      },
    };
    const depth = parseDepth(body, "NSE_123", now);
    expect(depth.spreadPct).toBeCloseTo(0.2);
    expect(depth.marketTime).toBeNull();
    expect(depth.fetchedAt).toBe(now);
    const crossed = structuredClone(body);
    crossed.data.NSE_123.market_depth.depth[0].buy.price = "101";
    expect(() => parseDepth(crossed, "NSE_123", now)).toThrow(/crossed/);
  });
});
describe("completed NSE session calendar", () => {
  it("handles ordinary days, holidays, weekends and the special Muhurat session", () => {
    expect(previousCompletedSession("2026-11-17", "NSE")).toBe("2026-11-16");
    expect(previousCompletedSession("2026-11-16", "NSE")).toBe("2026-11-13");
    expect(previousCompletedSession("2026-11-25", "NSE")).toBe("2026-11-23");
    expect(previousCompletedSession("2026-12-28", "NSE")).toBe("2026-12-24");
    expect(previousCompletedSession("2026-11-09", "NSE")).toBe("2026-11-08");
  });
  it("supports the verified BSE calendar and does not guess an unverified year", () => {
    expect(previousCompletedSession(today, "BSE")).toBe("2026-11-16");
    expect(previousCompletedSession("2027-01-04", "NSE")).toBeNull();
  });
});
describe("explicit price-rule signals", () => {
  it("keeps opt-in off until the owner explicitly enables rules", () => {
    expect(
      ruleSignal({ ...input, rules: { ...rules, rulesEnabled: false } }).label,
    ).toBe("No signal");
  });
  it("returns a Buy price trigger with its date and keeps the research score empty", () => {
    expect(ruleSignal(input).label).toBe("Buy");
    expect(ruleSignal(input).asOf).toBe(expectedSession);
    expect(analysis.score).toBeNull();
    expect(analysis.status).toBe("INSUFFICIENT_DATA");
  });
  it("blocks price triggers when current completed-session prices or calendar are missing", () => {
    expect(ruleSignal({ ...input, expectedSession: "2026-11-13" }).label).toBe(
      "No signal",
    );
    expect(ruleSignal({ ...input, expectedSession: null }).label).toBe(
      "No signal",
    );
    expect(ruleSignal({ ...input, analysis: null }).label).toBe("No signal");
  });
  it("never emits Sell for an unconfirmed holding and validates exit order", () => {
    expect(
      ruleSettingsSchema.safeParse({ ...rules, sellAbove: 99 }).success,
    ).toBe(false);
    expect(
      ruleSignal({ ...input, rules: { ...rules, sellAbove: 99 } }).label,
    ).toBe("No signal");
    expect(
      ruleSettingsSchema.safeParse({
        ...rules,
        holdingConfirmed: true,
        sellAbove: 90,
        sellBelow: 100,
      }).success,
    ).toBe(false);
  });
  it("prioritises explicit upper or lower exit rules over buy and hold", () => {
    expect(
      ruleSignal({
        ...input,
        rules: { ...rules, holdingConfirmed: true, sellAbove: 100 },
      }).label,
    ).toBe("Sell");
    expect(
      ruleSignal({
        ...input,
        rules: { ...rules, holdingConfirmed: true, sellBelow: 100 },
      }).label,
    ).toBe("Sell");
  });
  it("uses Hold only for confirmed ownership with untriggered exits, otherwise Wait", () => {
    expect(
      ruleSignal({
        ...input,
        rules: {
          ...rules,
          holdingConfirmed: true,
          priceBelow: null,
          sellAbove: 110,
          sellBelow: 90,
        },
      }).label,
    ).toBe("Hold");
    expect(
      ruleSignal({ ...input, rules: { ...rules, priceBelow: 90 } }).label,
    ).toBe("Wait");
  });
  it("does not fire drawdown rules on unverified adjustments", () => {
    const result = ruleSignal({
      ...input,
      rules: { ...rules, priceBelow: null, drawdownPct: 5 },
    });
    expect(result.label).toBe("Wait");
    expect(result.checks.join(" ")).toContain("paused");
  });
  it("gates ETF entries on aligned NAV, identified Gold ETF and a timestamped spread", () => {
    const gold = { ...input, asset: "gold_etf" as const, evidence };
    expect(ruleSignal(gold).label).toBe("Buy");
    for (const bad of [
      { ...evidence, nav: null },
      { ...evidence, nav: { ...evidence.nav!, date: "2026-11-13" } },
      { ...evidence, nav: { ...evidence.nav!, goldEtf: false } },
      { ...evidence, depth: { ...evidence.depth!, marketTime: null } },
      {
        ...evidence,
        depth: { ...evidence.depth!, marketTime: "2026-11-17T04:00:00Z" },
      },
      {
        ...evidence,
        depth: { ...evidence.depth!, marketTime: "2026-11-17T04:31:00Z" },
      },
    ])
      expect(ruleSignal({ ...gold, evidence: bad }).label).toBe("Wait");
  });
  it("blocks high premiums, implausible discounts and wide spreads", () => {
    const gold = { ...input, asset: "gold_etf" as const, evidence };
    expect(
      ruleSignal({
        ...gold,
        evidence: { ...evidence, nav: { ...evidence.nav!, nav: 98 } },
      }).label,
    ).toBe("Wait");
    expect(
      ruleSignal({
        ...gold,
        evidence: { ...evidence, nav: { ...evidence.nav!, nav: 200 } },
      }).label,
    ).toBe("Wait");
    expect(
      ruleSignal({
        ...gold,
        evidence: { ...evidence, depth: { ...evidence.depth!, spreadPct: 1 } },
      }).label,
    ).toBe("Wait");
  });
});
