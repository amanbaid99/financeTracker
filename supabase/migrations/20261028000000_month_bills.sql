-- Bills for a specific month: one-off or repeating bills the user adds
-- (electricity, phone...), and the actual billed amount of a credit card once
-- its statement is generated. amount null = bill not generated yet.
create table public.month_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  -- Groups the same repeating bill across months.
  series_id uuid not null default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  amount bigint check (amount >= 0),
  due_day smallint check (due_day between 1 and 31),
  recurring boolean not null default false,
  card_id uuid references public.credit_cards (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, month, series_id)
);
create index month_bills_user_idx on public.month_bills (user_id, month);

alter table public.month_bills enable row level security;
alter table public.month_bills force row level security;
revoke all on public.month_bills from anon;
grant select, insert, update, delete on public.month_bills to authenticated;
create policy "own rows select" on public.month_bills for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows insert" on public.month_bills for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows update" on public.month_bills for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows delete" on public.month_bills for delete to authenticated using (user_id = (select auth.uid()));
