// components/DutyRosterClient.tsx
// One flat, assignable list of every recurring duty for a property.
//
// Three things here are load-bearing and easy to break later:
//
// 1. THE FREQUENCY LIST IS BUILT FROM DATA, NEVER HARDCODED. An earlier spec
//    fixed it to ten labels and that hid 47 of 141 tasks -- Lax has zero Daily
//    tasks and thirteen frequencies, Main has 61 Daily and one Weekly. Any
//    fixed list is wrong for one of them.
// 2. THE EREV SHABBOS RULE keys off frequencies.recurrence_kind, not label
//    names, so a mislabelled row can't put "bake challah" on a Tuesday.
// 3. NULL ROOMS RENDER "—" AND STAY VISIBLE. 134 of 141 tasks have no room;
//    hiding them is why the old roster showed "no rows" on an empty filter.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

type Frequency = {
  id: string;
  code: string;
  label_en: string;
  label_es: string;
  recurrence_kind: string;
  sort_order: number;
};
type Room = { id: string; name_en: string; name_es: string };
// SS-131: assignment is to a PERSON. task_assignments.member_id is an FK to
// property_members.id; there is no assigned_slot_id and staff_slots are not in
// this path (SS-243 parked for exactly that reason).
type Member = { id: string; user_id: string; full_name: string | null };
type Assignment = { id: string; task_id: string; member_id: string | null };
type Task = {
  id: string;
  task_number: string;
  room_id: string | null;
  frequency_id: string | null;
  task_en: string;
  task_es: string;
  job_type: string | null;
  assigned_role: string | null;
  active: boolean;
  sort_order: number;
};

const UNASSIGNED = 'Unassigned';
const NO_ROOM = '__noroom__';

export default function DutyRosterClient({ propertyId }: { propertyId: string }) {
  const t = useTranslations('dutyRoster');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sopCounts, setSopCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('all');
  const [job, setJob] = useState('all');
  const [freq, setFreq] = useState('all');
  const [assignment, setAssignment] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const settled = await Promise.allSettled([
      supabase
        .from('master_tasks')
        .select('id, task_number, room_id, frequency_id, task_en, task_es, job_type, assigned_role, active, sort_order')
        .eq('property_id', propertyId)
        .order('sort_order'),
      supabase.from('frequencies').select('id, code, label_en, label_es, recurrence_kind, sort_order').order('sort_order'),
      supabase.from('rooms').select('id, name_en, name_es').eq('property_id', propertyId).order('sort_order'),
      supabase
        .from('property_members')
        .select('id, user_id, profiles(full_name)')
        .eq('property_id', propertyId),
      supabase.from('master_task_sops').select('master_task_id'),
      // Only live assignments. Ended ones stay on the table as history.
      supabase.from('task_assignments').select('id, task_id, member_id').eq('active', true),
    ]);

    // One failing source must not blank the page, and an error must never be
    // rendered as "nothing here" -- that is how a working screen looks broken.
    const failed: string[] = [];
    const rows = settled.map((s, i) => {
      if (s.status === 'rejected') {
        failed.push(String(i));
        return [] as unknown[];
      }
      const res = s.value as { data: unknown; error: unknown };
      if (res?.error) {
        failed.push(String(i));
        return [] as unknown[];
      }
      return (res?.data as unknown[]) ?? [];
    });

    setTasks(rows[0] as Task[]);
    setFrequencies(rows[1] as Frequency[]);
    setRooms(rows[2] as Room[]);
    setMembers(
      (rows[3] as { id: string; user_id: string; profiles: unknown }[]).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: (m.profiles as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );

    const counts: Record<string, number> = {};
    (rows[4] as { master_task_id: string }[]).forEach((r) => {
      counts[r.master_task_id] = (counts[r.master_task_id] ?? 0) + 1;
    });
    setSopCounts(counts);
    setAssignments(rows[5] as Assignment[]);
    setLoadError(failed.length > 0 ? t('loadPartial') : null);
    setLoading(false);
  }, [propertyId, supabase, t]);

  useEffect(() => {
    load();
  }, [load]);

  const freqById = useMemo(() => new Map(frequencies.map((f) => [f.id, f])), [frequencies]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const roomLabel = (id: string | null) => {
    if (!id) return '—';
    const r = roomById.get(id);
    if (!r) return '—';
    return es ? r.name_es : r.name_en;
  };
  const freqLabel = (f: Frequency | undefined) => (f ? (es ? f.label_es : f.label_en) : '—');

  // Character-identical task text that lost its room or person on import. NOT
  // errors -- each belonged to a different scope. They are shown, never merged,
  // and flagged so they can be given a room or a slot.
  const duplicateText = useMemo(() => {
    const seen = new Map<string, number>();
    tasks.forEach((x) => seen.set(x.task_en, (seen.get(x.task_en) ?? 0) + 1));
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [tasks]);

  const needsScoping = (x: Task) => duplicateText.has(x.task_en) && x.room_id === null;

  // SS-131: assignment now lives in task_assignments, not in the free-text
  // assigned_role column. My Day reads task_assignments (SS-242), so anything
  // written to assigned_role never reached the person it was assigned to.
  const assignmentByTask = useMemo(() => {
    const m = new Map<string, Assignment>();
    assignments.forEach((a) => {
      if (a.member_id) m.set(a.task_id, a);
    });
    return m;
  }, [assignments]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const memberName = (memberId: string | null | undefined) => {
    if (!memberId) return null;
    return memberById.get(memberId)?.full_name ?? null;
  };

  const isUnassigned = (x: Task) => !assignmentByTask.has(x.id);

  // --- THE EREV SHABBOS RULE ------------------------------------------------
  // Selecting a non-Hebrew frequency drops every Hebrew-calendar task, even one
  // whose own frequency row says "Daily". Checking the label alone would let a
  // single bad row surface Erev Shabbos work on a weekday.
  const passesFrequency = useCallback(
    (x: Task) => {
      if (freq === 'all') return true;
      const own = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
      const selected = frequencies.find((f) => f.id === freq);
      if (selected && selected.recurrence_kind !== 'hebrew' && own?.recurrence_kind === 'hebrew') return false;
      return x.frequency_id === freq;
    },
    [freq, freqById, frequencies]
  );

  const matchAssignment = (x: Task) =>
    assignment === 'all' || (assignment === 'unassigned' ? isUnassigned(x) : !isUnassigned(x));
  const matchRoom = (x: Task) => room === 'all' || (room === NO_ROOM ? x.room_id === null : x.room_id === room);
  const matchJob = (x: Task) => job === 'all' || (x.job_type ?? '') === job;
  const matchSearch = (x: Task) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [x.task_en, x.task_es, roomLabel(x.room_id), x.job_type ?? ''].join(' ').toLowerCase().includes(q);
  };

  // Cross-narrowing: each dropdown is built from what the OTHER filters leave,
  // so no combination can be assembled that returns nothing.
  const freqOptions = useMemo(() => {
    const present = new Set(
      tasks.filter((x) => matchRoom(x) && matchJob(x) && matchAssignment(x) && matchSearch(x)).map((x) => x.frequency_id)
    );
    return frequencies.filter((f) => present.has(f.id));
  }, [tasks, frequencies, room, job, assignment, search]);

  const roomOptions = useMemo(() => {
    const pool = tasks.filter((x) => matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    const ids = new Set(pool.map((x) => x.room_id));
    return { hasNull: ids.has(null), list: rooms.filter((r) => ids.has(r.id)) };
  }, [tasks, rooms, job, freq, assignment, search, passesFrequency]);

  const jobOptions = useMemo(() => {
    const pool = tasks.filter((x) => matchRoom(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    return [...new Set(pool.map((x) => x.job_type).filter(Boolean))].sort() as string[];
  }, [tasks, room, freq, assignment, search, passesFrequency]);

  const filtered = useMemo(
    () => tasks.filter((x) => matchRoom(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x)),
    [tasks, room, job, freq, assignment, search, passesFrequency]
  );

  const stats = useMemo(
    () => ({
      total: filtered.length,
      unassigned: filtered.filter(isUnassigned).length,
      withSop: filtered.filter((x) => (sopCounts[x.id] ?? 0) > 0).length,
      roomsMissing: filtered.filter((x) => x.room_id === null).length,
    }),
    [filtered, sopCounts]
  );

  const filtersActive =
    search.trim() !== '' || room !== 'all' || job !== 'all' || freq !== 'all' || assignment !== 'all';

  function clearFilters() {
    setSearch('');
    setRoom('all');
    setJob('all');
    setFreq('all');
    setAssignment('all');
  }

  // Same shape as StaffTasksClient.assignMember -- one mechanism, not two.
  // Effective-dated reassignment: the current row is deactivated and stamped
  // with effective_to, never deleted, which is what active/effective_from/
  // effective_to on this table are for (R21).
  //
  // assigned_role is deliberately left alone. Not dropped, not cleared -- just
  // no longer written. It is null on every active task, so nothing is lost.
  async function assign(taskId: string, memberId: string) {
    const existing = assignmentByTask.get(taskId);
    if (existing && existing.member_id === memberId) return;

    if (existing) {
      const { error } = await supabase
        .from('task_assignments')
        .update({ active: false, effective_to: new Date().toISOString().slice(0, 10) })
        .eq('id', existing.id);
      if (error) {
        setLoadError(t('saveFailed'));
        return;
      }
    }

    // Empty selection means "unassign": the old row is closed out above and no
    // new one is opened.
    if (!memberId) {
      setAssignments((prev) => prev.filter((a) => a.task_id !== taskId));
      return;
    }

    const { data, error } = await supabase
      .from('task_assignments')
      .insert({ task_id: taskId, member_id: memberId })
      .select('id, task_id, member_id')
      .single();
    if (error || !data) {
      setLoadError(t('saveFailed'));
      load(); // never leave the screen claiming a save that failed
      return;
    }
    setAssignments((prev) => [...prev.filter((a) => a.task_id !== taskId), data as Assignment]);
  }

  // Real people from property_members, never a hardcoded name (R17). A member
  // with no profile row still gets an option rather than disappearing from the
  // list -- unnamed is a data gap, not a reason to be unassignable.
  const assignees = useMemo(
    () => members.map((m) => ({ id: m.id, label: m.full_name ?? t('unnamedMember') })),
    [members, t]
  );

  const pill =
    'appearance-none bg-card border border-cardBorder rounded-full px-3 py-1.5 text-[12px] text-denim';

  return (
    <div className="max-w-[1240px] mx-auto px-4 py-6">
      <h1 className="font-display text-[34px] font-normal text-denim">{t('title')}</h1>
      <p className="text-[13px] text-dusk mb-5">{t('subtitle')}</p>

      {loadError && (
        <p className="mb-4 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{loadError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { k: 'statTotal', v: stats.total },
          { k: 'statUnassigned', v: stats.unassigned },
          { k: 'statWithSop', v: stats.withSop },
          { k: 'statRoomsMissing', v: stats.roomsMissing },
        ].map((s) => (
          <div key={s.k} className="relative bg-card border border-cardBorder rounded-xl2 shadow-card p-4">
            <PinDot />
            <p className="text-[12px] text-dusk">{t(s.k)}</p>
            <p className="font-display text-[24px] text-denim leading-tight mt-0.5">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="bg-card border border-cardBorder rounded-full px-4 py-2 text-[13px] text-denim placeholder:text-dusk"
        />
        <select className={pill} value={room} onChange={(e) => setRoom(e.target.value)} aria-label={t('filterRooms')}>
          <option value="all">{t('allRooms')}</option>
          {roomOptions.hasNull && <option value={NO_ROOM}>{t('noRoom')}</option>}
          {roomOptions.list.map((r) => (
            <option key={r.id} value={r.id}>
              {es ? r.name_es : r.name_en}
            </option>
          ))}
        </select>
        <select className={pill} value={job} onChange={(e) => setJob(e.target.value)} aria-label={t('filterJobs')}>
          <option value="all">{t('allJobs')}</option>
          {jobOptions.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
        {/* Built from the frequencies table at runtime, scoped to what this
            property actually uses. Never a fixed list. */}
        <select className={pill} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label={t('filterFrequencies')}>
          <option value="all">{t('allFrequencies')}</option>
          {freqOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {es ? f.label_es : f.label_en}
            </option>
          ))}
        </select>
        <select
          className={pill}
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          aria-label={t('filterAssignment')}
        >
          <option value="all">{t('allAssignment')}</option>
          <option value="unassigned">{t('unassigned')}</option>
          <option value="assigned">{t('assigned')}</option>
        </select>
      </div>

      <div className="relative bg-card border border-cardBorder rounded-xl3 shadow-card overflow-hidden">
        <PinDot />
        <div className="bg-denim py-[11px] px-5">
          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white">
            {t('stripSummary', {
              count: filtered.length,
              scope: freq === 'all' ? t('allFrequencies') : freqLabel(frequencies.find((f) => f.id === freq)),
            })}
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="text-center py-14 text-[13px] text-dusk">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              {/* Two distinct empty states, never one. Country has 0 tasks and
                  will hit the second on day one -- it must read as intentional. */}
              <p className="font-display text-[18px] text-denim">
                {filtersActive ? t('emptyFiltered') : t('emptyNoDuties')}
              </p>
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="mt-3 bg-denim text-white text-[13px] rounded-full px-5 py-2.5 shadow-card"
                >
                  {t('clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[14px]">
              {filtered.map((x) => {
                const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
                const unassigned = isUnassigned(x);
                const sops = sopCounts[x.id] ?? 0;
                return (
                  <div
                    key={x.id}
                    className="relative bg-mist rounded-xl2 shadow-card hover:shadow-cardHover transition-shadow flex flex-col justify-between py-[14px] px-[18px]"
                    style={{
                      minHeight: 184,
                      border: `1px solid ${unassigned ? 'rgba(198,164,110,0.3)' : 'rgba(46,74,98,0.2)'}`,
                    }}
                  >
                    <PinDot />
                    <div>
                      <div className="flex items-start justify-between gap-2 pr-4">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate">
                          {roomLabel(x.room_id)} • {x.job_type ?? '—'}
                        </span>
                        <span className="shrink-0 text-[8px] uppercase tracking-[0.15em] bg-card border border-cardBorder text-dusk px-2 py-0.5 rounded-full">
                          {freqLabel(f)}
                        </span>
                      </div>

                      <p
                        className="font-display text-[15px] text-denim mt-2"
                        style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        title={es ? x.task_es : x.task_en}
                      >
                        {es ? x.task_es : x.task_en}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        {sops > 0 && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-brass">
                            {t('sopCount', { count: sops })}
                          </span>
                        )}
                        {needsScoping(x) && (
                          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                            {t('needsScoping')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="-mx-[18px] -mb-[14px] mt-2 bg-card px-[18px] py-2 flex justify-between items-center rounded-b-xl2 border-t border-cardBorder">
                      {unassigned ? (
                        <span className="w-5 h-5 rounded-full border border-dashed border-dusk text-dusk text-[10px] flex items-center justify-center shrink-0">
                          ?
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-denim text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {(memberName(assignmentByTask.get(x.id)?.member_id) ?? '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                      <select
                        className="appearance-none bg-white border border-cardBorder rounded-full px-3 py-1.5 text-[11px] text-denim truncate max-w-[110px]"
                        value={assignmentByTask.get(x.id)?.member_id ?? ''}
                        onChange={(e) => assign(x.id, e.target.value)}
                        aria-label={t('assignTo')}
                      >
                        <option value="">{t('unassigned')}</option>
                        {assignees.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Pin dot -- every card, no exceptions.
function PinDot() {
  return (
    <span
      aria-hidden="true"
      className="absolute pointer-events-none"
      style={{
        top: 11,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 9999,
        background: 'radial-gradient(circle at 36% 30%, #F8E8B8 0%, #C6A46E 52%, #7A4E18 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,.26), inset 0 .5px .5px rgba(255,255,255,.3)',
      }}
    />
  );
}
