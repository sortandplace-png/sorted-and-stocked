// components/DashboardWidgets.tsx
// Dashboard Widgets v1 -- 3 fixed cards (Today's Meal Plan, Low Stock
// Alerts, Shabbos/Yom Tov Countdown), all additive to the existing
// Dashboard content. Home Pulse Score was removed 2026-07-16 -- its
// underlying scoring formula was unreliable (see home_pulse_score view),
// not a UI issue, so it came off the page entirely rather than being
// patched around. Visibility/order persisted per-user, per-property in
// dashboard_widget_prefs (migration 090); RLS scopes every row to
// auth.uid(), so this upserts directly from the browser client, same
// pattern as PrepAheadAssistant's feature-flag toggle.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Settings2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import Pin from '@/components/PinAccent';
import type { WidgetKey, WidgetPrefs, TodaysMealEntry, LowStockItem } from '@/lib/dashboard-widgets-data';
import type { UpcomingObservance } from '@/lib/get-next-observance';

export default function DashboardWidgets({
  propertyId,
  initialPrefs,
  todaysMeals,
  lowStockItems,
  nextObservance,
  isShabbosOrYomTovDinner,
}: {
  propertyId: string;
  initialPrefs: WidgetPrefs;
  todaysMeals: TodaysMealEntry[];
  lowStockItems: LowStockItem[];
  nextObservance: UpcomingObservance | null;
  isShabbosOrYomTovDinner: boolean;
}) {
  const t = useTranslations('dashboard.widgets');
  const WIDGET_LABELS: Record<WidgetKey, string> = {
    todays_meal_plan: t('labelTodaysMealPlan'),
    low_stock_alerts: t('labelLowStockAlerts'),
    holiday_countdown: t('labelHolidayCountdown'),
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleKeys.map((key) => {
              if (key === 'todays_meal_plan') return <TodaysMealPlanCard key={key} title={WIDGET_LABELS.todays_meal_plan} propertyId={propertyId} meals={todaysMeals} isShabbosOrYomTov={isShabbosOrYomTovDinner} />;
              if (key === 'low_stock_alerts') return <LowStockAlertsCard key={key} title={WIDGET_LABELS.low_stock_alerts} propertyId={propertyId} items={lowStockItems} />;
              return <HolidayCountdownCard key={key} title={WIDGET_LABELS.holiday_countdown} observance={nextObservance} />;
            })}
          </div>
        )}
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
function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px]">
      <Pin size="sm" />
      <h3 className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass mb-2.5">{title}</h3>
      {children}
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

// Only this widget gets a fixed header image, so it builds its own shell
// (matching WidgetCard's mist/brass-border/xl2/shadow/pin exactly) instead
// of using the shared WidgetCard, which has no image slot. The image is a
// background-image div, not an <img> -- same technique as the Candle
// Lighting card's fixed-height photo band -- so a missing/failed
// /meal-plan-card.png.png silently renders nothing rather than a broken-image
// icon, which is exactly the "no fallback placeholder" behavior asked for.
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
    <div className="relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow overflow-hidden">
      <Pin size="sm" />
      <div
        className="h-[140px] w-full"
        style={{
          backgroundImage: "url('/meal-plan-card.png.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="py-[14px] px-[18px]">
        <h3 className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass mb-2.5">{title}</h3>
        {meals.length === 0 ? (
          <p className="text-sm text-dusk">{t('nothingPlannedToday')}</p>
        ) : (
          <div className="space-y-2">
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
        <Link href={`/properties/${propertyId}/meal-plan`} className="inline-block mt-2.5 text-[11px] font-bold text-brass underline underline-offset-2">
          {t('viewFullPlan')}
        </Link>
      </div>
    </div>
  );
}

function LowStockAlertsCard({ title, propertyId, items }: { title: string; propertyId: string; items: LowStockItem[] }) {
  const t = useTranslations('dashboard.widgets');
  const preview = items.slice(0, 5);
  return (
    <WidgetCard title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-dusk">{t('allStocked')}</p>
      ) : (
        <ul className="space-y-1">
          {preview.map((item) => (
            <li key={item.id} className="text-sm text-denim flex items-center justify-between gap-2">
              <span className="truncate">{item.name}</span>
              <span className="text-rust font-medium text-xs shrink-0">
                {item.currentQty}/{item.minQty}
              </span>
            </li>
          ))}
        </ul>
      )}
      {items.length > preview.length && <p className="text-xs text-dusk mt-1.5">{t('moreCount', { count: items.length - preview.length })}</p>}
      <Link href={`/properties/${propertyId}/inventory`} className="inline-block mt-2.5 text-[11px] font-bold text-brass underline underline-offset-2">
        {t('viewInventory')}
      </Link>
    </WidgetCard>
  );
}

function HolidayCountdownCard({ title, observance }: { title: string; observance: UpcomingObservance | null }) {
  const t = useTranslations('dashboard.widgets');
  return (
    <WidgetCard title={title}>
      {observance ? (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-display text-denim">{observance.name}</span>
          <span className="text-sm text-dusk">{observance.daysUntil === 0 ? t('today') : t('daysUntilShort', { count: observance.daysUntil })}</span>
        </div>
      ) : (
        <p className="text-sm text-dusk">{t('noneFound')}</p>
      )}
    </WidgetCard>
  );
}
