import { describe, expect, it, vi } from "vitest";
import { analyseRadar, technicals, wilderRsi } from "@/lib/radar/analysis";
import {
  IndmoneyProvider,
  csvRows,
  parseHistory,
  parseInstruments,
} from "@/lib/radar/indmoney";
import type { Candle } from "@/lib/radar/contracts";

const candles = (n: number): Candle[] =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    open: 100,
    high: 110,
    low: 90,
    close: 100,
    volume: 1000,
  }));
const inputs = {
  candles: candles(260),
  asset: "equity" as const,
  today: "2026-11-17",
  expectedSession: null,
  adjustmentsVerified: false,
  priceBelow: 101,
  drawdownPct: 5,
};

describe("Radar technical calculations", () => {
  it("matches the published Wilder RSI worked example and handles flat or one-way prices", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28,
    ];
    expect(wilderRsi(closes)).toBeCloseTo(70.464135, 5);
    expect(wilderRsi([...closes, 46.0])).toBeCloseTo(66.249619, 5);
    expect(wilderRsi(Array(15).fill(10))).toBe(50);
    expect(wilderRsi(Array.from({ length: 15 }, (_, i) => i + 1))).toBe(100);
    expect(wilderRsi(Array.from({ length: 15 }, (_, i) => 20 - i))).toBe(0);
    expect(wilderRsi([1, 2])).toBeNull();
  });
  it("uses exact session windows, high prices for drawdowns and 60 log-return sample variance", () => {
    const series = candles(252);
    const metrics = technicals(series, true);
    expect(metrics.sma50).toBe(100);
    expect(metrics.sma200).toBe(100);
    expect(metrics.drawdown252).toBeCloseTo((100 / 110 - 1) * 100);
    expect(metrics.high252).toBe(110);
    expect(metrics.low252).toBe(90);
    expect(metrics.averageTradedValue20).toBe(100000);
    expect(metrics.volatility60).toBe(0);
    const returns = Array.from({ length: 60 }, (_, i) =>
      i % 2 ? -0.01 : 0.01,
    );
    let price = 100;
    const alternating = [
      100,
      ...returns.map((r) => (price *= Math.exp(r))),
    ].map((close, i) => ({
      ...series[i],
      open: close,
      high: close,
      low: close,
      close,
    }));
    expect(technicals(alternating).volatility60).toBeCloseTo(
      Math.sqrt((60 * 0.01 ** 2) / 59) * Math.sqrt(252) * 100,
    );
    expect(technicals(candles(199)).sma200).toBeNull();
    expect(technicals(candles(60)).volatility60).toBeNull();
  });
  it("never substitutes technical prices for the balanced-model inputs", () => {
    for (const asset of ["equity", "gold_etf", "index_etf"] as const) {
      const result = analyseRadar({ ...inputs, asset });
      expect(result.status).toBe("INSUFFICIENT_DATA");
      expect(result.score).toBeNull();
      expect(result.blockers.length).toBeGreaterThanOrEqual(3);
      expect(result.priceRuleMet).toBe(false);
      expect(result.drawdownRuleMet).toBe(false);
    }
  });
  it("rejects malformed, duplicate and unsorted sessions, and excludes unfinished sessions", () => {
    for (const rows of [
      [...candles(1), ...candles(1)],
      candles(3).reverse(),
      [{ ...candles(1)[0], high: 1 }],
    ]) {
      const r = analyseRadar({ ...inputs, candles: rows });
      expect(r.close).toBeNull();
      expect(r.technicals.rsi14).toBeNull();
    }
    const r = analyseRadar({
      ...inputs,
      candles: [
        ...candles(260),
        { ...candles(1)[0], date: inputs.today, close: 105 },
      ],
      expectedSession: "2025-09-17",
      adjustmentsVerified: true,
    });
    expect(r.sessions).toBe(260);
    expect(r.asOf).not.toBe(inputs.today);
  });
  it("keeps thresholds silent on stale or unverified inputs and produces reproducible output", () => {
    expect(analyseRadar(inputs)).toEqual(analyseRadar(inputs));
    expect(
      analyseRadar({
        ...inputs,
        expectedSession: "2026-11-16",
        adjustmentsVerified: true,
      }).priceRuleMet,
    ).toBe(false);
    const result = analyseRadar({
      ...inputs,
      expectedSession: inputs.candles.at(-1)!.date,
      adjustmentsVerified: true,
    });
    expect(result.priceRuleMet).toBe(true);
    expect(result.drawdownRuleMet).toBe(true);
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.inputs.priceBelow).toBe(101);
  });
});

describe("INDmoney adapter", () => {
  const csv =
    'EXCH,SEGMENT,SECURITY_ID,TRADING_SYMBOL,CUSTOM_SYMBOL,ISIN,INSTRUMENT_NAME\r\nNSE,E,100,SYNTHETIC,"Synthetic, research",INE000000001,EQUITY\r\nBSE,E,200,SYNTHETIC,"Synthetic ""research""",INE000000001,EQUITY\r\nNSE,FNO,300,DERIVATIVE,Excluded,\r\n';
  it("parses quoted CSV, preserves exchange identifiers and excludes derivatives", () => {
    expect(parseInstruments("\uFEFF" + csv)).toHaveLength(2);
    expect(parseInstruments(csv)[0].name).toBe("Synthetic, research");
    expect(parseInstruments(csv)[1].name).toBe('Synthetic "research"');
    expect(csvRows('a,b\n"one\ntwo",three')[1][0]).toBe("one\ntwo");
    expect(() => parseInstruments("wrong,header\n1,2")).toThrow(/unsupported/);
    expect(() => csvRows('a,"unfinished')).toThrow();
  });
  it("converts candle epoch seconds into IST session dates and validates OHLC", () => {
    const ts = Date.parse("2026-11-15T20:00:00Z") / 1000;
    const result = parseHistory(
      {
        success: true,
        data: {
          NSE_100: { candles: [{ ts, o: 100, h: 110, l: 90, c: 105, v: 10 }] },
        },
      },
      "NSE_100",
    );
    expect(result[0].date).toBe("2026-11-16");
    expect(() =>
      parseHistory(
        {
          success: true,
          data: {
            NSE_100: { candles: [{ ts, o: 100, h: 50, l: 90, c: 105, v: 10 }] },
          },
        },
        "NSE_100",
      ),
    ).toThrow(/inconsistent/);
    expect(() => parseHistory({ success: true, data: {} }, "NSE_100")).toThrow(
      /No price history/,
    );
  });
  it("only performs fixed GET market calls and never follows redirects or returns credentials", async () => {
    const request = vi.fn().mockResolvedValue(new Response(csv));
    const provider = new IndmoneyProvider("private-token", request);
    await provider.instruments();
    expect(request.mock.calls[0][0].origin).toBe("https://api.indstocks.com");
    expect(request.mock.calls[0][0].pathname).toBe("/market/instruments");
    expect(request.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      cache: "no-store",
    });
    request.mockResolvedValueOnce(
      new Response("private-token", { status: 401 }),
    );
    await expect(provider.instruments()).rejects.toThrow(/expired/);
    request.mockRejectedValueOnce(new Error("private-token"));
    await expect(provider.instruments()).rejects.toThrow(
      "INDmoney could not be reached. Try again later.",
    );
  });
  it("pages daily history into bounded windows and excludes the current day", async () => {
    const code = "NSE_100";
    const body = {
      success: true,
      data: {
        [code]: {
          candles: [
            {
              ts: Date.parse("2026-11-16T03:45:00Z") / 1000,
              o: 100,
              h: 110,
              l: 90,
              c: 105,
              v: 10,
            },
            {
              ts: Date.parse("2026-11-17T03:45:00Z") / 1000,
              o: 100,
              h: 110,
              l: 90,
              c: 105,
              v: 10,
            },
          ],
        },
      },
    };
    const request = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(body)));
    const result = await new IndmoneyProvider("token", request).history(
      { exchange: "NSE", securityId: "100" },
      "2026-11-17",
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-11-16");
    for (const [url, options] of request.mock.calls) {
      expect(
        Number(url.searchParams.get("end_time")) -
          Number(url.searchParams.get("start_time")),
      ).toBeLessThanOrEqual(365 * 86400000);
      expect(url.pathname).toBe("/market/historical/1day");
      expect(options.method).toBe("GET");
    }
  });
  it("rejects conflicting duplicate candles instead of silently choosing a source value", async () => {
    let count = 0;
    const request = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              NSE_100: {
                candles: [
                  {
                    ts: Date.parse("2026-11-16T03:45:00Z") / 1000,
                    o: 100,
                    h: 110,
                    l: 90,
                    c: count++ ? 104 : 105,
                    v: 10,
                  },
                ],
              },
            },
          }),
        ),
    );
    await expect(
      new IndmoneyProvider("token", request).history(
        { exchange: "NSE", securityId: "100" },
        "2026-11-17",
      ),
    ).rejects.toThrow(/Conflicting/);
  });
});
