-- Everything a page shows, in one round trip. Runs as the caller (security
-- invoker), so row level security still limits every row to their own.
-- Pages read this once per request instead of making a dozen queries.
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
          loan_foreclosure_pct, loan_foreclosure_gst, loan_emi_day, loan_first_emi
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
          dependents, sole_earner
        from profiles where user_id = (select auth.uid())
      ) p),
    'settings', (
      select to_jsonb(s) from (
        select seen_guides, whats_new_seen, last_cas_import_at
        from settings where user_id = (select auth.uid())
      ) s),
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
