-- Card statements are logged for milestones only, not as money owed (owner,
-- 8 Nov 2026): counting them inflated debt, and the bank balance that pays
-- them isn't tracked. Net worth is holdings minus loans again.

drop trigger if exists card_bills_net_worth on public.card_bills;

create or replace function public.record_net_worth(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip while an account is being deleted.
  if uid is null or not exists (select 1 from auth.users where id = uid) then
    return;
  end if;
  insert into net_worth_history (user_id, day, assets, liabilities, card_bills)
  values (
    uid,
    (now() at time zone 'Asia/Kolkata')::date,
    coalesce((select sum(current_value) from holdings where user_id = uid), 0),
    coalesce((select sum(outstanding) from loans where user_id = uid), 0),
    0
  )
  on conflict (user_id, day) do update
    set assets = excluded.assets,
        liabilities = excluded.liabilities,
        card_bills = 0,
        updated_at = now();
end;
$$;
revoke all on function public.record_net_worth(uuid) from public, anon, authenticated;

-- Take card bills back out of the history kept so far.
update public.net_worth_history
set liabilities = liabilities - card_bills, card_bills = 0
where card_bills <> 0;
