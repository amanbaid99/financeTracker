import { describe, expect, it } from "vitest";
import { checkPortfolio, majorChanges, orderFindings, reviewFacts } from "@/lib/portfolio-review/checks";
import { trackGoal, type Investment } from "@/lib/tracker";

const today = "2026-10-29";
const fund = (id: string, value: number, category = "equity_index"): Investment => ({ id, name: `Private holding ${id}`, kind: "mutual_fund", category, value, monthlySip: 1000, returnPct: null, invested: null });
const holdings = [fund("a", 50000), fund("b", 50000, "liquid_fund")];
const check = (investments = holdings) => checkPortfolio({ investments, goals: [], links: [], today });

describe("portfolio review checks", () => {
  it("skips AI for a small balance edit, but detects cumulative drift against the reviewed baseline", () => {
    const before = check().snapshot;
    expect(majorChanges(before, check([fund("a", 51000), holdings[1]]).snapshot)).toEqual([]);
    expect(majorChanges(before, check([fund("a", 65000), holdings[1]]).snapshot)).toContain("Portfolio value changed by at least 10%. This may include deposits or withdrawals, not just market movement.");
    expect(majorChanges(null, before)).toHaveLength(1);
  });
  it("detects a newly concentrated stock even if the portfolio total does not change", () => {
    const before = check([fund("a", 19000), fund("b", 81000, "liquid_fund")]).snapshot;
    const after = checkPortfolio({ investments: [{ ...fund("a", 21000), kind: "stock" }, fund("b", 79000, "liquid_fund")], goals: [], links: [], today });
    expect(after.findings.some(f => f.id === "concentration:a")).toBe(true);
    expect(majorChanges(before, after.snapshot)).toContain("A portfolio check changed.");
  });
  it("flags risky holdings for near-term and emergency goals without recommending a sale", () => {
    const goals = ["custom", "emergency_fund"].map((type,n) => trackGoal({ id: `g${n}`, name: "Private goal", type, target: 100000, targetDate: type === "custom" ? "2027-10-29" : null, inflationPct: 0 }, holdings, [{ goalId: `g${n}`, investmentId: "a", percent: 50 }], today));
    const result = checkPortfolio({ investments: holdings, goals, links: [], today });
    expect(result.findings.filter(f => f.id.startsWith("near-term:"))).toHaveLength(2);
    expect(result.findings.find(f => f.id.startsWith("near-term:"))?.next).toContain("new savings");
  });
  it("does not describe an exchange-traded fund as a single company stock", () => {
    const { findings } = check([{ ...fund("a", 100000), name: "My ETF", kind: "stock" }]);
    expect(findings[0].detail).not.toContain("single stock");
    expect(findings[0].evidence.type).toBe("fund");
  });
  it("does not confuse several funds in a category with proven underlying overlap", () => {
    const { findings } = check([fund("a", 100), fund("b", 100), fund("c", 100)]);
    expect(findings.find(f => f.id === "similar:equity_index")?.detail).toContain("not proof");
  });
  it("never sends private names, identifiers, free text or exact amounts to AI", () => {
    const investments = [{ ...fund("private-id", 123456), name: "Secret nickname user@example.test" }];
    const { findings } = check(investments);
    const facts = JSON.stringify(reviewFacts(investments, [], findings, []));
    expect(facts).not.toMatch(/Secret|nickname|private-id|user@example|123456/);
    expect(facts).toContain('"code":"I1"');
    expect(facts).toContain('"check":"concentration"');
  });
  it("accepts only a complete ordering of real findings and preserves urgent checks", () => {
    const findings = check().findings;
    expect(orderFindings('{"order":["F2","F1"]}', findings)?.map(f => f.id)).toEqual([findings[1].id, findings[0].id]);
    for (const text of ['{"order":["F1","F1"]}', '{"order":["F99"]}', '{"order":[],"advice":"buy something"}', 'not json']) {
      expect(orderFindings(text, findings)).toBeNull();
    }
    const urgent = { ...findings[1], priority: "attention" as const };
    expect(orderFindings('{"order":["F1","F2"]}', [findings[0], urgent])?.[0]).toEqual(urgent);
    expect(orderFindings('{"order":[]}', [])).toEqual([]);
  });
  it("notices SIP and holding list changes", () => {
    const before = check().snapshot;
    expect(majorChanges(before, check([{ ...holdings[0], monthlySip: 2000 }, holdings[1]]).snapshot)).toContain("Monthly contributions changed.");
    expect(majorChanges(before, check([holdings[0]]).snapshot)).toContain("The list of holdings changed.");
  });
});
