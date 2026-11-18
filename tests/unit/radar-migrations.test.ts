import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = (name: string) => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const review = migration("20261118063622_radar_holding_review.sql");
const foundation = migration("20261125000000_radar_foundation.sql");
const priceRules = migration("20261126000000_radar_price_rules.sql");
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table public.app_admins(email text);`);
  return db;
}
describe("Radar migration ordering on PostgreSQL", () => {
  it("replays in filename order from a fresh database and keeps review validation and owner RLS", async () => {
    const db = await database();
    try {
      await db.exec(review); // Table does not exist yet.
      await db.exec(foundation);
      await db.exec(priceRules);
      const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema='public' and table_name='radar_watchlist'");
      expect(columns.rows.map(r => r.column_name)).toContain("holding_review");
      expect(columns.rows.map(r => r.column_name)).toContain("holding_confirmed");
      expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='public.radar_watchlist'::regclass")).rows[0].relrowsecurity).toBe(true);
      await db.exec(`insert into auth.users values ('${owner}', 'owner@example.test'), ('${other}', 'other@example.test');
        insert into public.radar_access values ('${owner}');
        insert into public.radar_watchlist(id,user_id,exchange,security_id,symbol,name,asset_type)
          values ('${owner}', '${owner}', 'NSE', '123', 'SYNTHETIC', 'Synthetic holding', 'equity');`);
      await expect(db.query("update public.radar_watchlist set holding_review='[]'::jsonb")).rejects.toThrow();
      await expect(db.query("update public.radar_watchlist set holding_review=jsonb_build_object('text', repeat('x',5000))")).rejects.toThrow();
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${other}',false);`);
      expect((await db.query("update public.radar_watchlist set holding_review='{}'::jsonb returning id")).rows).toEqual([]);
      await db.exec(`select set_config('request.jwt.claim.sub','${owner}',false);`);
      expect((await db.query("update public.radar_watchlist set holding_review='{}'::jsonb returning id")).rows).toHaveLength(1);
    } finally { await db.close(); }
  }, 20000);
  it("adds the column to an existing table and can safely run again without duplicating it", async () => {
    const db = await database();
    try {
      await db.exec("create table public.radar_watchlist(id uuid primary key); alter table public.radar_watchlist enable row level security;");
      await db.exec(review);await db.exec(review);
      expect((await db.query<{ n: number }>("select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='radar_watchlist' and column_name='holding_review'")).rows[0].n).toBe(1);
      expect((await db.query<{ n: number }>("select count(*)::int as n from pg_constraint where conrelid='public.radar_watchlist'::regclass and pg_get_constraintdef(oid) like '%holding_review%'")).rows[0].n).toBe(1);
      expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid='public.radar_watchlist'::regclass")).rows[0].relrowsecurity).toBe(true);
    } finally { await db.close(); }
  }, 20000);
});
