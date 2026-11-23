-- Change one goal's coverage atomically. Other goals are never reduced.
create function public.save_goal_coverage(p_goal uuid, p_rows jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Sign in first'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>50 then
  raise exception 'Invalid coverage';
 end if;
 perform 1 from public.profiles where user_id=v_user for update;
 perform 1 from public.goals where user_id=v_user order by id for update;
 if not exists(select 1 from public.goals where id=p_goal and user_id=v_user) then
  raise exception 'Goal unavailable';
 end if;
 perform 1 from public.holdings where user_id=v_user order by id for update;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r("investmentId" uuid,percent numeric)
   where r.percent is null or r.percent<=0 or r.percent>100 or r.percent<>round(r.percent,2)
    or not exists(select 1 from public.holdings h where h.id=r."investmentId" and h.user_id=v_user)) then
  raise exception 'Invalid holding or share';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r("investmentId" uuid,percent numeric)
   group by r."investmentId" having count(*)>1) then raise exception 'Duplicate holding'; end if;
 delete from public.goal_allocations where goal_id=p_goal and user_id=v_user;
 insert into public.goal_allocations(user_id,goal_id,holding_id,percent)
 select v_user,p_goal,r."investmentId",r.percent from jsonb_to_recordset(p_rows) as r("investmentId" uuid,percent numeric);
 -- Existing ownership/100% trigger and RLS validate the complete transaction.
end $$;
revoke all on function public.save_goal_coverage(uuid,jsonb) from public,anon;
grant execute on function public.save_goal_coverage(uuid,jsonb) to authenticated;
