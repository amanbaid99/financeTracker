-- Explicit owner-requested data maintenance. Run inside a transaction after setting
-- tracker.merge_owner, tracker.emergency_goal and tracker.sinking_goal locally.
-- Keeps the sinking goal ID and every bill ID; immutable saved plans are untouched.
do $$
declare
 v_owner uuid:=current_setting('tracker.merge_owner')::uuid;
 v_emergency uuid:=current_setting('tracker.emergency_goal')::uuid;
 v_sinking uuid:=current_setting('tracker.sinking_goal')::uuid;
 e public.goals%rowtype; b public.goals%rowtype;
 links jsonb; bill_count integer; shares numeric;
begin
 if v_emergency=v_sinking then raise exception 'Choose two different goals'; end if;
 perform 1 from public.profiles where user_id=v_owner for update;
 perform 1 from public.goals where user_id=v_owner order by id for update;
 select * into strict e from public.goals where id=v_emergency and user_id=v_owner;
 select * into strict b from public.goals where id=v_sinking and user_id=v_owner;
 if e.type<>'emergency_fund' or b.type<>'bills_fund' then raise exception 'Goal types changed'; end if;
 if e.target_today<=0 or coalesce((e.planning_settings->>'completed')::boolean,false) or coalesce((b.planning_settings->>'completed')::boolean,false) then raise exception 'Review active goal targets first'; end if;
 perform 1 from public.holdings where user_id=v_owner order by id for update;
 select count(*) into bill_count from public.goal_bills where user_id=v_owner and goal_id in(v_emergency,v_sinking);
 select coalesce(sum(percent),0) into shares from public.goal_allocations where user_id=v_owner and goal_id in(v_emergency,v_sinking);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into links from (
  select holding_id,sum(percent) as percent from public.goal_allocations where user_id=v_owner and goal_id in(v_emergency,v_sinking) group by holding_id
 ) x;
 if exists(select 1 from jsonb_to_recordset(links) as x(holding_id uuid,percent numeric) where percent>100) then raise exception 'Invalid ownership'; end if;
 update public.goals set name='Emergency / sinking fund',target_today=e.target_today+b.target_today,target_date=null,inflation_rate=null,
  plan_rank=least(e.plan_rank,b.plan_rank),priority=least(e.priority,b.priority),
  planning_settings=b.planning_settings||e.planning_settings||jsonb_build_object(
   'emergencyReserve',e.target_today,'emergencyReserveDate',e.target_date,'goalCategory','essential',
   'minimumMonthly',coalesce((b.planning_settings->>'minimumMonthly')::numeric,0)+coalesce((e.planning_settings->>'minimumMonthly')::numeric,0))
 where id=v_sinking and user_id=v_owner;
 update public.goal_bills set goal_id=v_sinking where goal_id=v_emergency and user_id=v_owner;
 delete from public.goal_allocations where user_id=v_owner and goal_id in(v_emergency,v_sinking);
 insert into public.goal_allocations(user_id,goal_id,holding_id,percent)
 select v_owner,v_sinking,x.holding_id,x.percent from jsonb_to_recordset(links) as x(holding_id uuid,percent numeric);
 delete from public.goals where id=v_emergency and user_id=v_owner;
 if (select count(*) from public.goal_bills where user_id=v_owner and goal_id=v_sinking)<>bill_count or
    (select coalesce(sum(percent),0) from public.goal_allocations where user_id=v_owner and goal_id=v_sinking)<>shares then
  raise exception 'Merge preservation check failed';
 end if;
end $$;
