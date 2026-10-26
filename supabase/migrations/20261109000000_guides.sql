-- Remembers which section guides a person has seen and the newest
-- "What's new" release they've read, so each pops up only once.
alter table public.settings
  add column seen_guides text[] not null default '{}' check (coalesce(array_length(seen_guides, 1), 0) <= 50),
  add column whats_new_seen date;
