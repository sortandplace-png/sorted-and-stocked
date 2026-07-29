// components/TaskVerificationClient.tsx
// SS-269 (minimal scope, confirmed with Racquel): task_completions.photo_url
// -- the "after" evidence photo staff attach when completing a task -- had
// a working capture path (StaffTasksClient's attachPhoto) but nowhere for a
// manager to actually go look at it. Capture without a review destination
// is why the Organizing SOPs (all 16 ending in "photograph after") could
// not be verified. This is that destination: every completion for this
// property, newest first, with its photo/note/pass-fail, filterable by
// window and outcome.
//
// Deliberately NOT the full universal "any photo, choose where it goes"
// router Racquel originally described (My Day capture, room card camera,
// Shift Handover photo, and this SOP path all funnel to different tables
// today) -- that is a real, separate, larger redesign. This closes the one
// piece that was actually blocking verification.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { storageThumbnail } from '@/lib/storage-image';
import { SkeletonList } from '@/components/Skeleton';
import { CheckCircle2, XCircle } from 'lucide-react';
import Pin from '@/components/PinAccent';

type Row = {
  id: string;
  task_id: string;
  due_date: string;
  passed: boolean | null;
  note: string | null;
  photo_url: string | null;
  completed_at: string | null;
  completed_by: string | null;
  master_tasks: { task_en: string; task_es: string; room_id: string | null } | { task_en: string; task_es: string; room_id: string | null }[] | null;
};

type Room = { id: string; name_en: string; name_es: string | null };
type Profile = { id: string; full_name: string | null };

type OutcomeFilter = 'all' | 'passed' | 'issues';
type WindowFilter = '7' | '14' | '30' | 'all';

function taskOf(row: Row) {
  return Array.isArray(row.master_tasks) ? row.master_tasks[0] ?? null : row.master_tasks;
}

export default function TaskVerificationClient({ propertyId }: { propertyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('14');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const supabase = createClient();
  const locale = useLocale();
  const es = locale === 'es';
  const t = useTranslations('taskVerification');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      const [{ data: completionRows, error }, { data: roomRows }] = await Promise.all([
        supabase
          .from('task_completions')
          .select('id, task_id, due_date, passed, note, photo_url, completed_at, completed_by, master_tasks(task_en, task_es, room_id)')
          .eq('property_id', propertyId)
          .eq('completed', true)
          .order('due_date', { ascending: false })
          .limit(300),
        supabase.from('rooms').select('id, name_en, name_es').eq('property_id', propertyId),
      ]);
      if (error) {
        setLoadError(t('loadFailed'));
        setLoading(false);
        return;
      }
      setRows((completionRows as unknown as Row[]) ?? []);
      setRooms(roomRows ?? []);

      const completedByIds = Array.from(
        new Set((completionRows ?? []).map((r) => r.completed_by).filter((id): id is string => !!id))
      );
      if (completedByIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', completedByIds);
        setProfiles(profileRows ?? []);
      }
      setLoading(false);
    })();
  }, [propertyId, supabase, t]);

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const windowCutoff = useMemo(() => {
    if (windowFilter === 'all') return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(windowFilter));
    return d.toISOString().slice(0, 10);
  }, [windowFilter]);

  const visibleRows = rows.filter((r) => {
    if (windowCutoff && r.due_date < windowCutoff) return false;
    if (outcome === 'passed' && r.passed !== true) return false;
    if (outcome === 'issues' && r.passed !== false) return false;
    return true;
  });

  if (loading) return <SkeletonList rows={5} />;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-5">{t('subtitle')}</p>

      {loadError && <p className="mb-4 text-sm text-rust bg-rust/10 rounded-xl2 px-3 py-2">{loadError}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex bg-mist rounded-full p-1">
          {(['7', '14', '30', 'all'] as WindowFilter[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindowFilter(w)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                windowFilter === w ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {w === 'all' ? t('windowAll') : t('windowDays', { count: Number(w) })}
            </button>
          ))}
        </div>
        <div className="flex bg-mist rounded-full p-1">
          {(['all', 'passed', 'issues'] as OutcomeFilter[]).map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                outcome === o ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {o === 'all' ? t('outcomeAll') : o === 'passed' ? t('outcomePassed') : t('outcomeIssues')}
            </button>
          ))}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-2xl shadow-card">{t('empty')}</p>
      ) : (
        <ul className="space-y-2.5">
          {visibleRows.map((row) => {
            const task = taskOf(row);
            const room = task?.room_id ? roomById.get(task.room_id) : null;
            const who = row.completed_by ? profileById.get(row.completed_by)?.full_name : null;
            return (
              <li
                key={row.id}
                className="relative rounded-xl2 bg-mist border border-brass/30 shadow-card p-3.5 flex gap-3"
              >
                <Pin size="sm" />
                {row.photo_url ? (
                  <button onClick={() => setLightboxUrl(row.photo_url)} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={storageThumbnail(row.photo_url, 88)}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover bg-card"
                    />
                  </button>
                ) : (
                  <div className="shrink-0 h-16 w-16 rounded-lg bg-card flex items-center justify-center text-[10px] text-dusk text-center px-1">
                    {t('noPhoto')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-denim">
                    {task ? (es ? task.task_es || task.task_en : task.task_en) : t('unknownTask')}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {row.passed === false ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rust bg-rust/10 px-2 py-0.5 rounded-full">
                        <XCircle size={11} strokeWidth={1.75} aria-hidden="true" />
                        {t('issueLogged')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sage bg-sage/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} strokeWidth={1.75} aria-hidden="true" />
                        {t('passed')}
                      </span>
                    )}
                    {room && (
                      <span className="text-[10px] text-dusk bg-card px-2 py-0.5 rounded-full">
                        {es && room.name_es ? room.name_es : room.name_en}
                      </span>
                    )}
                    <span className="text-[10px] text-dusk bg-card px-2 py-0.5 rounded-full">{row.due_date}</span>
                    {who && <span className="text-[10px] text-brass bg-card px-2 py-0.5 rounded-full">{who}</span>}
                  </div>
                  {row.note && <p className="text-xs text-dusk italic mt-1.5">"{row.note}"</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={storageThumbnail(lightboxUrl, 1024)} alt="" className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
