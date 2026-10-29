-- Automatic reviews are a separate, explicit opt-in. Only derived checks are saved.
create table public.portfolio_reviews (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  enabled boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  state text not null default 'idle' check (state in ('idle', 'pending', 'ready', 'basic', 'unavailable', 'limited')),
  source text not null default 'manual' check (source in ('cas', 'holding', 'balance', 'manual')),
  checked_at timestamptz,
  reviewed_at timestamptz,
  baseline jsonb,
  result jsonb
);
alter table public.portfolio_reviews enable row level security;
create policy "Own portfolio reviews" on public.portfolio_reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.portfolio_reviews to authenticated;
