import { describe, expect, it } from "vitest";
import { buildPortfolio } from "@/lib/portfolio";
import { editedDate, visibleHoldings } from "@/lib/portfolio-view";

const holdings = buildPortfolio([
  {
    id: "a",
    name: "Index savings",
    kind: "mutual_fund",
    category: "equity_index",
    value: 900,
    invested: 1000,
    monthlySip: 0,
    returnPct: null,
  },
  {
    id: "b",
    name: "Cash savings",
    kind: "savings",
    category: "savings_account",
    value: 2000,
    monthlySip: 0,
    returnPct: null,
  },
  {
    id: "c",
    name: "Growth savings",
    kind: "stock",
    category: "direct_equity",
    value: 1500,
    invested: 1000,
    monthlySip: 100,
    returnPct: null,
  },
]).holdings;

describe("portfolio filters and ordering", () => {
  it("intersects asset and word filters, including categories and case", () => {
    expect(
      visibleHoldings(holdings, "  SAVINGS index ", "equity", "value").map(
        (h) => h.id,
      ),
    ).toEqual(["a"]);
    expect(visibleHoldings(holdings, "cash", "equity", "value")).toEqual([]);
    expect(
      visibleHoldings(holdings, "stocks", null, "value").map((h) => h.id),
    ).toEqual(["c"]);
  });
  it("puts unknown returns after losses when sorting by growth", () => {
    expect(
      visibleHoldings(holdings, "", null, "growth").map((h) => h.id),
    ).toEqual(["c", "a", "b"]);
  });
  it("sorts by name or value without changing the source or portfolio shares", () => {
    const before = JSON.stringify(holdings);
    expect(
      visibleHoldings(holdings, "", null, "name").map((h) => h.id),
    ).toEqual(["b", "c", "a"]);
    expect(
      visibleHoldings(holdings, "", null, "value").map((h) => h.id),
    ).toEqual(["b", "c", "a"]);
    expect(JSON.stringify(holdings)).toBe(before);
    expect(visibleHoldings(holdings, "", "equity", "value")[0].share).toBe(
      holdings.find((h) => h.id === "c")!.share,
    );
  });
});

describe("record edit dates", () => {
  it("uses IST when the UTC date is still the day before", () => {
    expect(editedDate("2026-11-02T20:00:00Z")).toBe("3 Nov 2026");
  });
  it("does not invent missing dates", () => {
    expect(editedDate(undefined)).toBeNull();
    expect(editedDate("invalid")).toBeNull();
  });
});
