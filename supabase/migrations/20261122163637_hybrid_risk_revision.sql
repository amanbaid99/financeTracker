create or replace function public.hybrid_source_revision() returns text language sql stable security invoker set search_path='' as $$
 select md5(jsonb_build_object(
 'risk',(select coalesce(jsonb_agg(to_jsonb(p)->'risk_profile'),'[]') from public.profiles p where p.user_id=auth.uid()),
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
