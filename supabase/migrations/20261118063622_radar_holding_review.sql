-- Optional owner-confirmed review inputs. No existing item is opted in.
alter table public.radar_watchlist add column holding_review jsonb
  check (holding_review is null or
    (jsonb_typeof(holding_review) = 'object' and octet_length(holding_review::text) <= 4096));
comment on column public.radar_watchlist.holding_review is
  'Owner-reviewed holding context, validated by the application. Never establishes source verification or a live recommendation.';
-- Existing Radar entitlement and owner RLS policies apply to this column.
