-- Reuse goal ownership. Confirmed plan history is append-only for app users.
alter table public.goals add column planning_settings jsonb not null default '{}'::jsonb
 check (jsonb_typeof(planning_settings)='object' and octet_length(planning_settings::text)<=5000);
alter table public.holdings add column planning_details jsonb not null default '{}'::jsonb
 check (jsonb_typeof(planning_details)='object' and octet_length(planning_details::text)<=5000);
create table public.allocation_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 engine_version text not null,
 input_revision text not null,
 inputs jsonb not null check(jsonb_typeof(inputs)='object'),
 result jsonb not null check(jsonb_typeof(result)='object')
);
create index allocation_plans_owner_date on public.allocation_plans(user_id,created_at desc,id desc);
alter table public.allocation_plans enable row level security;
create policy allocation_plans_select on public.allocation_plans for select to authenticated using (user_id=(select auth.uid()));
create policy allocation_plans_insert on public.allocation_plans for insert to authenticated with check (user_id=(select auth.uid()));
grant select,insert on public.allocation_plans to authenticated;
revoke update,delete on public.allocation_plans from authenticated;

-- Invoker rights: all reads use the caller's existing RLS. Include all material
-- source records, not the plan preferences that the confirming action changes.
create function public.hybrid_source_revision() returns text language sql stable security invoker set search_path='' as $$
 select md5(jsonb_build_object(
 'goals',(select coalesce(jsonb_agg(to_jsonb(g) order by g.id),'[]') from public.goals g where g.user_id=auth.uid()),
 'holdings',(select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') from public.holdings h where h.user_id=auth.uid()),
 'budget',(select coalesce(jsonb_agg(to_jsonb(b) order by b.user_id),'[]') from public.budget_ratio_plans b where b.user_id=auth.uid()),
 'expenses',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.expenses e where e.user_id=auth.uid()),
 'income',(select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.income_streams i where i.user_id=auth.uid()),
 'loans',(select coalesce(jsonb_agg(to_jsonb(l) order by l.id),'[]') from public.loans l where l.user_id=auth.uid()),
 'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') from public.loan_payments p where p.user_id=auth.uid()),
 'bills',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.goal_bills b where b.user_id=auth.uid())
 )::text);
$$;
revoke all on function public.hybrid_source_revision() from public,anon;
grant execute on function public.hybrid_source_revision() to authenticated;
create function public.hybrid_input_revision() returns text language sql stable security invoker set search_path='' as $$
 select md5(public.hybrid_source_revision() || (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]')::text from public.goal_allocations a where a.user_id=auth.uid()));
$$;
revoke all on function public.hybrid_input_revision() from public,anon;
grant execute on function public.hybrid_input_revision() to authenticated;

create function public.confirm_hybrid_plan(p_revision text,p_inputs jsonb,p_result jsonb,p_links jsonb,p_monthly bigint,p_lump bigint,p_minimums jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_user uuid:=auth.uid(); v_link jsonb;
begin
 if v_user is null then raise exception 'Sign in first'; end if;
 -- Serialize confirmations and lock source rows. Revision detects source edits
 -- between preview and confirmation; old history is never updated.
 perform 1 from public.profiles where user_id=v_user for update;
 perform 1 from public.goals where user_id=v_user order by id for update;
 perform 1 from public.holdings where user_id=v_user order by id for update;
 perform 1 from public.budget_ratio_plans where user_id=v_user for update;
 perform 1 from public.loans where user_id=v_user order by id for update;
 if public.hybrid_input_revision() is distinct from p_revision then raise exception 'Inputs changed. Refresh and review the plan.'; end if;
 if p_monthly<0 or p_lump<0 or p_monthly>1000000000 or p_lump>10000000000000 then raise exception 'Invalid plan amounts'; end if;
 if p_result->>'strategy'<>'hybrid' or jsonb_typeof(p_links)<>'array' then raise exception 'Invalid plan'; end if;
 if (p_result->>'totalMonthlyAllocated')::numeric>p_monthly then raise exception 'Over budget'; end if;
 if octet_length(p_inputs::text)>2000000 or octet_length(p_result::text)>2000000 then raise exception 'Plan too large'; end if;
 -- Existing ownership trigger validates both parents and <=100% under a row lock.
 delete from public.goal_allocations where user_id=v_user;
 for v_link in select value from jsonb_array_elements(p_links) loop
   insert into public.goal_allocations(user_id,goal_id,holding_id,percent)
   values(v_user,(v_link->>'goalId')::uuid,(v_link->>'investmentId')::uuid,(v_link->>'percent')::numeric);
 end loop;
 update public.profiles set plan_monthly=p_monthly,plan_lump_sum=p_lump,plan_sip_minimums=p_minimums where user_id=v_user;
 insert into public.allocation_plans(user_id,engine_version,input_revision,inputs,result)
 values(v_user,p_result->>'engineVersion',p_inputs->>'sourceRevision',p_inputs,p_result) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.confirm_hybrid_plan(text,jsonb,jsonb,jsonb,bigint,bigint,jsonb) from public,anon;
grant execute on function public.confirm_hybrid_plan(text,jsonb,jsonb,jsonb,bigint,bigint,jsonb) to authenticated;
