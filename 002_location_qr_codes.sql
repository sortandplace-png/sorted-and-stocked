-- ============================================================================
-- 002: QR tokens for locations (storage areas / bins / shelves)
-- ============================================================================
-- inventory_items already has qr_code. Locations need one too, since the
-- print-labels feature generates a sticker per storage area, not per item.

alter table public.locations
  add column qr_code text unique;

create index idx_locations_qr_code on public.locations(qr_code);

-- Auto-generate a short, sticker-friendly token on insert if not supplied.
-- Format: 8 base32-ish chars, e.g. "LOC-4F9A2B7C" — short enough to print small.
create or replace function public.generate_location_qr_code()
returns trigger
language plpgsql
as $$
begin
  if new.qr_code is null then
    new.qr_code := 'LOC-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  end if;
  return new;
end;
$$;

create trigger trg_locations_qr_code
  before insert on public.locations
  for each row execute procedure public.generate_location_qr_code();

-- Backfill existing rows that predate this migration.
update public.locations
set qr_code = 'LOC-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
where qr_code is null;
