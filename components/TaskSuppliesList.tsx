// components/TaskSuppliesList.tsx
// The one renderer for task_supplies, shared by the Task Center tile and
// the Procedures (SOP) card so the two can't drift -- the same reason
// OrderLink itself exists as a shared component rather than five spellings
// of "Order".
//
// Row shape (photo / name / note / cart icon) deliberately matches the
// existing supply-ish rows in DashboardWidgets' Low Stock and Shopping List
// cards rather than inventing a new one.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Package } from 'lucide-react';
import OrderLink from '@/components/OrderLink';
import { supplyItemName, supplyNote, type TaskSupply } from '@/lib/task-supplies';

export default function TaskSuppliesList({
  supplies,
  onRemove,
  removingId,
}: {
  supplies: TaskSupply[];
  /** Manager-only. Omitted entirely on read-only surfaces (the SOP card),
   *  which is what keeps this component usable from both places. */
  onRemove?: (supplyId: string) => void;
  removingId?: string | null;
}) {
  const t = useTranslations('taskSupplies');
  const locale = useLocale();

  if (supplies.length === 0) return null;

  return (
    <div className="mt-2">
      <p className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass mb-1.5">
        {t('heading')}
      </p>
      <ul className="space-y-1.5">
        {supplies.map((s) => {
          const name = supplyItemName(s.item, locale);
          const note = supplyNote(s, locale);
          return (
            <li key={s.id} className="flex items-start gap-2 bg-mist rounded-xl2 px-2.5 py-2">
              {s.item?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.item.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-card" />
              ) : (
                <span className="w-8 h-8 rounded-lg bg-card shrink-0 flex items-center justify-center">
                  <Package size={14} strokeWidth={1.5} className="text-dusk" aria-hidden="true" />
                </span>
              )}

              <span className="flex-1 min-w-0">
                {/* An item deleted out from under its supply row leaves
                    inventory_item_id null rather than removing the row --
                    say so instead of rendering an empty line. */}
                <span className="block text-sm text-denim truncate">{name || t('itemMissing')}</span>
                {note && <span className="block text-xs text-dusk">{note}</span>}
              </span>

              {s.item && (
                <OrderLink
                  itemName={s.item.name}
                  sources={s.item.reorder_sources}
                  fallbackLink={s.item.reorder_link}
                />
              )}

              {onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(s.id);
                  }}
                  disabled={removingId === s.id}
                  aria-label={t('removeSupply', { name: name || t('itemMissing') })}
                  className="shrink-0 text-dusk hover:text-rust text-xs px-1 disabled:opacity-40"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
