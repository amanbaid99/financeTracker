import { describe, expect, it } from "vitest";
import { mergeConfig } from "@/lib/engine/config";
import { orderDebts, simulatePayoff } from "@/lib/engine/debt";
import type { Liability } from "@/lib/engine/types";
import { TODAY } from "./fixtures";

const cfg = mergeConfig();
const debt = (id: string, outstanding: number, rate: number | null, emi: number | null, kind: Liability["kind"] = "personal_loan"): Liability => ({
  id,
  kind,
  outstanding,
  interestRate: rate,
  emi,
});

describe("debt order", () => {
  const debts = [debt("a", 90_000, 14, 0), debt("b", 10_000, 12, 0), debt("c", 40_000, 36, 0)];
  it("snowball: smallest balance first", () => {
    expect(orderDebts(debts, "snowball", cfg).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });
  it("avalanche: highest rate first", () => {
    expect(orderDebts(debts, "avalanche", cfg).map((d) => d.id)).toEqual(["c", "a", "b"]);
  });
});

describe("payoff simulation", () => {
  it("clears a zero-interest debt with extra payments", () => {
    const p = simulatePayoff({
      debts: [debt("a", 12_000, 0, 0)],
      isCostly: () => true,
      extraMonthly: 1_000,
      method: "snowball",
      todayISO: TODAY,
      cfg,
    });
    expect(p.rows[0].clearedInMonths).toBe(12);
    expect(p.costlyFreeInMonths).toBe(12);
    expect(p.totalInterest).toBe(0);
  });

  it("snowball rolls a cleared EMI into the next debt", () => {
    const run = (method: "snowball" | "avalanche") =>
      simulatePayoff({
        debts: [debt("small", 10_000, 12, 1_000), debt("big", 100_000, 18, 2_000)],
        isCostly: () => true,
        extraMonthly: 3_000,
        method,
        todayISO: TODAY,
        cfg,
      });
    const snow = run("snowball");
    expect(snow.rows[0].id).toBe("small");
    expect(snow.rows[0].clearedInMonths!).toBeLessThan(snow.rows[1].clearedInMonths!);
    // Avalanche saves some interest; snowball clears the first debt sooner.
    const ava = run("avalanche");
    expect(ava.totalInterest).toBeLessThanOrEqual(snow.totalInterest);
    expect(snow.rows.find((r) => r.id === "small")!.clearedInMonths!).toBeLessThan(
      ava.rows.find((r) => r.id === "small")!.clearedInMonths!,
    );
  });

  it("low-rate loans only get their EMI; extra goes to costly debt", () => {
    const p = simulatePayoff({
      debts: [debt("home", 1_000_000, 8.5, 12_000, "home"), debt("card", 30_000, 36, 0, "credit_card")],
      isCostly: (l) => l.kind === "credit_card",
      extraMonthly: 10_000,
      method: "snowball",
      todayISO: TODAY,
      cfg,
    });
    expect(p.rows[0]).toMatchObject({ id: "card", costly: true });
    expect(p.rows[0].clearedInMonths).toBeLessThanOrEqual(4);
    expect(p.rows[1]).toMatchObject({ id: "home", costly: false });
    expect(p.rows[1].clearedInMonths).toBeGreaterThan(100);
  });

  it("a card with no rate assumes 36% and is never cleared without payments", () => {
    const p = simulatePayoff({
      debts: [debt("card", 30_000, null, 0, "credit_card")],
      isCostly: () => true,
      extraMonthly: 0,
      method: "snowball",
      todayISO: TODAY,
      cfg,
      maxMonths: 120,
    });
    expect(p.rows[0].rateAssumed).toBe(true);
    expect(p.rows[0].ratePct).toBe(36);
  });
});
