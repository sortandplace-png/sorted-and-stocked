// app/properties/[id]/tools/digest/page.tsx
// SS-019 Digest Preview -- in-app, view-only. Deliberately does NOT
// build: any automated email/SMS dispatch (that hold stays active, this
// is a preview of what such a digest would show, not the digest itself),
// the Asset Custody Tracker or anything reading borrowed_items (dormant,
// zero rows, no activation decision made), or anything depending on SOP
// completion data (not confirmed live).
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import Pin from '@/components/PinAccent';
import { CardHeader } from '@/components/ShiftHandoverClient';
import OrderLink from '@/components/OrderLink';
import PhotoOrFallback from '@/components/PhotoOrFallback';
import { getLowStockByVendor, getMealPlanGapAnalysis } from '@/lib/digest-data';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
      <Pin size="sm" />
      <CardHeader>{title}</CardHeader>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Same real Eastern-date anchoring used throughout the app (Dashboard,
// calendar-trigger-type.ts) -- a plain new Date().toISOString() reads UTC
// regardless of server timezone, which would shift the 7-day meal-plan
// window a day early on any Eastern evening.
function easternTodayStr(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default async function DigestPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;
  const todayStr = easternTodayStr();

  const [lowStockByVendor, gaps] = await Promise.all([
    getLowStockByVendor(propertyId),
    getMealPlanGapAnalysis(propertyId, todayStr),
  ]);

  return (
    <div className="bg-mist min-h-screen p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-display text-denim">Household Digest</h1>
            <p className="text-sm text-dusk">A preview of what's low and what's coming up — view only.</p>
          </div>
          <Link
            href={`/properties/${propertyId}/meal-plan`}
            className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-denim bg-card border border-cardBorder rounded-full px-3.5 py-1.5 shadow-card hover:bg-mist transition-colors"
          >
            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
            Edit Meal Plan
          </Link>
        </div>

        <Card title="Low Stock & Par Level Alerts">
          {lowStockByVendor.length === 0 ? (
            <p className="text-sm text-dusk py-2">Nothing below par right now.</p>
          ) : (
            <div className="space-y-4">
              {lowStockByVendor.map((group) => (
                <div key={group.vendor}>
                  <h3 className="text-[10px] tracking-[0.14em] uppercase font-semibold text-brass mb-2">
                    {group.vendor} ({group.items.length})
                  </h3>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2.5 bg-mist rounded-xl px-3 py-2">
                        <PhotoOrFallback src={item.photoUrl} alt="" sizeClass="w-9 h-9" className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-denim truncate">{item.name}</span>
                          <span className="block text-xs text-rust">
                            {item.currentQty} / {item.minQty} — short {item.shortBy}
                          </span>
                        </span>
                        <OrderLink itemName={item.name} sources={item.reorderSources} fallbackLink={item.reorderLink} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="This Week's Meal Plan Gaps">
          {gaps.length === 0 ? (
            <p className="text-sm text-dusk py-2">Everything planned this week is covered by current stock.</p>
          ) : (
            <ul className="space-y-1.5">
              {gaps.map((gap) => (
                <li key={gap.inventoryItemId} className="bg-mist rounded-xl px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-denim truncate">{gap.name}</span>
                    <span className="text-xs text-rust font-medium shrink-0">
                      Need {gap.needed}{gap.unit ?? ''}, have {gap.currentQty}{gap.unit ?? ''}
                    </span>
                  </div>
                  <p className="text-xs text-dusk mt-0.5 truncate">For: {gap.recipeNames.join(', ')}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
