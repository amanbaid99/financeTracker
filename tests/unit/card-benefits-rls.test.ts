import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(
  new URL(
    "../../supabase/migrations/20261125115736_card_benefits_lounges.sql",
    import.meta.url,
  ),
  "utf8",
);
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  card = "00000000-0000-4000-8000-000000000003";
it("lounge logs restrict ownership and parent access, forbid updates, and cascade card deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role authenticated;create role anon;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.credit_cards(id uuid primary key,user_id uuid);insert into credit_cards values('${card}','${a}');alter table credit_cards enable row level security;create policy owner on credit_cards to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));grant select,delete on credit_cards to authenticated;`,
    );
    await db.exec(sql);
    await db.exec(
      `set role authenticated;set test.uid='${a}';insert into card_lounge_visits(user_id,card_id,rule_id,visited_on) values('${a}','${card}','l','2026-11-25');`,
    );
    expect(
      (await db.query("select visits from card_lounge_visits")).rows,
    ).toEqual([{ visits: 1 }]);
    await expect(
      db.exec("update card_lounge_visits set visits=2"),
    ).rejects.toThrow(/permission denied/);
    await db.exec(`set test.uid='${b}';`);
    expect((await db.query("select * from card_lounge_visits")).rows).toEqual(
      [],
    );
    await expect(
      db.exec(
        `insert into card_lounge_visits(user_id,card_id,rule_id,visited_on) values('${b}','${card}','l','2026-11-25')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.exec(
        `insert into card_lounge_visits(user_id,card_id,rule_id,visited_on) values('${a}','${card}','l','2026-11-25')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec("delete from card_lounge_visits");
    await db.exec(`set test.uid='${a}';`);
    expect(
      (await db.query("select * from card_lounge_visits")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `insert into card_lounge_visits(user_id,card_id,rule_id,visited_on,visits) values('${a}','${card}','l','2026-11-25',0)`,
      ),
    ).rejects.toThrow(/check constraint/);
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from card_lounge_visits")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(`reset role;delete from credit_cards where id='${card}';`);
    expect((await db.query("select * from card_lounge_visits")).rows).toEqual(
      [],
    );
  } finally {
    await db.close();
  }
});
