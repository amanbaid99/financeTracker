-- Nullable because historic import times cannot be reconstructed reliably.
-- Existing settings ownership policies protect this field too.
alter table public.settings add column if not exists last_cas_import_at timestamptz;
comment on column public.settings.last_cas_import_at is 'Time of the last successfully saved CAS import, not the statement valuation date.';
