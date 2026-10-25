-- What a bank account is for. Spending and bills accounts hold money that's
-- already spoken for, so they don't count toward the emergency fund.
-- Null is treated as "savings".
alter table public.holdings
  add column purpose text check (purpose in ('spending', 'bills', 'savings'));

-- Holdings the user has picked to live on while between incomes.
alter table public.holdings
  add column transition_fund boolean not null default false;
