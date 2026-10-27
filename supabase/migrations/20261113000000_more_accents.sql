-- Ten accent colours to choose from.
alter table public.profiles drop constraint if exists profiles_accent_check;
alter table public.profiles
  add constraint profiles_accent_check check (
    accent in ('green', 'teal', 'blue', 'indigo', 'violet', 'plum', 'rose', 'terracotta', 'gold', 'graphite')
  );
