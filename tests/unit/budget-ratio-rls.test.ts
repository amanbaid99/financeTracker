import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const migration = readFileSync(new URL("../../supabase/migrations/20261119061828_budget_ratio_plan.sql", import.meta.url), "utf8");
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
it("enforces one budget per owner, CRUD isolation, anonymous denial and account-deletion cascade in PostgreSQL", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      insert into auth.users values ('${owner}'), ('${other}');`);
    await db.exec(migration);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'; insert into public.budget_ratio_plans(plan) values ('{"version":1}');`);
    expect((await db.query("select * from public.budget_ratio_plans")).rows).toHaveLength(1);
    await db.exec("update public.budget_ratio_plans set plan = '{\"version\":1,\"salary\":100000}'");
    await expect(db.exec("insert into public.budget_ratio_plans(plan) values ('{}')")).rejects.toThrow();
    await expect(db.exec(`update public.budget_ratio_plans set user_id='${other}'`)).rejects.toThrow();
    await expect(db.exec("update public.budget_ratio_plans set plan='[]'")).rejects.toThrow();
    await expect(db.exec("update public.budget_ratio_plans set plan=jsonb_build_object('large', repeat('x',50001))")).rejects.toThrow();
    await db.exec(`set request.jwt.claim.sub = '${other}'`);
    expect((await db.query("select * from public.budget_ratio_plans")).rows).toEqual([]);
    expect((await db.query("update public.budget_ratio_plans set plan='{}' returning user_id")).rows).toEqual([]);
    expect((await db.query("delete from public.budget_ratio_plans returning user_id")).rows).toEqual([]);
    await expect(db.exec(`insert into public.budget_ratio_plans(user_id,plan) values ('${owner}','{}')`)).rejects.toThrow();
    await db.exec("insert into public.budget_ratio_plans(plan) values ('{}')");
    await db.exec(`set request.jwt.claim.sub = '${owner}'`);
    expect((await db.query("delete from public.budget_ratio_plans returning user_id")).rows).toEqual([{ user_id: owner }]);
    expect((await db.query("select * from public.budget_ratio_plans")).rows).toEqual([]);
    await db.exec("insert into public.budget_ratio_plans(plan) values ('{}')");
    await db.exec("reset role; set role anon");
    await expect(db.query("select * from public.budget_ratio_plans")).rejects.toThrow();
    await db.exec(`reset role; delete from auth.users where id='${owner}'`);
    expect((await db.query("select user_id from public.budget_ratio_plans")).rows).toEqual([{ user_id: other }]);
    expect((await db.query("select id from auth.users")).rows).toEqual([{ id: other }]);
  } finally { await db.close(); }
}, 20000);
