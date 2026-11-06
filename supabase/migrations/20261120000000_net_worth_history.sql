-- Net worth over time: what you own (holdings) minus what you owe (loans),
-- one row per day. The database records it whenever a holding or loan is
-- added, changed or removed, so the history needs nothing from the app.

create table public.net_worth_history (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  assets bigint not null,
  liabilities bigint not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.net_worth_history enable row level security;
create policy "Own net worth" on public.net_worth_history for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Today's totals for one person, as of now (dates in IST).
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
  insert into net_worth_history (user_id, day, assets, liabilities)
  values (
    uid,
    (now() at time zone 'Asia/Kolkata')::date,
    coalesce((select sum(current_value) from holdings where user_id = uid), 0),
    coalesce((select sum(outstanding) from loans where user_id = uid), 0)
  )
  on conflict (user_id, day) do update
    set assets = excluded.assets,
        liabilities = excluded.liabilities,
        updated_at = now();
end;
$$;
revoke all on function public.record_net_worth(uuid) from public, anon, authenticated;

create or replace function public.net_worth_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform record_net_worth(old.user_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    perform record_net_worth(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function public.net_worth_changed() from public, anon, authenticated;

create trigger holdings_net_worth
  after insert or update of current_value, user_id or delete on public.holdings
  for each row execute function public.net_worth_changed();
create trigger loans_net_worth
  after insert or update of outstanding, user_id or delete on public.loans
  for each row execute function public.net_worth_changed();

-- Start everyone's history from today.
select public.record_net_worth(id) from auth.users;
