-- Bills fund goals: one liquid fund saving for known payments (insurance,
-- gym, servicing...). Each payment is a row; due dates roll forward in the app.
alter type public.goal_type add value if not exists 'bills_fund';

create table public.goal_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount > 0),
  every_months smallint not null check (every_months between 1 and 60),
  next_due date not null,
  created_at timestamptz not null default now()
);
create index goal_bills_user_idx on public.goal_bills (user_id);
create index goal_bills_goal_idx on public.goal_bills (goal_id);

alter table public.goal_bills enable row level security;
alter table public.goal_bills force row level security;

create policy "own rows select" on public.goal_bills for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.goal_bills for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.goal_bills for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows delete" on public.goal_bills for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.goal_bills from anon;
grant select, insert, update, delete on public.goal_bills to authenticated;
