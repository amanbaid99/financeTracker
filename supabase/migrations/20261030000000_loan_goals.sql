-- Goals to pay off a loan. The loan's details live on the goal; the balance
-- is rolled forward from `loan_as_of` with each EMI.
alter type public.goal_type add value if not exists 'loan_payoff';

alter table public.goals
  add column loan_outstanding bigint check (loan_outstanding >= 0),
  add column loan_emi bigint check (loan_emi >= 0),
  add column loan_rate numeric(5, 2) check (loan_rate between 0 and 60),
  add column loan_months_left integer check (loan_months_left between 1 and 600),
  add column loan_as_of date;
