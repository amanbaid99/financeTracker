-- This version is already recorded on hosted databases. Preserve its identity.
-- On a fresh replay it precedes Radar foundation, which creates the same column.
do $migration$
begin
  if to_regclass('public.radar_watchlist') is not null then
    alter table public.radar_watchlist add column if not exists holding_review jsonb
      check (holding_review is null or
        (jsonb_typeof(holding_review) = 'object' and octet_length(holding_review::text) <= 4096));
    comment on column public.radar_watchlist.holding_review is
      'Owner-reviewed holding context, validated by the application. Never establishes source verification or a live recommendation.';
  end if;
end
$migration$;
-- Existing Radar entitlement and owner RLS policies apply to this column.
