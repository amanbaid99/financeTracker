import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {it,expect} from "vitest";
const file=(name:string)=>readFileSync(new URL(`../../supabase/migrations/${name}`,import.meta.url),"utf8");
it("edits one goal atomically without shrinking others, enforces ownership and rejects anonymous access",async()=>{
 const db=new PGlite();
 const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002",g="00000000-0000-4000-8000-000000000003",other="00000000-0000-4000-8000-000000000004",h="00000000-0000-4000-8000-000000000005";
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table profiles(user_id uuid primary key);create table goals(id uuid primary key,user_id uuid);create table holdings(id uuid primary key,user_id uuid);create table goal_allocations(id uuid primary key default gen_random_uuid(),user_id uuid,goal_id uuid references goals(id),holding_id uuid references holdings(id),percent numeric(5,2) check(percent>0 and percent<=100),unique(goal_id,holding_id));
 insert into profiles values('${a}'),('${b}');insert into goals values('${g}','${a}'),('${other}','${a}');insert into holdings values('${h}','${a}');insert into goal_allocations(user_id,goal_id,holding_id,percent) values('${a}','${other}','${h}',70),('${a}','${g}','${h}',20);`);
 for(const table of ["profiles","goals","holdings","goal_allocations"])await db.exec(`alter table ${table} enable row level security;create policy owner on ${table} to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));grant select,insert,update,delete on ${table} to authenticated;`);
 const original=file("20261024000000_phase1_schema.sql");await db.exec(original.slice(original.indexOf("create or replace function public.check_goal_allocation()"),original.indexOf("create or replace function public.check_income_entry()")));
 await db.exec(file("20261123034826_safe_goal_coverage.sql"));
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}'`);
 const save=(n:number)=>db.query("select save_goal_coverage($1,$2::jsonb)",[g,JSON.stringify([{investmentId:h,percent:n}])]);
 await expect(save(50)).rejects.toThrow();
 expect((await db.query("select goal_id,percent::text from goal_allocations order by goal_id")).rows).toEqual([{goal_id:g,percent:"20.00"},{goal_id:other,percent:"70.00"}]);
 await save(30);
 expect((await db.query("select percent::text from goal_allocations where goal_id=$1",[other])).rows).toEqual([{percent:"70.00"}]);
 await db.exec(`set request.jwt.claim.sub='${b}'`);await expect(save(10)).rejects.toThrow("Goal unavailable");
 await db.exec("reset role;set role anon");await expect(save(10)).rejects.toThrow("permission denied");
 }finally{await db.close();}
});
