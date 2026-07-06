-- ============================================================================
-- 009: QR tokens for individual inventory items
-- ============================================================================
-- inventory_items.qr_code has existed since 001_init_schema.sql but nothing
-- ever auto-generated it (only locations got that treatment, in 002). Needed
-- now that labels are per-item instead of per-room.

create or replace function public.generate_item_qr_code()
returns trigger
language plpgsql
as $$
begin
  if new.qr_code is null then
    new.qr_code := 'ITM-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  end if;
  return new;
end;
$$;

create trigger trg_inventory_items_qr_code
  before insert on public.inventory_items
  for each row execute procedure public.generate_item_qr_code();

-- Backfill existing items (including everything from the Strauss import).
update public.inventory_items
set qr_code = 'ITM-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))
where qr_code is null;
