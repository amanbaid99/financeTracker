-- Credit cards: benefits, annual fee, card year, and spend milestones with
-- progress. Card numbers are never stored.

alter table public.credit_cards
  add column annual_fee bigint check (annual_fee >= 0),
  add column year_start date,
  add column rewards text check (char_length(rewards) <= 200),
  add column benefits text[] not null default '{}' check (coalesce(array_length(benefits, 1), 0) <= 30);

create table public.card_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target bigint not null check (target > 0),
  period text not null check (period in ('card_year', 'calendar_year', 'quarter', 'month', 'once')),
  deadline date,
  reward text check (char_length(reward) <= 120),
  spent bigint not null default 0 check (spent >= 0),
  spent_as_of date,
  created_at timestamptz not null default now()
);
create index card_milestones_user_idx on public.card_milestones (user_id);
create index card_milestones_card_idx on public.card_milestones (card_id);

alter table public.card_milestones enable row level security;
alter table public.card_milestones force row level security;
revoke all on public.card_milestones from anon;
grant select, insert, update, delete on public.card_milestones to authenticated;

create policy "own rows select" on public.card_milestones for select to authenticated
  using (user_id = (select auth.uid()));
-- A milestone can only be attached to one of your own cards.
create policy "own rows insert" on public.card_milestones for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.credit_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy "own rows update" on public.card_milestones for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.credit_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
create policy "own rows delete" on public.card_milestones for delete to authenticated
  using (user_id = (select auth.uid()));
