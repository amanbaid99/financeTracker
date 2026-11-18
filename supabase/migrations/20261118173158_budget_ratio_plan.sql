-- One personal monthly ratio plan. Existing income, expenses and SIPs are unchanged.
create table public.budget_ratio_plans (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and octet_length(plan::text) <= 50000),
  updated_at timestamptz not null default now()
);
alter table public.budget_ratio_plans enable row level security;
revoke all on public.budget_ratio_plans from public, anon;
grant select, insert, update, delete on public.budget_ratio_plans to authenticated, service_role;
create policy "Read own budget plan" on public.budget_ratio_plans for select to authenticated using (user_id = (select auth.uid()));
create policy "Create own budget plan" on public.budget_ratio_plans for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Update own budget plan" on public.budget_ratio_plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Delete own budget plan" on public.budget_ratio_plans for delete to authenticated using (user_id = (select auth.uid()));
