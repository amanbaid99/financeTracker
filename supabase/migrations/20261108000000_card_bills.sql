-- Monthly credit card bills: one row per card per statement month.
create table public.card_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount >= 0),
  due_date date,
  paid boolean not null default false,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  unique (card_id, month)
);
create index card_bills_user_idx on public.card_bills (user_id, month);

alter table public.card_bills enable row level security;
alter table public.card_bills force row level security;
revoke all on public.card_bills from anon;
grant select, insert, update, delete on public.card_bills to authenticated;

create policy "own rows select" on public.card_bills for select to authenticated
  using (user_id = (select auth.uid()));
-- A bill can only be logged against one of your own cards.
create policy "own rows insert" on public.card_bills for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.credit_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy "own rows update" on public.card_bills for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.credit_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy "own rows delete" on public.card_bills for delete to authenticated
  using (user_id = (select auth.uid()));
