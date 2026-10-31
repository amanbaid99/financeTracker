-- Loans tracked on their own: type, amount withdrawn, EMIs, amount still owed,
-- and each EMI marked paid. A "Pay off a loan" goal links to one.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type text not null default 'other'
    check (type in ('home', 'personal', 'car', 'education', 'gold', 'card', 'other')),
  -- For a loan on a credit card: which card (its bill and due dates apply).
  card_id uuid references public.credit_cards(id) on delete set null,
  principal bigint check (principal >= 0),
  taken_on date,
  rate numeric(5, 2) not null default 0 check (rate >= 0 and rate <= 60),
  emi bigint check (emi >= 0),
  months_left integer check (months_left >= 0),
  total_emis integer check (total_emis > 0 and total_emis <= 600),
  -- The day the EMI is paid. For a loan on a card, the card's payment due day.
  emi_day integer check (emi_day between 1 and 31),
  -- For a loan on a card: the day the card's bill is generated.
  bill_day integer check (bill_day between 1 and 31),
  first_emi date,
  -- Owed on outstanding_as_of; later EMIs are taken off on the schedule.
  outstanding bigint not null check (outstanding >= 0),
  outstanding_as_of date not null default current_date,
  foreclosure_pct numeric(5, 2) check (foreclosure_pct >= 0 and foreclosure_pct <= 20),
  foreclosure_gst boolean not null default true,
  created_at timestamptz not null default now()
);
create index loans_user_id_idx on public.loans (user_id);
create index loans_card_id_idx on public.loans (card_id);
alter table public.loans enable row level security;
create policy "Own loans" on public.loans for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      card_id is null
      or exists (
        select 1 from public.credit_cards c
        where c.id = card_id and c.user_id = (select auth.uid())
      )
    )
  );
grant select, insert, update, delete on public.loans to authenticated;

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  due_date date not null,
  amount bigint not null check (amount >= 0),
  paid_on date not null default current_date,
  -- What the loan said before this payment, so Undo can put it back.
  prev_outstanding bigint not null,
  prev_as_of date not null,
  created_at timestamptz not null default now(),
  unique (loan_id, due_date)
);
create index loan_payments_user_id_idx on public.loan_payments (user_id);
alter table public.loan_payments enable row level security;
create policy "Own loan payments" on public.loan_payments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.loans l
      where l.id = loan_id and l.user_id = (select auth.uid())
    )
  );
grant select, insert, update, delete on public.loan_payments to authenticated;

-- A pay-off goal points at its loan.
alter table public.goals
  add column loan_id uuid references public.loans(id) on delete set null;
create unique index goals_loan_id_idx on public.goals (loan_id) where loan_id is not null;

-- Turn every existing pay-off goal into a loan, keeping its numbers.
with src as (
  select g.*, gen_random_uuid() as new_id
  from public.goals g
  where g.type = 'loan_payoff' and g.loan_outstanding is not null and g.loan_id is null
), ins as (
  insert into public.loans (
    id, user_id, name, type, rate, emi, months_left, emi_day, first_emi,
    outstanding, outstanding_as_of, foreclosure_pct, foreclosure_gst
  )
  select
    new_id, user_id, left(name, 60), 'other', coalesce(loan_rate, 0), loan_emi,
    loan_months_left, loan_emi_day, loan_first_emi, loan_outstanding,
    coalesce(loan_as_of, created_at::date), loan_foreclosure_pct,
    coalesce(loan_foreclosure_gst, true)
  from src
  returning id
)
update public.goals g set loan_id = src.new_id
from src
where g.id = src.id and src.new_id in (select id from ins);
