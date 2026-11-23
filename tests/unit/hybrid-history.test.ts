import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261122161904_hybrid_goal_allocation.sql",
    import.meta.url,
  ),
  "utf8",
);
const existing = readFileSync(
  new URL(
    "../../supabase/migrations/20261024000000_phase1_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  g = "00000000-0000-4000-8000-000000000003",
  h = "00000000-0000-4000-8000-000000000004";
it("saves a plan atomically under owner RLS, rejects stale and foreign inputs, and preserves history", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;insert into auth.users values('${a}'),('${b}');
 create table public.profiles(user_id uuid primary key references auth.users(id) on delete cascade,plan_monthly bigint,plan_lump_sum bigint,plan_sip_minimums jsonb);
 create table public.goals(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,target bigint);
 create table public.holdings(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,current_value bigint);
 create table public.goal_allocations(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,goal_id uuid references goals(id) on delete cascade,holding_id uuid references holdings(id) on delete cascade,percent numeric(5,2) check(percent>0 and percent<=100),unique(goal_id,holding_id));
 insert into profiles(user_id) values('${a}'),('${b}');insert into goals values('${g}','${a}',10000);insert into holdings values('${h}','${a}',5000);`);
    for (const table of [
      "budget_ratio_plans",
      "expenses",
      "income_streams",
      "loans",
      "loan_payments",
      "goal_bills",
    ])
      await db.exec(
        `create table public.${table}(id uuid primary key default gen_random_uuid(),user_id uuid default auth.uid() references auth.users(id) on delete cascade);`,
      );
    for (const table of [
      "profiles",
      "goals",
      "holdings",
      "goal_allocations",
      "budget_ratio_plans",
      "expenses",
      "income_streams",
      "loans",
      "loan_payments",
      "goal_bills",
    ])
      await db.exec(
        `alter table public.${table} enable row level security;create policy owner on public.${table} to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));grant select,insert,update,delete on public.${table} to authenticated;`,
      );
    // Budget uses user_id as its key in the production schema.
    await db.exec("alter table budget_ratio_plans drop column id");
    await db.exec(
      existing.slice(
        existing.indexOf(
          "create or replace function public.check_goal_allocation()",
        ),
        existing.indexOf(
          "create or replace function public.check_income_entry()",
        ),
      ),
    );
    await db.exec(migration);
    await db.exec(
      readFileSync(
        new URL(
          "../../supabase/migrations/20261122163637_hybrid_risk_revision.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}'`);
    const revision = async () =>
      (await db.query<{ r: string }>("select public.hybrid_input_revision() r"))
        .rows[0].r;
    const source = async () =>
      (
        await db.query<{ r: string }>(
          "select public.hybrid_source_revision() r",
        )
      ).rows[0].r;
    const rev = await revision(),
      src = await source();
    const save = (revision: string, links: unknown[], monthly = 1000) =>
      db.query(
        "select public.confirm_hybrid_plan($1,$2::jsonb,$3::jsonb,$4::jsonb,$5,0,'{}') id",
        [
          revision,
          JSON.stringify({ sourceRevision: src }),
          JSON.stringify({
            strategy: "hybrid",
            engineVersion: "test",
            totalMonthlyAllocated: monthly,
          }),
          JSON.stringify(links),
          monthly,
        ],
      );
    const first = await save(rev, [
      { goalId: g, investmentId: h, percent: 100 },
    ]);
    expect(first.rows).toHaveLength(1);
    const original = (
      await db.query<{ id: string }>("select * from allocation_plans")
    ).rows;
    expect(original).toHaveLength(1);
    await db.exec("update holdings set current_value=4000");
    await expect(save(rev, [])).rejects.toThrow(/changed/);
    const fresh = await revision();
    await expect(
      save(fresh, [{ goalId: g, investmentId: h, percent: 101 }]),
    ).rejects.toThrow();
    expect(
      (await db.query("select percent from goal_allocations")).rows,
    ).toEqual([{ percent: "100.00" }]);
    await save(fresh, [{ goalId: g, investmentId: h, percent: 50 }]);
    expect(
      (await db.query("select * from allocation_plans order by created_at,id"))
        .rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query("select * from allocation_plans where id=$1", [
          original[0].id,
        ])
      ).rows,
    ).toEqual(original);
    await expect(
      db.exec("update allocation_plans set engine_version='changed'"),
    ).rejects.toThrow();
    await expect(db.exec("delete from allocation_plans")).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub='${b}'`);
    expect((await db.query("select * from allocation_plans")).rows).toEqual([]);
    await expect(
      db.exec(
        `insert into allocation_plans(user_id,engine_version,input_revision,inputs,result) values('${a}','bad','bad','{}','{}')`,
      ),
    ).rejects.toThrow();
    await db.exec("reset role;set role anon");
    await expect(
      db.query("select public.hybrid_input_revision()"),
    ).rejects.toThrow();
    await expect(db.query("select * from allocation_plans")).rejects.toThrow();
  } finally {
    await db.close();
  }
}, 20000);
