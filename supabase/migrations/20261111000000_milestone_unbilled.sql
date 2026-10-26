-- Milestones now count the card's logged bills automatically. Spend that
-- isn't on a bill yet is kept once per card ("unbilled") and counts toward
-- every milestone on it until the next bill is logged.
--
-- Typed milestone spend already covered by bills in the current period is
-- dropped, and anything beyond the bills moves to the card, so nothing is
-- counted twice or lost.

alter table public.credit_cards
  add column unbilled bigint not null default 0 check (unbilled >= 0),
  add column unbilled_as_of date;

with periods as (
  select
    m.id,
    m.card_id,
    m.spent,
    case m.period
      when 'month' then date_trunc('month', current_date)::date
      when 'quarter' then date_trunc('quarter', current_date)::date
      when 'calendar_year' then date_trunc('year', current_date)::date
      when 'card_year' then
        case
          when c.year_start is null then date_trunc('year', current_date)::date
          else (
            select case when d > current_date then (d - interval '1 year')::date else d end
            from (
              select make_date(
                extract(year from current_date)::int,
                extract(month from c.year_start)::int,
                least(extract(day from c.year_start)::int, 28)
              ) as d
            ) x
          )
        end
      else m.created_at::date
    end as starts
  from public.card_milestones m
  join public.credit_cards c on c.id = m.card_id
  where m.spent > 0
),
extra as (
  select
    p.card_id,
    max(greatest(0, p.spent - coalesce((
      select sum(b.amount)
      from public.card_bills b
      where b.card_id = p.card_id
        and b.month >= date_trunc('month', p.starts)::date
    ), 0))) as amount
  from periods p
  group by p.card_id
)
update public.credit_cards c
set unbilled = e.amount, unbilled_as_of = current_date
from extra e
where e.card_id = c.id and e.amount > 0;

alter table public.card_milestones
  drop column spent,
  drop column spent_as_of;
