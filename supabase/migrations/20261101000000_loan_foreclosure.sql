-- Foreclosure charge on a loan goal: % of the amount owed when closed early,
-- and whether 18% GST is added on top.
alter table public.goals
  add column loan_foreclosure_pct numeric(5, 2) check (loan_foreclosure_pct between 0 and 20),
  add column loan_foreclosure_gst boolean not null default true;
