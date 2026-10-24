// Verifies Row Level Security with two real users against a Supabase project.
// Run against the LOCAL stack only: it creates and deletes users.
//   npm run test:rls
// Needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const run = Date.now();
const emailA = `rls-a-${run}@example.test`;
const emailB = `rls-b-${run}@example.test`;
const password = `pw-${run}-Secret!`;

type Client = SupabaseClient<Database>;
let admin: Client;
let a: Client;
let b: Client;
let idA = "";
let idB = "";

async function signedIn(email: string): Promise<Client> {
  const c = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

beforeAll(async () => {
  if (!anonKey || !secretKey) throw new Error("Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY");
  admin = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
  await admin.from("allowed_emails").insert([{ email: emailA }, { email: emailB }]);
  const ua = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
  const ub = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
  if (ua.error || ub.error) throw ua.error ?? ub.error;
  idA = ua.data.user!.id;
  idB = ub.data.user!.id;
  a = await signedIn(emailA);
  b = await signedIn(emailB);
});

afterAll(async () => {
  for (const id of [idA, idB]) if (id) await admin.auth.admin.deleteUser(id).catch(() => {});
  await admin.from("allowed_emails").delete().in("email", [emailA, emailB]);
});

describe("invite list", () => {
  it("rejects signup for an email not on the list", async () => {
    const { error } = await admin.auth.admin.createUser({
      email: `stranger-${run}@example.test`,
      password,
      email_confirm: true,
    });
    expect(error).toBeTruthy();
  });

  it("users cannot read the invite list", async () => {
    const { data } = await a.from("allowed_emails").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("creates a profile and settings row for each new user", async () => {
    const { data } = await a.from("profiles").select("user_id");
    expect(data).toEqual([{ user_id: idA }]);
  });
});

describe("row level security", () => {
  let streamA = "";
  let goalA = "";
  let holdingA = "";

  beforeAll(async () => {
    const s = await a
      .from("income_streams")
      .insert({ user_id: idA, label: "Salary", type: "stable_salary", amount_monthly: 100000 })
      .select("id")
      .single();
    const g = await a
      .from("goals")
      .insert({ user_id: idA, name: "Retire", type: "retirement", target_today: 1, target_date: "2050-01-01" })
      .select("id")
      .single();
    const h = await a
      .from("holdings")
      .insert({ user_id: idA, kind: "savings", current_value: 50000 })
      .select("id")
      .single();
    if (s.error || g.error || h.error) throw s.error ?? g.error ?? h.error;
    streamA = s.data.id;
    goalA = g.data.id;
    holdingA = h.data.id;
    await a.from("expenses").insert({ user_id: idA, category: "Rent", amount_monthly: 20000 });
    await a.from("liabilities").insert({ user_id: idA, kind: "credit_card", outstanding: 1000 });
    await a.from("insurance_policies").insert({ user_id: idA, kind: "health", source: "personal", cover_amount: 1 });
    await a.from("income_entries").insert({ user_id: idA, stream_id: streamA, month: "2026-09-01", amount: 1 });
    await a.from("goal_allocations").insert({ user_id: idA, goal_id: goalA, holding_id: holdingA, percent: 60 });
    await a.from("consents").insert({ user_id: idA, kind: "privacy_policy", version: "test" });
    await a.from("credit_cards").insert({ user_id: idA, label: "Card", outstanding: 5000 });
    await a.from("planned_expenses").insert({ user_id: idA, name: "Gym", amount: 12000, every_months: 12 });
    await a.from("bill_status").insert({ user_id: idA, month: "2026-10-01", bill_key: "card:x", paid: true });
  });

  const tables = [
    "profiles",
    "settings",
    "consents",
    "income_streams",
    "income_entries",
    "expenses",
    "insurance_policies",
    "liabilities",
    "holdings",
    "goals",
    "goal_allocations",
    "ai_requests",
    "credit_cards",
    "planned_expenses",
    "bill_status",
  ] as const;

  for (const t of tables.filter((x) => x !== "ai_requests")) {
    it(`user A can see their own ${t}`, async () => {
      const { data } = await a.from(t).select("user_id");
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  }

  for (const t of tables) {
    it(`user B cannot read user A's ${t}`, async () => {
      const { data, error } = await b.from(t).select("user_id");
      expect(error).toBeNull();
      expect((data ?? []).filter((r) => r.user_id === idA)).toHaveLength(0);
    });
  }

  it("user A can read their own rows", async () => {
    const { data } = await a.from("holdings").select("id");
    expect(data?.map((r) => r.id)).toContain(holdingA);
  });

  it("anonymous visitors read nothing", async () => {
    const anon = createClient<Database>(url, anonKey, { auth: { persistSession: false } });
    const { data } = await anon.from("goals").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("user B cannot update or delete user A's rows", async () => {
    const up = await b.from("goals").update({ name: "hacked" }).eq("id", goalA).select("id");
    expect(up.data ?? []).toHaveLength(0);
    const del = await b.from("holdings").delete().eq("id", holdingA).select("id");
    expect(del.data ?? []).toHaveLength(0);
    const check = await a.from("goals").select("name").eq("id", goalA).single();
    expect(check.data?.name).toBe("Retire");
  });

  it("user B cannot insert rows owned by user A", async () => {
    const { error } = await b
      .from("expenses")
      .insert({ user_id: idA, category: "Sneaky", amount_monthly: 1 });
    expect(error).toBeTruthy();
  });

  it("user B cannot link their goal to user A's holding", async () => {
    const g = await b
      .from("goals")
      .insert({ user_id: idB, name: "B goal", type: "travel", target_today: 1, target_date: "2030-01-01" })
      .select("id")
      .single();
    const { error } = await b
      .from("goal_allocations")
      .insert({ user_id: idB, goal_id: g.data!.id, holding_id: holdingA, percent: 10 });
    expect(error).toBeTruthy();
  });

  it("a holding cannot be allocated above 100%", async () => {
    const g2 = await a
      .from("goals")
      .insert({ user_id: idA, name: "House", type: "house_down_payment", target_today: 1, target_date: "2032-01-01" })
      .select("id")
      .single();
    const over = await a
      .from("goal_allocations")
      .insert({ user_id: idA, goal_id: g2.data!.id, holding_id: holdingA, percent: 50 });
    expect(over.error?.message).toContain("100");
    const ok = await a
      .from("goal_allocations")
      .insert({ user_id: idA, goal_id: g2.data!.id, holding_id: holdingA, percent: 40 });
    expect(ok.error).toBeNull();
  });

  it("consents are append-only", async () => {
    const up = await a.from("consents").update({ version: "changed" }).eq("user_id", idA).select("id");
    expect(up.error || (up.data ?? []).length === 0).toBeTruthy();
  });

  it("deleting an account removes every row", async () => {
    const { error } = await a.rpc("delete_my_account");
    expect(error).toBeNull();
    for (const t of tables) {
      const { data } = await admin.from(t).select("user_id").eq("user_id", idA);
      expect(data ?? []).toHaveLength(0);
    }
    const { data: user } = await admin.auth.admin.getUserById(idA);
    expect(user.user).toBeNull();
    idA = "";
  });
});
