// components/DashboardWidgets.tsx
// Dashboard Widgets v1 -- 4 fixed cards (Home Pulse Score, Today's Meal
// Plan, Low Stock Alerts, Shabbos/Yom Tov Countdown), all additive to the
// existing Dashboard content. Visibility/order persisted per-user,
// per-property in dashboard_widget_prefs (migration 090); RLS scopes every
// row to auth.uid(), so this upserts directly from the browser client, same
// pattern as PrepAheadAssistant's feature-flag toggle.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Activity, Settings2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import type { WidgetKey, WidgetPrefs, HomePulseScore, TodaysMealEntry, LowStockItem } from '@/lib/dashboard-widgets-data';
import type { UpcomingObservance } from '@/lib/get-next-observance';

export default function DashboardWidgets({
  propertyId,
  initialPrefs,
  homePulseScore,
  todaysMeals,
  lowStockItems,
  nextObservance,
}: {
  propertyId: string;
  initialPrefs: WidgetPrefs;
  homePulseScore: HomePulseScore;
  todaysMeals: TodaysMealEntry[];
  lowStockItems: LowStockItem[];
  nextObservance: UpcomingObservance | null;
}) {
  const t = useTranslations('dashboard.widgets');
  const WIDGET_LABELS: Record<WidgetKey, string> = {
    home_pulse_score: t('labelHomePulseScore'),
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
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] tracking-[0.16em] uppercase font-bold text-denim">{t('sectionTitle')}</span>
        <button
          onClick={() => setEditing((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-bold text-brass underline underline-offset-2"
        >
          <Settings2 size={13} strokeWidth={2.25} aria-hidden="true" />
          {editing ? t('done') : t('editWidgets')}
        </button>
      </div>

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
            if (key === 'home_pulse_score') return <HomePulseScoreCard key={key} title={WIDGET_LABELS.home_pulse_score} data={homePulseScore} />;
            if (key === 'todays_meal_plan') return <TodaysMealPlanCard key={key} title={WIDGET_LABELS.todays_meal_plan} propertyId={propertyId} meals={todaysMeals} />;
            if (key === 'low_stock_alerts') return <LowStockAlertsCard key={key} title={WIDGET_LABELS.low_stock_alerts} propertyId={propertyId} items={lowStockItems} />;
            return <HolidayCountdownCard key={key} title={WIDGET_LABELS.holiday_countdown} observance={nextObservance} />;
          })}
        </div>
      )}
    </div>
  );
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl3 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow p-5 bg-card">
      <h3 className="text-xs font-bold uppercase tracking-wider text-denim mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function HomePulseScoreCard({ title, data }: { title: string; data: HomePulseScore }) {
  const t = useTranslations('dashboard.widgets');
  if (!data) {
    return (
      <WidgetCard title={title}>
        <p className="text-sm text-dusk">{t('notAvailable')}</p>
      </WidgetCard>
    );
  }
  const rows: [string, number][] = [
    [t('stock'), data.stockScore],
    [t('tasks'), data.taskScore],
    [t('listFreshness'), data.listFreshnessScore],
  ];
  return (
    <WidgetCard title={title}>
      <div className="flex items-baseline gap-1.5 mb-3">
        <Activity size={16} strokeWidth={2} className="text-brass" aria-hidden="true" />
        <span className="text-3xl font-display text-denim">{Math.round(data.pulseScore)}</span>
        <span className="text-xs text-dusk">{t('outOf100')}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map(([label, score]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-dusk w-24 shrink-0">{label}</span>
            <div className="flex-1 bg-mist h-1.5 rounded-full overflow-hidden">
              <div className="bg-brass h-1.5" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
            </div>
            <span className="text-xs text-denim w-7 text-right shrink-0">{Math.round(score)}</span>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function TodaysMealPlanCard({ title, propertyId, meals }: { title: string; propertyId: string; meals: TodaysMealEntry[] }) {
  const t = useTranslations('dashboard.widgets');
  const bySlot = meals.reduce<Record<string, TodaysMealEntry[]>>((acc, m) => {
    (acc[m.mealSlot] ??= []).push(m);
    return acc;
  }, {});
  return (
    <WidgetCard title={title}>
      {meals.length === 0 ? (
        <p className="text-sm text-dusk">{t('nothingPlannedToday')}</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(bySlot).map(([slot, entries]) => (
            <div key={slot}>
              <p className="text-[10.5px] uppercase tracking-wide font-bold text-dusk mb-1">{slot}</p>
              <ul className="space-y-0.5">
                {entries.map((e, i) => (
                  <li key={i} className="text-sm text-denim">
                    {e.course && <span className="text-dusk">{e.course}: </span>}
                    {e.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Link href={`/properties/${propertyId}/meal-plan`} className="inline-block mt-2.5 text-[11px] font-bold text-brass underline underline-offset-2">
        {t('viewFullPlan')}
      </Link>
    </WidgetCard>
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
