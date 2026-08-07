// components/GroupedProductCard.tsx
// One card per master_product, varieties behind a dropdown -- the shape the
// owner asked for: "Sea Salt" as the card, Lior and plain as varieties.
//
// VARIETY-FIRST is the default because it matches how the product is thought
// about. Location-first is offered as a secondary pivot, because "what's in
// Girls Bath" is a real question too.
//
// Quantities are shown PER LOCATION and never summed. "2 in Kitchen, 1 in
// Kitchen pantry" is actionable; "3" is not. Each variety keeps its own row,
// its own quantity, and its own reorder link -- this is grouping for display,
// never a merge of data.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Pin from '@/components/PinAccent';
import { MapPin, Layers } from 'lucide-react';
import { pivotByLocation, type GroupableItem, type ProductGroup } from '@/lib/product-groups';

type Props<T extends GroupableItem> = {
  group: ProductGroup<T>;
  locationName: (id: string | null) => string;
  /** Renders one real inventory row -- reuses the caller's existing item card
   *  so a grouped row behaves exactly like an ungrouped one (stepper, reorder
   *  link, photo) rather than becoming a second, diverging implementation. */
  renderRow: (item: T) => React.ReactNode;
};

export default function GroupedProductCard<T extends GroupableItem>({
  group,
  locationName,
  renderRow,
}: Props<T>) {
  const t = useTranslations('inventory');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pivot, setPivot] = useState<'variety' | 'location'>('variety');

  const productName = locale === 'es' && group.nameEs ? group.nameEs : group.name;

  return (
    <div className="relative bg-card rounded-xl2 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow">
      <Pin size="sm" collapsed={!open} onToggle={() => setOpen((v) => !v)} />

      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left flex items-center gap-3 px-4 py-3.5"
      >
        <span className="w-11 h-11 shrink-0 rounded-xl bg-mist flex items-center justify-center">
          <Layers size={20} className="text-brass" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-denim truncate">{productName}</span>
          {/* Both dimensions, always -- a card that said only "5 varieties"
              would hide the nine bathrooms, and one that said only
              "11 locations" would hide that they are different products. */}
          <span className="block text-xs text-dusk mt-0.5">
            {t('varietyCount', { count: group.varietyCount })} · {t('locationCount', { count: group.locationCount })} ·{' '}
            {t('rowCount', { count: group.rowCount })}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-cardBorder px-4 py-3">
          <div className="flex items-center gap-1.5 mb-3">
            {(['variety', 'location'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPivot(p)}
                aria-pressed={pivot === p}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                  pivot === p ? 'bg-denim text-white border-denim' : 'bg-mist text-denim border-cardBorder'
                }`}
              >
                {p === 'variety' ? t('pivotVariety') : t('pivotLocation')}
              </button>
            ))}
          </div>

          {pivot === 'variety' ? (
            <div className="space-y-4">
              {group.varieties.map((v) => (
                <div key={v.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-brass">
                      {locale === 'es' && v.labelEs ? v.labelEs : v.label}
                    </span>
                    <span className="text-[11px] text-dusk">
                      {t('locationCount', { count: v.locationCount })}
                    </span>
                    <span className="flex-1 border-t border-cardBorder" />
                  </div>
                  <div className="space-y-2">
                    {v.rows.map(({ locationId, item }) => (
                      <div key={item.id}>
                        <p className="flex items-center gap-1 text-[11px] text-dusk mb-1">
                          <MapPin size={10} className="text-brass shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          {locationName(locationId)}
                        </p>
                        {renderRow(item)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {pivotByLocation(group).map((loc) => (
                <div key={loc.locationId ?? '_none'}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-brass">
                      {locationName(loc.locationId)}
                    </span>
                    <span className="flex-1 border-t border-cardBorder" />
                  </div>
                  <div className="space-y-2">
                    {loc.rows.map(({ label, labelEs, item }) => (
                      <div key={item.id}>
                        <p className="text-[11px] text-dusk mb-1">{locale === 'es' && labelEs ? labelEs : label}</p>
                        {renderRow(item)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
