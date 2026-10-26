-- Bills fund payments can be one-off: every_months = 0 means "once, on
-- next_due". One-off payments aren't rolled forward after their date.
alter table public.goal_bills drop constraint if exists goal_bills_every_months_check;
alter table public.goal_bills
  add constraint goal_bills_every_months_check check (every_months between 0 and 60);
