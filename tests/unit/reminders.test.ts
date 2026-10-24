import { describe, expect, it } from "vitest";
import { buildReminders } from "@/lib/reminders";

describe("reminders", () => {
  it("shows renewals due this month or next, never employer cover", () => {
    const r = buildReminders({
      todayISO: "2026-10-24",
      nextAdvanceTaxDate: null,
      insurance: [
        { id: "a", kind: "health", source: "personal", coverAmount: 1, premium: 1, renewalMonth: 11 },
        { id: "b", kind: "term", source: "personal", coverAmount: 1, premium: 1, renewalMonth: 3 },
        { id: "c", kind: "health", source: "employer", coverAmount: 1, premium: null, renewalMonth: 10 },
      ],
    });
    expect(r.map((x) => x.id)).toEqual(["ins-a"]);
    expect(r[0].text).toContain("Nov");
  });

  it("wraps December to January", () => {
    const r = buildReminders({
      todayISO: "2026-12-05",
      nextAdvanceTaxDate: null,
      insurance: [{ id: "a", kind: "health", source: "family", coverAmount: 1, premium: 1, renewalMonth: 1 }],
    });
    expect(r).toHaveLength(1);
  });

  it("shows advance tax within 45 days", () => {
    expect(buildReminders({ todayISO: "2026-11-10", insurance: [], nextAdvanceTaxDate: "2026-12-15" })).toHaveLength(1);
    expect(buildReminders({ todayISO: "2026-10-01", insurance: [], nextAdvanceTaxDate: "2026-12-15" })).toHaveLength(0);
  });
});
