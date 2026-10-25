-- The day of the month a loan's EMI is paid, so the balance drops on real EMI
-- dates. `loan_first_emi` is set when the loan was entered from its start.
alter table public.goals
  add column loan_emi_day smallint check (loan_emi_day between 1 and 31),
  add column loan_first_emi date;
