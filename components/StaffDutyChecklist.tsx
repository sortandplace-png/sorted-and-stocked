// components/StaffDutyChecklist.tsx
// Recurring daily duty checklist, grouped by area -- distinct from the
// staff_tasks list already on this page (one-off assigned tasks) below it.
// task_assignments RLS already scopes every row to the caller's own
// member_id or linked staff_slots row (or lets owner/manager see
// everything) -- this component never filters by slot itself, it only
// ever receives what the server query (already RLS-scoped) fetched. Until
// a manager links an account to a slot, staff see nothing here, which is
// correct rather than broken.
// Bilingual per-row content (area_es/task_es) follows the same
// locale === 'es' && value_es pattern already used for calendar_content
// (see getDailyContent in dashboard/page.tsx), driven by the existing
// app-wide LocaleToggle rather than a page-local toggle.
//
// SS-850. Racquel's ruling: "procedure in body as well as video" -- the
// task's own photo leads, the procedure (text, then poster) shows second
// in the body, and the video that teaches it renders alongside. Nobody
// leaves a task to find out how to do it. All of it travels on the
// DutyTask this component already receives (app/properties/[id]/my-day/
// page.tsx does the fetching + signing server-side); this component only
// renders what it's given.
//
// SS-850 ALSO FIXED, found while touching this file for the above: toggle()
// used to write to staff_duty_completions (template_id, duty_date) -- a
// completely different table from the one my-day/page.tsx's getDutyAreas()
// reads completion state FROM (task_completions, keyed by task_id). Every
// checkbox here was writing to a table nothing ever reads back, so a real
// staff member's first use of this list would have appeared to save and
// then silently reverted on the next load. Confirmed live before fixing:
// both tables hold zero rows, so this has not yet cost anyone real data --
// it would have cost the first person who used it. Now writes to
// task_completions, matching the read path exactly.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { PlayCircle } from 'lucide-react';

type DutyTask = {
  id: string;
  taskEn: string;
  taskEs: string;
  completed: boolean;
  photoUrl: string | null;
  procedureEn: string | null;
  procedureEs: string | null;
  posterUrl: string | null;
  videoTitleEn: string | null;
  videoTitleEs: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
};
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] };

export default function StaffDutyChecklist({
  propertyId,
  areas,
  hasRosterKey,
  todayStr,
}: {
  propertyId: string;
  areas: DutyArea[];
  hasRosterKey: boolean;
  todayStr: string;
}) {
  const t = useTranslations('myDay.duties');
  const locale = useLocale();
  const es = locale === 'es';
  const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(areas.flatMap((a) => a.tasks.map((task) => [task.id, task.completed])))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  // Which task's procedure/video is open. One at a time, same rule the
  // Task Center's own tiles use -- a list with every panel expanded stops
  // being a checklist.
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const supabase = createClient();
  const showToast = useToast();

  async function toggle(taskId: string, next: boolean) {
    setCompleted((prev) => ({ ...prev, [taskId]: next }));
    setSaving((prev) => ({ ...prev, [taskId]: true }));
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // unique(task_id, due_date) enforces one row per task per day -- upsert
    // is safe to call on every toggle, no read-then-write.
    const { error } = await supabase.from('task_completions').upsert(
      {
        task_id: taskId,
        property_id: propertyId,
        due_date: todayStr,
        completed: next,
        completed_at: next ? new Date().toISOString() : null,
        completed_by: next && user ? user.id : null,
      },
      { onConflict: 'task_id,due_date' }
    );
    setSaving((prev) => ({ ...prev, [taskId]: false }));
    if (error) {
      setCompleted((prev) => ({ ...prev, [taskId]: !next }));
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
              const hasHowTo = task.procedureEn || task.videoUrl;
              const open = openTaskId === task.id;
              const procedureText = es ? task.procedureEs ?? task.procedureEn : task.procedureEn ?? task.procedureEs;
              return (
                <li key={task.id}>
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isDone}
                      disabled={saving[task.id]}
                      onChange={(e) => toggle(task.id, e.target.checked)}
                      aria-label={es ? task.taskEs : task.taskEn}
                      className="mt-0.5 h-4 w-4 rounded border-brass/40 text-brass focus:ring-brass/40 shrink-0"
                    />
                    {/* Task's own photo first -- what the job is -- shown
                        small inline, never the poster in its place. */}
                    {task.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={task.photoUrl}
                        alt=""
                        loading="lazy"
                        className="w-8 h-8 rounded-lg object-cover shrink-0 bg-mist"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <label className="cursor-pointer">
                        <span className={`text-sm ${isDone ? 'text-dusk line-through' : 'text-denim'}`}>
                          {es ? task.taskEs : task.taskEn}
                        </span>
                      </label>
                      {hasHowTo && (
                        <button
                          type="button"
                          onClick={() => setOpenTaskId(open ? null : task.id)}
                          aria-expanded={open}
                          className="block mt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brass"
                        >
                          {open ? t('hideHowTo') : t('showHowTo')}
                        </button>
                      )}
                    </div>
                  </div>

                  {open && hasHowTo && (
                    <div className="mt-1.5 ml-[42px] rounded-xl bg-mist border border-cardBorder p-2.5 space-y-2">
                      {/* Procedure text, then its poster second, in the
                          body -- her exact ordering ruling. */}
                      {procedureText && (
                        <p className="text-[11px] text-denim whitespace-pre-line leading-relaxed">{procedureText}</p>
                      )}
                      {task.posterUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={task.posterUrl}
                          alt=""
                          loading="lazy"
                          className="w-full max-h-40 object-contain rounded-lg bg-card"
                        />
                      )}
                      {/* The video that teaches this procedure, inline --
                          poster-faced until tapped, same facade pattern
                          TrainingVideosTab uses, so nothing here mounts a
                          player until asked for. */}
                      {task.videoUrl && (
                        <video
                          controls
                          preload="none"
                          poster={task.videoPosterUrl ?? undefined}
                          className="w-full max-h-40 rounded-lg bg-denim"
                        >
                          <source src={task.videoUrl} />
                        </video>
                      )}
                      {!task.videoUrl && (task.videoTitleEn || task.videoTitleEs) && (
                        <p className="flex items-center gap-1.5 text-[11px] text-dusk">
                          <PlayCircle size={13} aria-hidden="true" />
                          {es ? task.videoTitleEs ?? task.videoTitleEn : task.videoTitleEn}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
