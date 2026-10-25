-- What the user can put toward goals: savings available now, and the total
-- they can invest each month (existing SIPs included).
alter table public.profiles
  add column plan_lump_sum bigint check (plan_lump_sum >= 0),
  add column plan_monthly bigint check (plan_monthly >= 0);
