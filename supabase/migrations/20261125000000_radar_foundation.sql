-- Personal Radar entitlement, separate from general admin privileges.
create table public.radar_access (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.radar_access enable row level security;
create policy "Read own Radar access" on public.radar_access for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.radar_access from anon, authenticated;
grant select on public.radar_access to authenticated;
grant all on public.radar_access to service_role;
-- The existing sole owner is selected without embedding an identifier. Do not enable for other admins.
insert into public.radar_access(user_id)
select min(u.id::text)::uuid from auth.users u join public.app_admins a on lower(a.email)=lower(u.email)
having count(*)=1;

create table public.radar_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.radar_access(user_id) on delete cascade,
  exchange text not null check (exchange in ('NSE','BSE')),
  security_id text not null check (security_id ~ '^[0-9]{1,12}$'),
  symbol text not null check (char_length(symbol) between 1 and 60),
  name text not null check (char_length(name) between 1 and 160),
  isin text check (isin ~ '^IN[A-Z0-9]{10}$'),
  asset_type text not null check (asset_type in ('equity','gold_etf','index_etf')),
  price_below numeric(18,4) check (price_below > 0 and price_below <= 100000000),
  drawdown_pct numeric(6,2) check (drawdown_pct between 1 and 80),
  created_at timestamptz not null default now(),
  -- The earlier dated review migration skips an absent table on fresh replay.
  holding_review jsonb check (holding_review is null or
    (jsonb_typeof(holding_review) = 'object' and octet_length(holding_review::text) <= 4096)),
  unique(user_id,exchange,security_id),
  unique(id,user_id)
);
comment on column public.radar_watchlist.holding_review is
  'Owner-reviewed holding context, validated by the application. Never establishes source verification or a live recommendation.';
alter table public.radar_watchlist enable row level security;
create policy "Own personal Radar watchlist" on public.radar_watchlist for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.radar_access where user_id=(select auth.uid())))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.radar_access where user_id=(select auth.uid())));
revoke all on public.radar_watchlist from anon;
grant select,insert,update,delete on public.radar_watchlist to authenticated;
grant all on public.radar_watchlist to service_role;

create table public.radar_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.radar_access(user_id) on delete cascade,
  watch_id uuid not null,
  source text not null check (source='INDstocks'),
  fetched_at timestamptz not null default now(),
  session_date date,
  engine_version text not null,
  input_hash text not null check (char_length(input_hash)=64),
  candles jsonb not null check (jsonb_typeof(candles)='array' and jsonb_array_length(candles)<=600),
  analysis jsonb not null check (jsonb_typeof(analysis)='object'),
  foreign key(watch_id,user_id) references public.radar_watchlist(id,user_id) on delete cascade
);
create index radar_snapshots_owner_watch_time on public.radar_snapshots(user_id,watch_id,fetched_at desc);
alter table public.radar_snapshots enable row level security;
create policy "Read own personal Radar snapshots" on public.radar_snapshots for select to authenticated
  using (user_id=(select auth.uid()) and exists(select 1 from public.radar_access where user_id=(select auth.uid())));
create policy "Insert own personal Radar snapshots" on public.radar_snapshots for insert to authenticated
  with check (user_id=(select auth.uid()) and exists(select 1 from public.radar_access where user_id=(select auth.uid())));
revoke all on public.radar_snapshots from anon,authenticated;
grant select,insert on public.radar_snapshots to authenticated;
grant all on public.radar_snapshots to service_role;

create or replace function public.radar_latest_snapshots()
returns setof public.radar_snapshots language sql stable security invoker set search_path=public as $$
  select distinct on (watch_id) * from public.radar_snapshots
  where user_id=(select auth.uid()) order by watch_id,fetched_at desc,id desc;
$$;
revoke all on function public.radar_latest_snapshots() from public,anon;
grant execute on function public.radar_latest_snapshots() to authenticated;
