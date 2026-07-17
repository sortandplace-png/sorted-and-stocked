// components/StaffDutyChecklist.tsx
// Recurring daily duty checklist, grouped by area -- distinct from the
// staff_tasks list already on this page (one-off assigned tasks) below it.
// staff_duty_templates/staff_duty_completions RLS already scopes every row
// to the caller's own staff_roster_key (or lets owner/manager see
// everything), matched via property_members.staff_roster_key for
// auth.uid() -- this component never filters by roster key itself, it
// only ever receives what the server query (already RLS-scoped) fetched.
// Bilingual per-row content (area_es/task_es) follows the same
// locale === 'es' && value_es pattern already used for calendar_content
// (see getDailyContent in dashboard/page.tsx), driven by the existing
// app-wide LocaleToggle rather than a page-local toggle.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

type DutyTask = { id: string; taskEn: string; taskEs: string; completed: boolean };
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] };

export default function StaffDutyChecklist({
  areas,
  hasRosterKey,
  todayStr,
}: {
  areas: DutyArea[];
  hasRosterKey: boolean;
  todayStr: string;
}) {
  const t = useTranslations('myDay.duties');
  const locale = useLocale();
  const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.flatMap((a) => a.tasks.map((task) => [task.id, task.completed])))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const supabase = createClient();
  const showToast = useToast();

  async function toggle(templateId: string, next: boolean) {
    setCompleted((prev) => ({ ...prev, [templateId]: next }));
    setSaving((prev) => ({ ...prev, [templateId]: true }));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // unique(template_id, duty_date) already enforces one row per task per
    // day -- upsert is safe to call on every toggle, no read-then-write.
    const { error } = await supabase.from('staff_duty_completions').upsert(
      {
        template_id: templateId,
        duty_date: todayStr,
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
        completed_by: next && user ? user.id : null,
      },
      { onConflict: 'template_id,duty_date' }
    );
    setSaving((prev) => ({ ...prev, [templateId]: false }));
    if (error) {
      setCompleted((prev) => ({ ...prev, [templateId]: !next }));
      showToast(t('failedToUpdate'), { variant: 'error' });
    }
  }

  if (!hasRosterKey) {
    return (
      <div className="bg-card rounded-xl2 shadow-card p-4 mb-6">
        <h2 className="font-display text-lg text-denim mb-1">{t('heading')}</h2>
        <p className="text-sm text-dusk">{t('noRoster')}</p>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="bg-card rounded-xl2 shadow-card p-4 mb-6">
        <h2 className="font-display text-lg text-denim mb-1">{t('heading')}</h2>
        <p className="text-sm text-dusk">{t('nothingNow')}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <h2 className="font-display text-lg text-denim">{t('heading')}</h2>
      {areas.map((area) => (
        <div key={area.areaEn} className="bg-card rounded-xl2 shadow-card p-4">
          <h3 className="text-[10px] tracking-[0.14em] uppercase font-semibold text-brass mb-2">
            {locale === 'es' ? area.areaEs : area.areaEn}
          </h3>
          <ul className="space-y-1.5">
            {area.tasks.map((task) => {
              const isDone = completed[task.id] ?? task.completed;
              return (
                <li key={task.id}>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDone}
                      disabled={saving[task.id]}
                      onChange={(e) => toggle(task.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-brass/40 text-brass focus:ring-brass/40 shrink-0"
                    />
                    <span className={`text-sm ${isDone ? 'text-dusk line-through' : 'text-denim'}`}>
                      {locale === 'es' ? task.taskEs : task.taskEn}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
