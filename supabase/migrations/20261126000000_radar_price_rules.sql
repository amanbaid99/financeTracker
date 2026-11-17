-- Explicit user price rules. No existing record is opted in automatically.
alter table public.radar_watchlist
  add column rules_enabled boolean not null default false,
  add column holding_confirmed boolean not null default false,
  add column sell_above numeric(18,4) check (sell_above>0 and sell_above<=100000000),
  add column sell_below numeric(18,4) check (sell_below>0 and sell_below<=100000000),
  add column rules_updated_at timestamptz,
  add constraint radar_sell_rules_need_holding check (holding_confirmed or (sell_above is null and sell_below is null)),
  add constraint radar_exit_order check (sell_above is null or sell_below is null or sell_above>sell_below);
