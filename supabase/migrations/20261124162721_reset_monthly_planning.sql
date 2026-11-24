-- One atomic reset, with an append-only marker instead of deleting plan history.
create function public.reset_monthly_planning(p_reset_budget boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
declare v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Sign in first'; end if;
 perform 1 from public.profiles where user_id=v_user for update;
 if not found then raise exception 'Profile not found'; end if;
 if p_reset_budget then
   delete from public.budget_ratio_plans where user_id=v_user;
 end if;
 update public.profiles set plan_monthly=null,plan_sip_minimums='{}'::jsonb where user_id=v_user;
 insert into public.allocation_plans(user_id,engine_version,input_revision,inputs,result)
 values(v_user,'sip-reset-1',public.hybrid_source_revision(),
   jsonb_build_object('allocationMode','safety_deadline','sipReset',true,'budgetReset',p_reset_budget),
   jsonb_build_object('strategy','hybrid','engineVersion','sip-reset-1','goals','[]'::jsonb,'vehicles','[]'::jsonb,'totalMonthlyAllocated',0));
end;
$$;
revoke all on function public.reset_monthly_planning(boolean) from public,anon;
grant execute on function public.reset_monthly_planning(boolean) to authenticated;
