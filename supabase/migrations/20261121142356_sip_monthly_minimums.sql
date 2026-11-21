-- Plan preferences only. Existing SIP records and financial balances stay unchanged.
alter table public.profiles add column if not exists plan_sip_minimums jsonb not null default '{}'::jsonb;
alter table public.profiles add constraint profiles_sip_minimums_object check (jsonb_typeof(plan_sip_minimums) = 'object' and octet_length(plan_sip_minimums::text) <= 5000);
-- Existing profiles owner-only RLS and grants cover this column.
