import { describe, expect, it } from "vitest";
import {
  amountsIn,
  combine,
  type Extracted,
  foundIn,
  maskPersonal,
  needsTieBreak,
  parseExtraction,
} from "@/lib/card-extract";

const DOC = `TravelOne Credit Card. Joining and annual fee: Rs 4,999 + GST.
Annual fee waived on spends of Rs 8 lakh in a card year.
Earn 4 reward points per Rs 100 spent on travel.
Milestone: spend Rs 12,00,000 in a card year and get 10,000 bonus points.
6 complimentary domestic lounge visits a year.`;

const reading = (over: Partial<Extracted> = {}): Extracted => ({
  cardName: "TravelOne Credit Card",
  annualFee: 4999,
  rewards: "4 reward points per Rs 100 spent on travel",
  benefits: ["6 complimentary domestic lounge visits a year"],
  milestones: [
    { name: "Annual fee waiver", target: 800000, period: "card_year", reward: "Annual fee waived" },
    { name: "Milestone bonus", target: 1200000, period: "card_year", reward: "10,000 bonus points" },
  ],
  bestFor: ["travel"],
  ...over,
});

describe("amountsIn", () => {
  it("understands commas, lakh and k", () => {
    const a = amountsIn("Rs 12,00,000 or 8 lakh or 1.5 lakh or 10k, 0.25 a point");
    for (const n of [1200000, 800000, 150000, 10000, 0.25]) expect(a.has(n)).toBe(true);
  });
});

describe("parseExtraction", () => {
  it("cleans the AI's JSON and drops what doesn't fit", () => {
    const e = parseExtraction(
      'Here: {"card_name":"X","annual_fee":"₹4,999","benefits":["a","a",""],"milestones":[{"name":"Fee","target":"8,00,000","period":"yearly"},{"name":"bad"}],"best_for":["travel","casino"]}',
    )!;
    expect(e.annualFee).toBe(4999);
    expect(e.benefits).toEqual(["a"]);
    expect(e.milestones).toEqual([{ name: "Fee", target: 800000, period: "card_year", reward: null }]);
    expect(e.bestFor).toEqual(["travel"]);
    expect(parseExtraction("no json")).toBeNull();
  });
});

describe("combine", () => {
  it("confirms facts two readings agree on and the document states", () => {
    const r = combine([reading(), reading()], DOC);
    expect(r.annualFee).toMatchObject({ value: 4999, check: "confirmed" });
    expect(r.milestones.map((m) => m.check)).toEqual(["confirmed", "confirmed"]);
    expect(r.benefits[0].check).toBe("confirmed");
    expect(r.bestFor[0]).toMatchObject({ value: "travel", check: "confirmed" });
  });

  it("flags a made-up fact even when both readings say it", () => {
    const fake = reading({ benefits: ["Free golf rounds every month"], annualFee: 2999 });
    const r = combine([fake, fake], DOC);
    expect(r.benefits[0].check).toBe("check");
    expect(r.annualFee).toMatchObject({ value: 2999, check: "check" });
  });

  it("flags disagreement, and a third reading settles it", () => {
    const b = reading({ annualFee: 2999 });
    expect(combine([reading(), b], DOC).annualFee?.check).toBe("check");
    expect(needsTieBreak([reading(), b])).toBe(true);
    expect(combine([reading(), b, reading()], DOC).annualFee).toMatchObject({ value: 4999, check: "confirmed" });
  });

  it("keeps facts only one reading found, marked for checking", () => {
    const r = combine([reading(), reading({ benefits: [] })], DOC);
    expect(r.benefits[0].check).toBe("check");
  });

  it("with a single reading nothing is confirmed", () => {
    const r = combine([reading()], DOC);
    expect(r.annualFee?.check).toBe("check");
    expect(r.readings).toBe(1);
  });
});

describe("foundIn", () => {
  it("needs the same numbers", () => {
    expect(foundIn("6 complimentary domestic lounge visits a year", DOC)).toBe(true);
    expect(foundIn("8 complimentary domestic lounge visits a year", DOC)).toBe(false);
  });
});

describe("maskPersonal", () => {
  it("masks card numbers, emails and phones but keeps amounts", () => {
    expect(maskPersonal("4111 1111 1111 1111 a@b.co 9876543210 Rs 12,00,000")).toBe(
      "[number] [email] [phone] Rs 12,00,000",
    );
  });
});
