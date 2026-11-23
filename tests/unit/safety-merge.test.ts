import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {it,expect} from "vitest";
const sql=readFileSync(new URL("../../scripts/maintenance/merge-safety-goals.sql",import.meta.url),"utf8");
it("backend merge preserves bills and pooled ownership, and refuses a foreign-owner pair",async()=>{
 const db=new PGlite();
 const owner="00000000-0000-4000-8000-000000000001",e="00000000-0000-4000-8000-000000000002",b="00000000-0000-4000-8000-000000000003",h="00000000-0000-4000-8000-000000000004";
 try{
 await db.exec(`create table profiles(user_id uuid primary key);create table goals(id uuid primary key,user_id uuid,name text,type text,target_today bigint,target_date date,inflation_rate numeric,priority integer,plan_rank integer,planning_settings jsonb default '{}');create table holdings(id uuid primary key,user_id uuid);create table goal_bills(id uuid primary key default gen_random_uuid(),user_id uuid,goal_id uuid references goals(id) on delete cascade,amount bigint);create table goal_allocations(id uuid primary key default gen_random_uuid(),user_id uuid,goal_id uuid references goals(id) on delete cascade,holding_id uuid references holdings(id),percent numeric(5,2),unique(goal_id,holding_id));
 insert into profiles values('${owner}');insert into goals values('${e}','${owner}','Reserve','emergency_fund',300000,'2027-12-31',null,3,1,'{}'),('${b}','${owner}','Bills','bills_fund',12000,null,null,3,null,'{}');insert into holdings values('${h}','${owner}');insert into goal_bills(user_id,goal_id,amount) values('${owner}','${b}',12000);insert into goal_allocations(user_id,goal_id,holding_id,percent) values('${owner}','${e}','${h}',60),('${owner}','${b}','${h}',40);
 select set_config('tracker.merge_owner','${h}',false);select set_config('tracker.emergency_goal','${e}',false);select set_config('tracker.sinking_goal','${b}',false);`);
 await expect(db.exec(sql)).rejects.toThrow();expect((await db.query("select count(*)::int as n from goals")).rows).toEqual([{n:2}]);
 await db.exec(`select set_config('tracker.merge_owner','${owner}',false);`);await db.exec(sql);
 const goal=(await db.query<{name:string;target_today:number;planning_settings:{emergencyReserve:number;emergencyReserveDate:string}}>("select name,target_today,planning_settings from goals")).rows[0];
 expect(goal.name).toBe("Emergency / sinking fund");expect(Number(goal.target_today)).toBe(312000);expect(goal.planning_settings.emergencyReserve).toBe(300000);expect(goal.planning_settings.emergencyReserveDate).toBe("2027-12-31");
 expect((await db.query("select goal_id,percent::text from goal_allocations")).rows).toEqual([{goal_id:b,percent:"100.00"}]);expect((await db.query("select count(*)::int as n from goal_bills")).rows).toEqual([{n:1}]);
 }finally{await db.close();}
});
