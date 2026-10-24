-- Yearly step-up for SIPs: the monthly SIP rises by this percentage every 12 months.
alter table public.holdings
  add column sip_step_up_pct numeric(5, 2) check (sip_step_up_pct between 0 and 50);

-- Expected yearly return the user plans with for this holding. Null means
-- "use the default for its category" from the app's config.
alter table public.holdings
  add column expected_return_pct numeric(5, 2) check (expected_return_pct between 0 and 30);

-- Insurance: who the policy covers and how often the premium is paid.
-- "others" (e.g. a policy for parents) counts in the budget but not toward
-- the user's own health cover. The premium is stored per payment.
alter table public.insurance_policies
  add column covers text not null default 'self' check (covers in ('self', 'family', 'others')),
  add column premium_frequency text not null default 'yearly'
    check (premium_frequency in ('monthly', 'quarterly', 'half_yearly', 'yearly'));
