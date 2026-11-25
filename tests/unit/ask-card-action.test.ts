import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  from: vi.fn(),
  loadCards: vi.fn(),
  loadGoals: vi.fn(),
  settings: vi.fn(),
  router: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: mock.from,
  }),
}));
vi.mock("@/lib/data", () => ({
  loadCards: mock.loadCards,
  loadGoals: mock.loadGoals,
  loadBudget: vi.fn(),
}));
vi.mock("@/lib/ai/openrouter", () => ({ openRouterSettings: mock.settings }));
vi.mock("@/lib/ai/router", () => ({ sharedRouter: mock.router }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw Error("sign in");
  },
}));
import { askQuestion } from "@/lib/ask/actions";
import { emptyBenefits } from "@/lib/card-benefits";
beforeEach(() => {
  vi.clearAllMocks();
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ai_enabled: true } }),
  };
  mock.from.mockReturnValue(q);
  mock.loadCards.mockResolvedValue({
    today: "2026-11-25",
    cards: [
      {
        id: "a",
        label: "Private card name",
        annualFee: 500,
        yearStart: null,
        rewards: null,
        bestFor: [],
        benefits: [],
        milestones: [],
        bills: [],
        featureDetails: {
          ...emptyBenefits(),
          version: 1,
          reviewedAt: "2026-11-25T00:00:00Z",
          rewardRules: [
            {
              id: "r",
              category: "groceries",
              cashbackBps: 300,
              cap: 100,
              conditions: "Supermarkets only",
              evidence: "3%",
            },
          ],
        },
      },
    ],
  });
});
it("answers card arithmetic before model setup, quota queries or goal planning", async () => {
  const res = await askQuestion([
    { role: "user", content: "Which card for ₹5,000 on groceries?" },
  ]);
  expect(res.ok).toBe(true);
  if (res.ok) {
    expect(res.coded).toContain("₹100");
    expect(res.coded).not.toContain("Private card name");
    expect(res.shown).toContain("Private card name");
  }
  expect(mock.settings).not.toHaveBeenCalled();
  expect(mock.router).not.toHaveBeenCalled();
  expect(mock.loadGoals).not.toHaveBeenCalled();
  expect(mock.from).not.toHaveBeenCalled();
});
it("amount-only card follow-ups do not ask whether spending is monthly investing", async () => {
  const res = await askQuestion([
    { role: "user", content: "Which card for groceries?" },
    { role: "assistant", content: "How much?" },
    { role: "user", content: "₹5,000" },
  ]);
  expect(res.ok && res.shown).toContain("₹100");
  expect(mock.loadGoals).not.toHaveBeenCalled();
});
it("retains the existing AI consent requirement for broader money questions", async () => {
  mock.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { ai_enabled: false } }),
  });
  expect(
    (
      await askQuestion([
        { role: "user", content: "Am I on track for my goals?" },
      ])
    ).ok,
  ).toBe(false);
  expect(mock.loadCards).not.toHaveBeenCalled();
});
