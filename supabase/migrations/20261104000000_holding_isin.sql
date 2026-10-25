-- ISIN (or a fixed key like DEMAT-STOCKS) for holdings imported from a CAS,
-- so later statements update the same holding.
alter table public.holdings
  add column isin text check (char_length(isin) <= 40);
create index holdings_user_isin_idx on public.holdings (user_id, isin);
