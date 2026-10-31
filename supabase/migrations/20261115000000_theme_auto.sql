-- "Match phone": follow the phone's light or dark mode.
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('auto', 'white', 'black', 'beige'));
