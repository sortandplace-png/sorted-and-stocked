// components/DashboardWidgets.tsx
// Dashboard Widgets -- 2 toggleable/reorderable cards (Today's Meal Plan,
// Prep Ahead Assistant), plus a fixed (always-shown, not part of the
// edit/reorder system) Low Stock Alerts + Shopping List summary row below
// them. Restructured 2026-07-17: Shabbos/Yom Tov Countdown was removed
// entirely (it duplicated the observance pill already shown in the
// property header on every page -- app/properties/[id]/layout.tsx), and
// Prep Ahead Assistant moved from its own standalone full-width card
// (previously rendered separately in dashboard/page.tsx) into this
// widget's other toggleable slot, gaining the same image-right treatment
// as Today's Meal Plan. Home Pulse Score was removed 2026-07-16 -- its
// underlying scoring formula was unreliable (see home_pulse_score view),
// not a UI issue, so it came off the page entirely rather than being
// patched around. Visibility/order persisted per-user, per-property in
// dashboard_widget_prefs (migration 090, key rename in migration 103);
// RLS scopes every row to auth.uid(), so this upserts directly from the
// browser client.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { format, parseISO } from 'date-fns';
import { Settings2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import Pin from '@/components/PinAccent';
import { useCardCollapse } from '@/lib/useCardCollapse';
import type { WidgetKey, WidgetPrefs, TodaysMealEntry, LowStockItem } from '@/lib/dashboard-widgets-data';
import { updateShoppingItemStatus } from '@/lib/api/shoppingList';
import { markLowStockItemPurchased } from '@/lib/shopping-list-actions';
import type { ReorderSource } from '@/lib/reorder-sources';
import OrderLink from '@/components/OrderLink';

type PrepAheadReminder = { recipeId: string | null; recipeName: string; planDate: string; prepLeadDays: number | null };

export default function DashboardWidgets({
  propertyId,
  initialPrefs,
  todaysMeals,
  lowStockItems,
  shoppingListCount,
  shoppingListPreview,
  prepAheadReminders,
  prepAheadEnabled,
  canManagePrepAhead,
  isShabbosOrYomTovDinner,
}: {
  propertyId: string;
  initialPrefs: WidgetPrefs;
  todaysMeals: TodaysMealEntry[];
  lowStockItems: LowStockItem[];
  shoppingListCount: number;
  shoppingListPreview: { id: string; name: string; nameEs: string | null; photoUrl: string | null; qtyNeeded: number | null; reorderSources: ReorderSource[] | null; reorderLink: string | null }[];
  prepAheadReminders: PrepAheadReminder[];
  prepAheadEnabled: boolean;
  canManagePrepAhead: boolean;
  isShabbosOrYomTovDinner: boolean;
}) {
  const t = useTranslations('dashboard.widgets');
  const WIDGET_LABELS: Record<WidgetKey, string> = {
    todays_meal_plan: t('labelTodaysMealPlan'),
    prep_ahead: t('labelPrepAhead'),
  };
  const [prefs, setPrefs] = useState(initialPrefs);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const showToast = useToast();

  const orderedKeys = (Object.keys(prefs) as WidgetKey[]).sort((a, b) => prefs[a].sortOrder - prefs[b].sortOrder);
  const visibleKeys = orderedKeys.filter((k) => prefs[k].isVisible);

  async function persist(next: WidgetPrefs) {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const rows = (Object.keys(next) as WidgetKey[]).map((key) => ({
      user_id: user.id,
      property_id: propertyId,
      widget_key: key,
      is_visible: next[key].isVisible,
      sort_order: next[key].sortOrder,
    }));
    const { error } = await supabase.from('dashboard_widget_prefs').upsert(rows, { onConflict: 'user_id,property_id,widget_key' });
    setSaving(false);
    if (error) showToast(t('saveFailedToast'), { variant: 'error' });
  }

  function toggleVisible(key: WidgetKey) {
    const next = { ...prefs, [key]: { ...prefs[key], isVisible: !prefs[key].isVisible } };
    setPrefs(next);
    persist(next);
  }

  function move(key: WidgetKey, direction: -1 | 1) {
    const currentIndex = orderedKeys.indexOf(key);
    const swapIndex = currentIndex + direction;
    if (swapIndex < 0 || swapIndex >= orderedKeys.length) return;
    const swapKey = orderedKeys[swapIndex];
    const next: WidgetPrefs = {
      ...prefs,
      [key]: { ...prefs[key], sortOrder: prefs[swapKey].sortOrder },
      [swapKey]: { ...prefs[swapKey], sortOrder: prefs[key].sortOrder },
    };
    setPrefs(next);
    persist(next);
  }

  return (
    <div className="mb-8 rounded-xl3 border border-cardBorder shadow-card overflow-hidden bg-card">
      {/* Same denim-strip header pattern as Pantry/Meal Plan/Quick Capture
          (bg-denim, white, 10px, semibold, tracking-[0.17em], uppercase,
          py-[11px] px-5) -- "Edit widgets" moves inside the bar itself,
          same right-aligned-within-the-bar placement the Figma source uses
          for Erev Shabbos Prep's status chip + chevron. Brass reads far
          more legibly here than it did on the old white/cream card (a real
          accessibility win, not just a style match) -- warm gold on dark
          denim clears contrast easily where brass-on-white did not. */}
      <div className="bg-denim text-white text-[10px] font-semibold tracking-[0.17em] uppercase py-[11px] px-5 flex items-center justify-between">
        <span>{t('sectionTitle')}</span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 normal-case tracking-normal font-semibold text-[11px] text-brass hover:text-white transition-colors"
        >
          <Settings2 size={13} strokeWidth={2.25} aria-hidden="true" />
          {editing ? t('done') : t('editWidgets')}
        </button>
      </div>

      <div className="p-5">
        {editing && (
          <div className="space-y-2 mb-4">
            {orderedKeys.map((key, i) => (
              <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-xl2 border border-cardBorder bg-card">
                <span className={`text-sm font-medium ${prefs[key].isVisible ? 'text-denim' : 'text-dusk'}`}>{WIDGET_LABELS[key]}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => move(key, -1)}
                    disabled={saving || i === 0}
                    className="p-1 text-dusk hover:text-denim disabled:opacity-30"
                    aria-label={t('moveUpAria', { label: WIDGET_LABELS[key] })}
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => move(key, 1)}
                    disabled={saving || i === orderedKeys.length - 1}
                    className="p-1 text-dusk hover:text-denim disabled:opacity-30"
                    aria-label={t('moveDownAria', { label: WIDGET_LABELS[key] })}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => toggleVisible(key)}
                    disabled={saving}
                    className="p-1 text-dusk hover:text-denim disabled:opacity-30"
                    aria-label={prefs[key].isVisible ? t('hideAria', { label: WIDGET_LABELS[key] }) : t('showAria', { label: WIDGET_LABELS[key] })}
                  >
                    {prefs[key].isVisible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleKeys.length === 0 ? (
          !editing && <p className="text-sm text-dusk">{t('allHidden')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            {visibleKeys.map((key) => {
              if (key === 'todays_meal_plan') return <TodaysMealPlanCard key={key} title={WIDGET_LABELS.todays_meal_plan} propertyId={propertyId} meals={todaysMeals} isShabbosOrYomTov={isShabbosOrYomTovDinner} />;
              return (
                <PrepAheadWidgetCard
                  key={key}
                  title={WIDGET_LABELS.prep_ahead}
                  propertyId={propertyId}
                  reminders={prepAheadReminders}
                  enabled={prepAheadEnabled}
                  canManage={canManagePrepAhead}
                />
              );
            })}
          </div>
        )}

        {/* Fixed row -- always shown, not part of the show/hide/reorder
            system above (Low Stock Alerts and the shopping-list count are
            operational, not optional). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 items-stretch">
          <LowStockAlertsCard title={t('labelLowStockAlerts')} propertyId={propertyId} items={lowStockItems} />
          <ShoppingListSummaryCard propertyId={propertyId} count={shoppingListCount} preview={shoppingListPreview} />
        </div>
      </div>
    </div>
  );
}

// Exact ActionTile visual language (app/properties/[id]/dashboard/page.tsx's
// quick-action tiles): bg-mist, border-brass/30, rounded-xl2 (20px, not the
// old xl3/28px), shadow-card/hover:shadow-cardHover, py-[14px] px-[18px]
// (pulled from the tile literally, not estimated -- cramped for this
// denser content, but that's what was asked for), and the same brass pin
// dot in the same top-right position. Eyebrow label matches the tile
// eyebrow exactly: 9px, tracking-[0.2em], uppercase, font-semibold, brass.
// `image`, when provided, switches to the same content-left/image-right
// row TodaysMealPlanCard/PrepAheadWidgetCard already use (w-[42%] image
// slot, min-h-[100px] floor so the mosaic has room to read as a grid
// rather than a squished sliver) instead of the plain full-width layout --
// padding moves from the outer container onto just the content column so
// the image can reach the card's own edges, same as those two cards.
// Omitting `image` keeps this component's original plain behavior
// untouched (still used bare wherever a caller has no photo to show).
function WidgetCard({
  cardId,
  title,
  image,
  children,
}: {
  cardId: string;
  title: string;
  image?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { collapsed, toggle } = useCardCollapse(cardId);
  return (
    <div
      className={`relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow overflow-hidden flex flex-col ${
        image ? (collapsed ? '' : 'min-h-[100px]') : 'py-[14px] px-[18px]'
      }`}
    >
      <Pin size="sm" collapsed={collapsed} onToggle={toggle} />
      <h3
        className={`text-[9px] tracking-[0.2em] uppercase font-semibold text-brass ${
          image ? 'pt-[10px] px-[16px] pb-2' : 'mb-2.5'
        }`}
      >
        {title}
      </h3>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? '' : image ? 'flex-1' : ''}`}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        {image ? (
          <div className="overflow-hidden flex min-h-0">
            <div className="flex-1 min-w-0 px-[16px] pb-[10px]">{children}</div>
            <div className="w-[42%] shrink-0">{image}</div>
          </div>
        ) : (
          <div className="overflow-hidden min-h-0">{children}</div>
        )}
      </div>
    </div>
  );
}

// Compact photo grid for the Low Stock Alerts / Shopping List image slots.
// Racquel's own explicit direction, not a generic stock photo: "the items
// that are low, same pic as inventory" / "pics of ingredients" -- reuse
// each real item's existing photo_url rather than sourcing new stock
// imagery. Adapts to however many photos are actually available (1-4);
// callers filter out items with no photo before this ever sees them, and
// pass undefined (not this component) when zero are available, so
// WidgetCard falls back to its plain no-image layout instead of reserving
// a blank 42% slot.
function PhotoMosaic({ photos }: { photos: string[] }) {
  const shown = photos.slice(0, 4);
  return (
    <div className={`grid h-full gap-[2px] bg-cardBorder ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {shown.map((url, i) => (
        <div key={i} style={{ backgroundImage: `url('${url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      ))}
    </div>
  );
}

// Hardcoded dinner course order -- not derived from data, not a sort.
// Dessert never appears on a weekday; any course not in the day-appropriate
// array (including kids_platter, which is in neither) simply doesn't render
// on this widget. Only applies to the 'dinner' slot -- breakfast/lunch
// entries render in their existing sequence order, untouched.
const WEEKDAY_DINNER_ORDER = ['soup', 'protein', 'starch', 'vege', 'salad', 'dip'];
const SHABBOS_DINNER_ORDER = ['soup', 'protein', 'starch', 'vege', 'salad', 'dip', 'dessert'];

// Only this widget gets an image, so it builds its own shell (matching
// WidgetCard's mist/brass-border/xl2/shadow/pin exactly) instead of using
// the shared WidgetCard, which has no image slot. Side-by-side layout and
// the 42% image width are pulled directly from the real Pantry card
// (app/properties/[id]/dashboard/page.tsx) -- same technique, mirrored to
// the right side: no fixed image height (a plain flex child stretches to
// match the content column via the row's default align-items:stretch,
// exactly like Pantry's own image div), and no explicit border-radius on
// the image itself -- the outer rounded-xl2 + overflow-hidden clips its
// top-right/bottom-right corners automatically, while its left edge (an
// interior seam against the text column) stays naturally square with zero
// extra CSS, same as Pantry's un-rounded interior edge. The image is a
// background-image div, not an <img>, so a missing/failed
// /meal-plan-card.png.png silently renders nothing rather than a broken-
// image icon -- the "no fallback placeholder" behavior asked for earlier.
function TodaysMealPlanCard({
  title,
  propertyId,
  meals,
  isShabbosOrYomTov,
}: {
  title: string;
  propertyId: string;
  meals: TodaysMealEntry[];
  isShabbosOrYomTov: boolean;
}) {
  const t = useTranslations('dashboard.widgets');
  const { collapsed, toggle } = useCardCollapse('todays-meal-plan');
  const bySlot = meals.reduce<Record<string, TodaysMealEntry[]>>((acc, m) => {
    (acc[m.mealSlot] ??= []).push(m);
    return acc;
  }, {});

  function orderedEntries(slot: string, entries: TodaysMealEntry[]): TodaysMealEntry[] {
    if (slot !== 'dinner') return entries;
    const order = isShabbosOrYomTov ? SHABBOS_DINNER_ORDER : WEEKDAY_DINNER_ORDER;
    return order
      .map((slug) => entries.find((e) => e.courseSlug === slug))
      .filter((e): e is TodaysMealEntry => !!e);
  }

  return (
    <div className={`relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow overflow-hidden flex flex-col ${collapsed ? '' : 'min-h-[100px]'}`}>
      <Pin size="sm" collapsed={collapsed} onToggle={toggle} />
      <h3 className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass pt-[10px] px-[16px] pb-2">{title}</h3>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? '' : 'flex-1'}`}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden flex min-h-0">
          <div className="flex-1 px-[16px] pb-[10px]">
            {meals.length === 0 ? (
              <p className="text-sm text-dusk">{t('nothingPlannedToday')}</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(bySlot).map(([slot, rawEntries]) => {
                  const entries = orderedEntries(slot, rawEntries);
                  if (entries.length === 0) return null;
                  return (
                    <div key={slot}>
                      <p className="text-[10.5px] uppercase tracking-wide font-bold text-dusk mb-1">{slot}</p>
                      <ul className="space-y-0.5">
                        {entries.map((e, i) => (
                          <li key={i} className="text-sm text-denim">
                            {e.course && <span className="text-dusk">{e.course}: </span>}
                            {e.recipeId ? (
                              <Link
                                href={`/properties/${propertyId}/recipes/${e.recipeId}`}
                                className="text-brass hover:underline underline-offset-2"
                              >
                                {e.name}
                              </Link>
                            ) : (
                              e.name
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            <Link href={`/properties/${propertyId}/meal-plan`} className="inline-block mt-2 text-[11px] font-bold text-brass underline underline-offset-2">
              {t('viewFullPlan')}
            </Link>
          </div>
          <div
            className="w-[42%] shrink-0"
            style={{
              backgroundImage: "url('/meal-plan-card.png.png')",
              backgroundSize: 'cover',
              // 'center' was already set, but the pot itself sits left-of-center
              // in the source photo (its handle extends further left still) --
              // in this narrow 42%-wide slice, a center-anchored crop was
              // clipping the pot's left edge while showing mostly empty counter
              // space on the right. Anchoring left instead keeps the pot (and
              // its handle) in frame.
              backgroundPosition: 'left center',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Each row carries its own photo directly beside its name now, same
// per-item row format the full Shopping List card already uses correctly
// -- replaces the old layout, which showed name-only rows next to one
// detached PhotoMosaic block that had no connection to which item was
// which. No image slot on WidgetCard means the plain (non-image) shell.
//
// SS-150/audit: checkbox added, matching the Shopping List tile --
// Racquel: "you should be able to tick something off from either."
// Confirmed live before wiring this: low-stock items and pending shopping-
// list rows are almost entirely disjoint (1 of 193 had a matching pending
// row), so this can't just be "find the row and mark it purchased" --
// markLowStockItemPurchased() finds-or-creates one, tying into the same
// real shopping_list_items.status the Shopping List tile's own checkbox
// uses. Deliberately doesn't touch inventory_items.current_qty -- a real
// recount belongs on the Inventory page's own +/- stepper, not a tap here.
function LowStockAlertsCard({ title, propertyId, items }: { title: string; propertyId: string; items: LowStockItem[] }) {
  const t = useTranslations('dashboard.widgets');
  const locale = useLocale();
  const displayName = (item: LowStockItem) => (locale === 'es' && item.nameEs ? item.nameEs : item.name);
  const showToast = useToast();
  const supabase = createClient();
  const [rows, setRows] = useState(items);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const preview = rows.slice(0, 5);

  async function markPurchased(item: LowStockItem) {
    if (pending.has(item.id)) return;
    setPending((p) => new Set(p).add(item.id));
    const result = await markLowStockItemPurchased(supabase, propertyId, {
      id: item.id,
      name: item.name,
      category: item.category,
    });
    setPending((p) => {
      const next = new Set(p);
      next.delete(item.id);
      return next;
    });
    if (!result.ok) {
      showToast(t('saveFailedToast'), { variant: 'error' });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== item.id));
  }

  return (
    <WidgetCard cardId="low-stock-alerts" title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-dusk">{t('allStocked')}</p>
      ) : (
        <ul className="space-y-1.5">
          {preview.map((item) => {
            return (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-cardBorder text-brass shrink-0 disabled:opacity-40"
                  disabled={pending.has(item.id)}
                  onChange={() => markPurchased(item)}
                  aria-label={`Mark ${displayName(item)} purchased`}
                />
                <Link
                  href={`/properties/${propertyId}/inventory?item=${item.id}`}
                  className="flex items-center gap-2 flex-1 min-w-0 hover:underline"
                >
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-mist" />
                  ) : (
                    <span className="w-8 h-8 rounded-lg bg-mist shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-sm text-denim">{displayName(item)}</span>
                  <span className="text-rust font-medium text-xs shrink-0">
                    {item.currentQty}/{item.minQty}
                  </span>
                </Link>
                <OrderLink itemName={item.name} sources={item.reorderSources} fallbackLink={item.reorderLink} />
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > preview.length && <p className="text-xs text-dusk mt-1.5">{t('moreCount', { count: rows.length - preview.length })}</p>}
      <div className="flex items-center gap-3 mt-2.5">
        <Link href={`/properties/${propertyId}/inventory`} className="text-[11px] font-bold text-brass underline underline-offset-2">
          {t('viewInventory')}
        </Link>
        {/* Preserved from the standalone "Inventory Items" card this tile
            replaced (SS-150-style duplicate, removed per Racquel July 19) --
            the one thing in that card this tile didn't already cover.
            ?new=1 opens the add form directly, an upgrade over that card's
            plain /inventory link. */}
        <Link href={`/properties/${propertyId}/inventory?new=1`} className="text-[11px] font-bold text-brass underline underline-offset-2">
          {t('addItem')}
        </Link>
      </div>
    </WidgetCard>
  );
}

// Mirrors TodaysMealPlanCard's own shell (flex row, Pin, content left /
// image right ~42%) rather than the shared WidgetCard, which has no image
// slot -- same reasoning TodaysMealPlanCard's own comment gives. Ported
// directly from the old standalone PrepAheadAssistant component (enabled/
// disabled feature-flag toggle, collapse toggle, reminder list, recipe
// links) -- same content and course filtering, just reshaped into this
// card's layout. /prep-ahead-card.png.png (Racquel's real filename, same
// double-extension quirk as meal-plan-card.png.png -- kept as-is rather
// than renamed, compressed in place from an 8.8MB upload down to ~50KB) is
// a background-image div, not an <img>, so a missing file would silently
// render nothing rather than a broken-image icon, same as the meal-plan
// card's image slot.
function PrepAheadWidgetCard({
  title,
  propertyId,
  reminders,
  enabled,
  canManage,
}: {
  title: string;
  propertyId: string;
  reminders: PrepAheadReminder[];
  enabled: boolean;
  canManage: boolean;
}) {
  const t = useTranslations('dashboard.prepAhead');
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const { collapsed, toggle } = useCardCollapse('prep-ahead');
  const supabase = createClient();
  const showToast = useToast();

  // Staff shouldn't see a disabled property-wide setting or a control to
  // change it -- nothing to render for them once it's off.
  if (!isEnabled && !canManage) return null;

  async function setPrepAheadEnabled(next: boolean) {
    setSaving(true);
    const { data: current } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
    const flags = (current?.feature_flags ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from('properties')
      .update({ feature_flags: { ...flags, prep_ahead_assistant: next } })
      .eq('id', propertyId);
    setSaving(false);
    if (error) {
      showToast(t('failedToUpdate'), { variant: 'error' });
      return;
    }
    setIsEnabled(next);
    showToast(next ? t('turnedOn') : t('turnedOff'), { variant: 'success' });
  }

  return (
    <div className={`relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow overflow-hidden flex flex-col ${collapsed ? '' : 'min-h-[100px]'}`}>
      <Pin size="sm" collapsed={collapsed} onToggle={toggle} />
      <div className="flex items-center justify-between gap-2 pt-[10px] px-[16px] pb-2">
        <span className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{title}</span>
          {isEnabled && <span className="text-xs text-dusk font-bold">({reminders.length})</span>}
        </span>
        {canManage && (
          <button
            onClick={() => setPrepAheadEnabled(!isEnabled)}
            disabled={saving}
            className="text-xs text-dusk underline disabled:opacity-40 shrink-0"
          >
            {isEnabled ? t('turnOff') : t('turnOn')}
          </button>
        )}
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${collapsed ? '' : 'flex-1'}`}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden flex min-h-0">
          <div className="flex-1 px-[16px] pb-[10px]">
            {!isEnabled ? (
              <p className="text-sm text-dusk">{t('off')}</p>
            ) : reminders.length === 0 ? (
              <p className="text-sm text-dusk">{t('nothingUpcoming')}</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {reminders.slice(0, 3).map((r, i) => (
                    <li key={i} className="text-sm text-denim">
                      {r.recipeId ? (
                        <Link href={`/properties/${propertyId}/recipes/${r.recipeId}`} className="font-semibold text-brass hover:underline underline-offset-2">
                          {r.recipeName}
                        </Link>
                      ) : (
                        <span className="font-semibold">{r.recipeName}</span>
                      )}
                      {' '}— {t('freezerFriendlyScheduled')}{' '}
                      {format(parseISO(r.planDate), 'EEEE, MMM d')}
                      {r.prepLeadDays ? `; ${t('startPrep')} ${r.prepLeadDays} ${r.prepLeadDays === 1 ? t('day') : t('days')} ${t('ahead')}` : ` — ${t('pullOutAhead')}`}
                    </li>
                  ))}
                </ul>
                {reminders.length > 3 && (
                  <Link href={`/properties/${propertyId}/meal-plan`} className="inline-block mt-2 text-[11px] font-bold text-brass underline underline-offset-2">
                    {t('viewAll', { count: reminders.length })}
                  </Link>
                )}
              </>
            )}
          </div>
          {/* 42% -> 30%: with the list now capped at 3 items (was
              unbounded), the photo was reading as photo-heavy relative to
              the shorter text column -- narrower image restores balance. */}
          <div
            className="w-[30%] shrink-0"
            style={{
              backgroundImage: "url('/prep-ahead-card.png.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// SS-150: was count-and-a-detached-mosaic only -- no actual items shown,
// unlike every other card in this row. Now carries the same functionality
// as the standalone Shopping List card that used to sit lower on this page
// (deleted once this tile covered it): per-item photo, name, qty, a real
// purchased-checkbox, and a working Order button. The old standalone
// card's checkbox rendered but had no onChange at all -- decorative, not
// functional -- so this isn't "copy what was there," it's the first time
// this checkbox has ever actually done anything.
//
// Needs its own local copy of `preview`/`count`: the server props only
// ever contain pending items (queried with .eq('status','pending')), so
// checking a box has nothing to revert to from props -- it optimistically
// drops the row and decrements the remaining-count line, then rolls both
// back on a failed write. Matches the optimistic-update pattern
// ShoppingListViewEnhanced.tsx already uses for the same status toggle.
function ShoppingListSummaryCard({
  propertyId,
  count,
  preview,
}: {
  propertyId: string;
  count: number;
  preview: { id: string; name: string; nameEs: string | null; photoUrl: string | null; qtyNeeded: number | null; reorderSources: ReorderSource[] | null; reorderLink: string | null }[];
}) {
  const t = useTranslations('dashboard.widgets');
  const tShop = useTranslations('dashboard.shoppingListCard');
  const locale = useLocale();
  const displayName = (item: { name: string; nameEs: string | null }) => (locale === 'es' && item.nameEs ? item.nameEs : item.name);
  const showToast = useToast();
  const [items, setItems] = useState(preview);
  const [remaining, setRemaining] = useState(count);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function markPurchased(id: string) {
    if (pending.has(id)) return;
    const prevItems = items;
    const prevRemaining = remaining;
    setPending((p) => new Set(p).add(id));
    setItems((cur) => cur.filter((i) => i.id !== id));
    setRemaining((r) => Math.max(0, r - 1));
    try {
      await updateShoppingItemStatus(id, 'purchased');
    } catch {
      setItems(prevItems);
      setRemaining(prevRemaining);
      showToast(t('saveFailedToast'), { variant: 'error' });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <WidgetCard cardId="shopping-list-summary" title={t('shoppingListLabel')}>
      {items.length === 0 ? (
        <p className="text-sm text-dusk">{t('nothingOnList')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            return (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-cardBorder text-brass shrink-0 disabled:opacity-40"
                  disabled={pending.has(item.id)}
                  onChange={() => markPurchased(item.id)}
                  aria-label={tShop('markPurchasedAria', { item: displayName(item) })}
                />
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0 bg-mist" />
                ) : (
                  <span className="w-8 h-8 rounded-lg bg-mist shrink-0" />
                )}
                {/* flex-1 min-w-0 truncate + a shrink-0 qty sibling, matching
                    LowStockAlertsCard's row exactly (line ~469 above) --
                    previously qty was a block-level child stacked under the
                    name instead of a same-line sibling, which is what
                    actually forced it to a second line. */}
                <span className="flex-1 min-w-0 truncate text-sm text-denim">{displayName(item)}</span>
                {item.qtyNeeded != null && <span className="text-xs text-dusk shrink-0">{item.qtyNeeded}</span>}
                <OrderLink itemName={item.name} sources={item.reorderSources} fallbackLink={item.reorderLink} />
              </li>
            );
          })}
        </ul>
      )}
      {remaining > items.length && <p className="text-xs text-dusk mt-1.5">{t('moreCount', { count: remaining - items.length })}</p>}
      <Link href={`/properties/${propertyId}/shopping-list`} className="inline-block mt-2.5 text-[11px] font-bold text-brass underline underline-offset-2">
        {t('viewList')}
      </Link>
    </WidgetCard>
  );
}
