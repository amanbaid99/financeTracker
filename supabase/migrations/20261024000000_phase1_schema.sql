-- Phase 1 schema for Tracker.
-- Every user table carries user_id with RLS: a user can only read and write
-- their own rows. Money is integer rupees (bigint), never floats.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.city_tier as enum ('metro', 'tier2', 'tier3');
create type public.marital_status as enum ('single', 'married', 'other');
create type public.risk_profile as enum ('conservative', 'moderate', 'aggressive');
create type public.income_type as enum (
  'stable_salary', 'variable_salary', 'freelance', 'business', 'rental', 'bonus', 'other'
);
create type public.insurance_kind as enum ('health', 'term', 'other');
create type public.insurance_source as enum ('personal', 'employer', 'family');
create type public.liability_kind as enum (
  'credit_card', 'personal_loan', 'car', 'home', 'education', 'other'
);
create type public.holding_kind as enum (
  'savings', 'fd', 'ppf', 'epf', 'nps', 'mutual_fund', 'stock', 'gold', 'other'
);
create type public.holding_source as enum ('manual', 'cas');
create type public.goal_type as enum (
  'emergency_fund', 'insurance_premium_fund', 'wedding', 'house_down_payment',
  'vehicle', 'education', 'travel', 'retirement', 'medical', 'custom'
);
create type public.consent_kind as enum ('privacy_policy', 'disclaimer', 'ai_processing');

-- ---------------------------------------------------------------------------
-- Invite list. Managed by the owner from the dashboard or SQL; users get no access.
-- ---------------------------------------------------------------------------
create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  note text,
  added_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
-- No policies on purpose: anon and authenticated users cannot read or write it.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  dob date,
  age smallint check (age between 15 and 100),
  city_tier public.city_tier,
  marital_status public.marital_status,
  dependents smallint check (dependents between 0 and 20),
  sole_earner boolean,
  risk_profile public.risk_profile,
  -- Sections the user has answered, even when the answer was "I have none".
  answered_sections text[] not null default '{}',
  theme text not null default 'white' check (theme in ('white', 'black', 'beige')),
  accent text not null default 'green' check (accent in ('green', 'blue', 'terracotta', 'violet')),
  disclaimer_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  ai_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.consent_kind not null,
  version text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, kind, created_at desc);

create table public.income_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  type public.income_type not null,
  amount_monthly bigint not null default 0 check (amount_monthly >= 0),
  fixed_monthly bigint check (fixed_monthly >= 0),
  is_gross boolean not null default false,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index income_streams_user_idx on public.income_streams (user_id);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.income_streams (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount >= 0),
  unique (stream_id, month)
);
create index income_entries_user_idx on public.income_entries (user_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (char_length(category) between 1 and 60),
  amount_monthly bigint not null check (amount_monthly >= 0),
  is_essential boolean not null default true
);
create index expenses_user_idx on public.expenses (user_id);

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.insurance_kind not null,
  source public.insurance_source not null,
  cover_amount bigint not null default 0 check (cover_amount >= 0),
  premium bigint check (premium >= 0), -- yearly
  renewal_month smallint check (renewal_month between 1 and 12)
);
create index insurance_user_idx on public.insurance_policies (user_id);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.liability_kind not null,
  label text check (char_length(label) <= 60),
  outstanding bigint not null default 0 check (outstanding >= 0),
  interest_rate numeric(5, 2) check (interest_rate between 0 and 99),
  emi bigint check (emi >= 0)
);
create index liabilities_user_idx on public.liabilities (user_id);

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.holding_kind not null,
  -- Free text the user enters. The app never suggests a name.
  name text check (char_length(name) <= 80),
  category text check (char_length(category) <= 40),
  current_value bigint not null default 0 check (current_value >= 0),
  monthly_sip bigint check (monthly_sip >= 0),
  source public.holding_source not null default 'manual',
  updated_at timestamptz not null default now()
);
create index holdings_user_idx on public.holdings (user_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type public.goal_type not null,
  target_today bigint not null check (target_today >= 0),
  target_date date not null,
  priority smallint not null default 3 check (priority between 1 and 5),
  inflation_rate numeric(4, 2) check (inflation_rate between 0 and 30),
  saved_amount bigint not null default 0 check (saved_amount >= 0),
  status text,
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

create table public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  holding_id uuid not null references public.holdings (id) on delete cascade,
  percent numeric(5, 2) not null check (percent > 0 and percent <= 100),
  unique (goal_id, holding_id)
);
create index goal_allocations_user_idx on public.goal_allocations (user_id);
create index goal_allocations_holding_idx on public.goal_allocations (holding_id);

create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  config_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(config_overrides) = 'object'),
  updated_at timestamptz not null default now()
);

-- AI usage log for rate limiting. Never stores prompts or responses.
create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null,
  model text not null,
  tier text not null check (tier in ('free', 'paid')),
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ai_requests_user_idx on public.ai_requests (user_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger holdings_updated_at before update on public.holdings
  for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrity: allocations of a holding never exceed 100%, and child rows must
-- point at the same user's parent rows.
-- ---------------------------------------------------------------------------
create or replace function public.check_goal_allocation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  total numeric;
begin
  if not exists (select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'Goal not found';
  end if;
  if not exists (select 1 from public.holdings h where h.id = new.holding_id and h.user_id = new.user_id) then
    raise exception 'Holding not found';
  end if;
  -- Lock the holding so concurrent inserts cannot both pass the check.
  perform 1 from public.holdings h where h.id = new.holding_id for update;
  select coalesce(sum(a.percent), 0) into total
  from public.goal_allocations a
  where a.holding_id = new.holding_id and a.id <> new.id;
  if total + new.percent > 100 then
    raise exception 'This holding is already % percent allocated. The total across goals cannot go above 100.', total
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger goal_allocations_check
  before insert or update on public.goal_allocations
  for each row execute function public.check_goal_allocation();

create or replace function public.check_income_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.income_streams s where s.id = new.stream_id and s.user_id = new.user_id
  ) then
    raise exception 'Income stream not found';
  end if;
  return new;
end;
$$;

create trigger income_entries_check
  before insert or update on public.income_entries
  for each row execute function public.check_income_entry();

-- ---------------------------------------------------------------------------
-- Auth hooks: invite-only signup and a profile row for every new user.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_invite_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails a where a.email = lower(new.email)
  ) then
    raise exception 'This email is not on the invite list'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger enforce_invite_list
  before insert on auth.users
  for each row execute function public.enforce_invite_list();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80)
  );
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Account deletion: removes the auth user, which cascades to every user row.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.enforce_invite_list() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'consents', 'income_streams', 'income_entries', 'expenses',
    'insurance_policies', 'liabilities', 'holdings', 'goals', 'goal_allocations',
    'settings', 'ai_requests'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy "own rows select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "own rows delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Consents and the AI log are append-only from the app.
revoke update, delete on public.consents from authenticated;
revoke update, delete on public.ai_requests from authenticated;
revoke all on public.allowed_emails from anon, authenticated;
