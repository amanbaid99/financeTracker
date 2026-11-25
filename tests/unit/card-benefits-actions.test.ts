import { beforeEach, expect, it, vi } from "vitest";
import { emptyBenefits } from "@/lib/card-benefits";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  claims: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: mock.claims },
    from: mock.from,
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("login");
  },
}));
vi.mock("@/lib/dates", () => ({ todayIST: () => "2026-11-25" }));
import {
  saveCard,
  logLoungeVisit,
  deleteLoungeVisit,
} from "@/lib/cards-actions";
const id = "00000000-0000-4000-8000-000000000001";
const input = {
  id,
  label: "My card",
  annualFee: 1000,
  yearStart: null,
  rewards: null,
  benefits: [],
  bestFor: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.claims.mockResolvedValue({ data: { claims: { sub: id } } });
});
it("rejects structured terms without explicit human confirmation before touching storage", async () => {
  expect(
    (await saveCard({ ...input, reviewedBenefits: emptyBenefits() })).ok,
  ).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
});
it("keeps existing reviewed terms during ordinary edits and timestamps confirmed replacement", async () => {
  const update = vi.fn();
  const query = {
    update,
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  };
  update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.select.mockReturnValue(query);
  mock.from.mockReturnValue(query);
  expect((await saveCard(input)).ok).toBe(true);
  expect(update.mock.calls[0][0]).not.toHaveProperty("feature_details");
  expect(
    (
      await saveCard({
        ...input,
        reviewedBenefits: emptyBenefits(),
        humanConfirmed: true,
      })
    ).ok,
  ).toBe(true);
  expect(update.mock.calls[1][0].feature_details).toMatchObject({
    version: 1,
    source: "Card brochure",
  });
  expect(update.mock.calls[1][0].feature_details.reviewedAt).toMatch(/^\d{4}-/);
  expect(query.eq).toHaveBeenCalledWith("user_id", id);
});
it("rejects future visits and unreviewed lounge rules without inserting a log", async () => {
  expect(
    (
      await logLoungeVisit({
        cardId: id,
        ruleId: "l",
        date: "2026-11-26",
        visits: 1,
      })
    ).ok,
  ).toBe(false);
  expect(mock.from).not.toHaveBeenCalled();
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi
      .fn()
      .mockResolvedValue({ data: { feature_details: null }, error: null }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mock.from.mockReturnValue(q);
  expect(
    (
      await logLoungeVisit({
        cardId: id,
        ruleId: "l",
        date: "2026-11-25",
        visits: 1,
      })
    ).ok,
  ).toBe(false);
  expect(mock.from).toHaveBeenCalledTimes(1);
});
it("reports missing visit deletes instead of claiming success", async () => {
  const q = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "not found" } }),
  };
  q.delete.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.select.mockReturnValue(q);
  mock.from.mockReturnValue(q);
  expect((await deleteLoungeVisit(id)).ok).toBe(false);
  expect(q.eq).toHaveBeenCalledWith("user_id", id);
});
