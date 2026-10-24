-- Monthly status: credit cards paid in full, planned (sinking fund) expenses,
-- bill paid ticks, and better insurance payment details.

-- Credit cards you pay in full each month. The outstanding amount is money
-- already spoken for, not debt. Card debt you carry over stays in liabilities.
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  outstanding bigint not null default 0 check (outstanding >= 0),
  statement_day smallint check (statement_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);
create index credit_cards_user_idx on public.credit_cards (user_id);

-- Planned expenses that come round every few months (gym, servicing,
-- repairs). The budget sets aside amount / every_months each month.
create table public.planned_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount bigint not null check (amount > 0),
  every_months smallint not null default 12 check (every_months between 1 and 120),
  next_due date,
  in_budget boolean not null default true,
  created_at timestamptz not null default now()
);
create index planned_expenses_user_idx on public.planned_expenses (user_id);

-- "Paid" ticks for this month's bills. bill_key identifies the bill, e.g.
-- "card:<id>", "emi:<id>", "ins:<id>", "plan:<id>", "sip:<id>".
create table public.bill_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  bill_key text not null check (char_length(bill_key) <= 80),
  paid boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, month, bill_key)
);

-- Insurance: debit day for monthly premiums, full renewal date for others,
-- and whether the premium is counted (or saved for) in the monthly budget.
alter table public.insurance_policies
  add column debit_day smallint check (debit_day between 1 and 31),
  add column renewal_date date,
  add column in_budget boolean not null default true;

do $$
declare
  t text;
begin
  foreach t in array array['credit_cards', 'planned_expenses', 'bill_status']
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
