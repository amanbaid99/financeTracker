-- Between jobs, covered till salary, and your own plan order.
--
-- profiles.salary_best / salary_worst: the earliest and latest date the next
--   salary could arrive. Set while between jobs; savings goals are then on
--   hold, and the runway counts what's due until salary.
-- profiles.runway_choices: per runway line, whether to count it (true) or
--   not (false), overriding the app's guess, e.g. a bills-fund payment that
--   repeats an EMI.
-- runway_items: one-off things not tracked elsewhere: money owed to you, and
--   payments like card dues. Cleared when marked done.
-- goals.plan_rank: your order for the money plan (1 first). Null for all
--   goals means the app's own order.

alter table public.profiles
  add column salary_best date,
  add column salary_worst date,
  add column runway_choices jsonb not null default '{}'::jsonb,
  add constraint salary_dates_in_order
    check (salary_best is null or salary_worst is null or salary_best <= salary_worst);

alter table public.goals
  add column plan_rank smallint check (plan_rank between 1 and 99);

create table public.runway_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('owed_to_me', 'to_pay')),
  label text not null check (char_length(label) between 1 and 60),
  amount integer not null check (amount > 0 and amount <= 100000000),
  due date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index runway_items_user_id_idx on public.runway_items (user_id);

alter table public.runway_items enable row level security;
create policy "Own runway items" on public.runway_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- The page snapshot carries the new fields.
create or replace function public.app_snapshot(privacy_version text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'goals', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.created_at)
      from (
        select id, name, type, target_today, target_date, inflation_rate, created_at,
          loan_id, loan_outstanding, loan_emi, loan_rate, loan_months_left, loan_as_of,
          loan_foreclosure_pct, loan_foreclosure_gst, loan_emi_day, loan_first_emi, priority, plan_rank
        from goals
      ) g), '[]'::jsonb),
    'holdings', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.current_value desc)
      from (
        select id, kind, name, category, current_value, monthly_sip, expected_return_pct,
          invested, updated_at
        from holdings
      ) h), '[]'::jsonb),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', goal_id, 'holding_id', holding_id, 'percent', percent))
      from goal_allocations), '[]'::jsonb),
    'goal_bills', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.next_due)
      from (select id, goal_id, name, amount, every_months, next_due from goal_bills) b), '[]'::jsonb),
    'loans', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at)
      from (
        select id, name, type, card_id, principal, taken_on, rate, emi, months_left, total_emis,
          emi_day, bill_day, first_emi, outstanding, outstanding_as_of, foreclosure_pct,
          foreclosure_gst, created_at
        from loans
      ) l), '[]'::jsonb),
    'loan_payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.due_date desc)
      from (
        select loan_id, due_date, amount, paid_on from loan_payments
        order by due_date desc limit 1000
      ) p), '[]'::jsonb),
    'incomes', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at)
      from (select id, label, type, amount_monthly, active, created_at from income_streams) i), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.amount_monthly desc)
      from (select id, category, amount_monthly from expenses) e), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at)
      from (
        select id, label, annual_fee, year_start, rewards, benefits, best_for, created_at
        from credit_cards
      ) c), '[]'::jsonb),
    'card_milestones', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at)
      from (
        select id, card_id, name, target, period, deadline, reward, created_at
        from card_milestones
      ) m), '[]'::jsonb),
    'card_bills', coalesce((
      select jsonb_agg(to_jsonb(b) order by b.month desc)
      from (
        select id, card_id, month, amount, due_date, paid, note from card_bills
        order by month desc limit 500
      ) b), '[]'::jsonb),
    'profile', (
      select to_jsonb(p) from (
        select theme, accent, plan_lump_sum, plan_monthly, ai_enabled, age, dob,
          dependents, sole_earner, salary_best, salary_worst, runway_choices
        from profiles where user_id = (select auth.uid())
      ) p),
    'settings', (
      select to_jsonb(s) from (
        select seen_guides, whats_new_seen, last_cas_import_at
        from settings where user_id = (select auth.uid())
      ) s),
    'runway_items', coalesce((
      select jsonb_agg(to_jsonb(ri) order by ri.created_at)
      from (select id, kind, label, amount, due, done, created_at from runway_items) ri), '[]'::jsonb),
    'review', (select to_jsonb(r) from portfolio_reviews r where r.user_id = (select auth.uid())),
    'privacy_ok', exists (
      select 1 from consents
      where kind = 'privacy_policy' and version = privacy_version and granted
    ),
    'joined_at', (
      select min(created_at) from consents where kind = 'privacy_policy'
    ),
    'is_admin', public.is_admin(),
    'ai_consent', (
      select jsonb_build_object('granted', granted, 'version', version) from consents
      where kind = 'ai_processing' order by created_at desc limit 1
    )
  );
$$;

revoke all on function public.app_snapshot(text) from public, anon;
grant execute on function public.app_snapshot(text) to authenticated;
