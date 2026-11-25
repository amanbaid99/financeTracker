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
  saveCardStrategy,
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

it("new card retries reuse the client ID under the authenticated owner", async () => {
  const upsert = vi.fn();
  const q = {
    upsert,
    select: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
  };
  upsert.mockReturnValue(q);
  q.select.mockReturnValue(q);
  mock.from.mockReturnValue(q);
  expect((await saveCard({ ...input, id: null, createId: id })).ok).toBe(true);
  expect((await saveCard({ ...input, id: null, createId: id })).ok).toBe(true);
  expect(upsert.mock.calls.map((c) => c[0])).toEqual([
    expect.objectContaining({ id, user_id: id }),
    expect.objectContaining({ id, user_id: id }),
  ]);
});

it("updates only the owner reminder and guards concurrent changes without renewing issuer review", async () => {
  const previous={...emptyBenefits(),version:1,reviewedAt:"2026-01-01T00:00:00Z",lounges:[{id:"kept",name:"Domestic",visits:1,period:"quarter",conditions:"",evidence:"Confirmed"}]};
  const q={select:vi.fn(),eq:vi.fn(),update:vi.fn(),single:vi.fn()};
  q.select.mockReturnValue(q);q.eq.mockReturnValue(q);q.update.mockReturnValue(q);
  q.single.mockResolvedValueOnce({data:{feature_details:previous},error:null}).mockResolvedValueOnce({data:{id},error:null});
  mock.from.mockReturnValue(q);
  expect((await saveCardStrategy({cardId:id,strategy:{useFor:"Groceries",remember:"My preferred card"}})).ok).toBe(true);
  expect(q.update).toHaveBeenCalledWith({feature_details:{...previous,strategy:{useFor:"Groceries",remember:"My preferred card"}}});
  expect(q.eq).toHaveBeenCalledWith("user_id",id);
  expect(q.eq).toHaveBeenCalledWith("feature_details",JSON.stringify(previous));
  q.single.mockResolvedValueOnce({data:{feature_details:previous},error:null}).mockResolvedValueOnce({data:null,error:{message:"stale"}});
  expect((await saveCardStrategy({cardId:id,strategy:{useFor:"Changed",remember:""}})).ok).toBe(false);
});
