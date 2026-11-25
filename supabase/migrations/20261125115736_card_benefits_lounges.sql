-- Reviewed terms live on the existing card. Ordinary edits preserve them.
alter table public.credit_cards add column feature_details jsonb;
alter table public.credit_cards add constraint credit_card_feature_object
  check (feature_details is null or jsonb_typeof(feature_details) = 'object');
create table public.card_lounge_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade,
  rule_id text not null check (length(rule_id) between 1 and 80),
  visited_on date not null,
  visits integer not null default 1 check (visits between 1 and 99),
  created_at timestamptz not null default now()
);
create index card_lounge_visits_owner_card on public.card_lounge_visits(user_id,card_id,visited_on);
create index card_lounge_visits_card_date on public.card_lounge_visits(card_id,visited_on);
alter table public.card_lounge_visits enable row level security;
revoke all on public.card_lounge_visits from public, anon, authenticated;
grant select, insert, delete on public.card_lounge_visits to authenticated;
create policy lounge_owner_read on public.card_lounge_visits for select to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.credit_cards c where c.id=card_id and c.user_id=(select auth.uid())));
create policy lounge_owner_add on public.card_lounge_visits for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.credit_cards c where c.id=card_id and c.user_id=(select auth.uid())));
create policy lounge_owner_delete on public.card_lounge_visits for delete to authenticated
 using (user_id=(select auth.uid()) and exists(select 1 from public.credit_cards c where c.id=card_id and c.user_id=(select auth.uid())));
