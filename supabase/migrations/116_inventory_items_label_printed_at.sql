-- Label Status filter on Print Labels (Unlabeled/New, Needs Update,
-- Printed): needs a real signal for "has this item's label ever been
-- generated, and has anything changed since." Nothing on inventory_items
-- tracked that before -- print_label is just "should this get a label at
-- all," not "has it."
alter table inventory_items
  add column if not exists label_printed_at timestamptz;

comment on column inventory_items.label_printed_at is
  'Set to now() whenever this item is included in a real (non-test-sheet) '
  'Print Labels PDF. NULL means never printed. Compared against updated_at '
  'to distinguish "Printed, unchanged since" from "Needs Update" -- per the '
  '2026-07-20 spec, any field change (name/quantity/QR target) after '
  'printing counts, not just label-visible fields.';
