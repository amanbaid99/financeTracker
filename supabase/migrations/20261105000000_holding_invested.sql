-- Amount put into a holding (its cost), from a CAS or entered by hand, so
-- the portfolio can show growth.
alter table public.holdings
  add column invested bigint check (invested >= 0);
