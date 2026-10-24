-- Goals may have no deadline. The app then estimates when they'll be reached.
alter table public.goals alter column target_date drop not null;
