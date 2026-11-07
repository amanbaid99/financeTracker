-- Unpaid card bills count toward what you owe: they're debts until paid.
-- Kept as their own column so the app can show loans and card bills apart.

alter table public.net_worth_history
  add column card_bills bigint not null default 0;

create or replace function public.record_net_worth(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cards bigint;
begin
  -- Skip while an account is being deleted.
  if uid is null or not exists (select 1 from auth.users where id = uid) then
    return;
  end if;
  cards := coalesce(
    (select sum(amount) from card_bills where user_id = uid and not paid), 0);
  insert into net_worth_history (user_id, day, assets, liabilities, card_bills)
  values (
    uid,
    (now() at time zone 'Asia/Kolkata')::date,
    coalesce((select sum(current_value) from holdings where user_id = uid), 0),
    coalesce((select sum(outstanding) from loans where user_id = uid), 0) + cards,
    cards
  )
  on conflict (user_id, day) do update
    set assets = excluded.assets,
        liabilities = excluded.liabilities,
        card_bills = excluded.card_bills,
        updated_at = now();
end;
$$;
revoke all on function public.record_net_worth(uuid) from public, anon, authenticated;

create trigger card_bills_net_worth
  after insert or update of amount, paid, user_id or delete on public.card_bills
  for each row execute function public.net_worth_changed();

-- History so far started on 6 Nov 2026 with the same unpaid bills, so add
-- them to the rows already kept, then refresh today's.
update public.net_worth_history h
set card_bills = b.unpaid,
    liabilities = h.liabilities + b.unpaid
from (
  select user_id, sum(amount) as unpaid from public.card_bills
  where not paid group by user_id
) b
where b.user_id = h.user_id and h.card_bills = 0;

select public.record_net_worth(id) from auth.users;
