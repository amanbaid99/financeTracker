-- Admins can manage the invite list from the app.
--
-- Admin status lives in its own table with no policies, so nobody can read or
-- change it through the API (unlike profiles, which users can edit). The only
-- way in is through the functions below, which check the caller is an admin.

create table public.app_admins (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
alter table public.app_admins force row level security;
revoke all on public.app_admins from anon, authenticated;

/** The signed-in user's email, lowercased. */
create or replace function public.caller_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u where u.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.email = public.caller_email())
$$;

/** Everyone on the invite list, and whether they've signed up yet. */
create or replace function public.list_invites()
returns table (email text, note text, added_at timestamptz, joined boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see invites' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.email, a.note, a.added_at,
           exists (select 1 from auth.users u where lower(u.email) = a.email) as joined
    from public.allowed_emails a
    order by a.added_at desc;
end;
$$;

create or replace function public.add_invite(p_email text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Only admins can invite people' using errcode = 'insufficient_privilege';
  end if;
  if e is null or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 254 then
    raise exception 'That email doesn''t look right' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.allowed_emails (email, note)
  values (e, nullif(left(trim(coalesce(p_note, '')), 80), ''))
  on conflict (email) do update set note = excluded.note;
end;
$$;

/** Stops new sign-ups with this email. An existing account isn't touched. */
create or replace function public.remove_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove invites' using errcode = 'insufficient_privilege';
  end if;
  if e = public.caller_email() then
    raise exception 'You can''t remove your own invite' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.allowed_emails where email = e;
end;
$$;

revoke all on function public.caller_email() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.list_invites() from public, anon;
revoke all on function public.add_invite(text, text) from public, anon;
revoke all on function public.remove_invite(text) from public, anon;
grant execute on function public.caller_email() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.list_invites() to authenticated;
grant execute on function public.add_invite(text, text) to authenticated;
grant execute on function public.remove_invite(text) to authenticated;
