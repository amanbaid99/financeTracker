import { describe, expect, it } from "vitest";
import { describeChanges, type RowState } from "@/lib/statement/changes";
import type { PrepareResult } from "@/lib/statement/actions";

type Ready = Extract<PrepareResult, { ok: true }>;
const ready: Ready = {
  ok: true,
  source: "CAMS",
  detailed: true,
  statementDate: "2026-11-01",
  warnings: [],
  goals: [],
  investments: [
    {
      id: "i",
      name: "My holding",
      isFund: true,
      value: 10000,
      sip: 0,
      category: "equity_index",
      invested: null,
    },
  ],
  rows: [
    {
      key: "r",
      name: "My holding",
      isin: null,
      kind: "mutual_fund",
      category: "equity_index",
      categoryHow: "yours",
      value: 10000,
      invested: 8000,
      sip: null,
      sipFromStatement: false,
      issues: [],
      match: null,
      candidates: [],
      questions: [],
    },
  ],
};
const state: Record<string, RowState> = {
  r: {
    target: "i",
    category: "equity_index",
    sip: null,
    goalId: "",
    matchAnswered: true,
    sipAnswered: true,
  },
};
describe("CAS changes before confirmation", () => {
  it("recognises invested-only changes and missing previous cost", () => {
    const [change] = describeChanges(ready, state);
    expect(change.unchanged).toBe(false);
    expect(change.lines.join(" ")).toContain(
      "Invested amount not recorded → ₹8,000",
    );
  });
  it("preserves cost when absent, and discloses proportional withdrawal adjustments", () => {
    const data = {
      ...ready,
      rows: [{ ...ready.rows[0], invested: null, value: 5000 }],
      investments: [{ ...ready.investments[0], invested: 8000 }],
    };
    expect(describeChanges(data, state)[0].lines.join(" ")).not.toContain(
      "→ ₹4,000",
    );
    expect(
      describeChanges(data, {
        r: { ...state.r, withdrew: true },
      })[0].lines.join(" "),
    ).toContain("₹8,000 → ₹4,000 (adjusted for withdrawal)");
  });
  it("shows current and invested amounts on new holdings", () => {
    const [change] = describeChanges(ready, {
      r: { ...state.r, target: "new" },
    });
    expect(change.lines).toContain("Current amount ₹10,000");
    expect(change.lines).toContain("Invested amount ₹8,000");
  });
  it("keeps unchanged imports distinct from invested-only changes", () => {
    expect(
      describeChanges(
        {
          ...ready,
          investments: [{ ...ready.investments[0], invested: 8000 }],
        },
        state,
      )[0].unchanged,
    ).toBe(true);
  });
});
