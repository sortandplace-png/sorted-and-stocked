// components/StaffTasksClient.tsx
// Full rebuild per audit item [13]: "Manager selects from a large task
// library. This is already built -- sop_library (40 SOPs, bilingual),
// master_tasks, task_assignments, task_completions, and
// deploy_sop_to_property(). The backend exists; the page needs to use it."
// Confirmed live: all four tables + the RPC are real (sop_library=40 rows,
// master_tasks=61 rows already deployed to Main, task_assignments/
// task_completions=0 -- nothing assigned or completed yet). The previous
// version of this file was a completely separate ad-hoc freeform manager
// (title/assignee/due-date/priority against a `staff_tasks` table with no
// relation to any of this) -- left untouched/unused rather than deleted,
// since dropping a real table is outside this task's scope.
//
// Default view shows every deployed task to every property member, not
// just "assigned to me" -- with 0 real assignments today, an assigned-only
// default would show every single person an empty list on day one. Any
// property member can mark any task done (matches the real RLS: completion
// insert/update has no role or assignment restriction), matching a
// household where staff pitch in wherever needed, not a strict per-person
// queue. Deploying from the library and assigning staff stays owner/
// manager-only (also matches RLS).
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';
import { CheckCircle2, ChevronDown, Circle, Clock, Library, ListChecks } from 'lucide-react';

type Frequency = { id: string; code: string; label_en: string; label_es: string; interval_days: number | null };
type Room = { id: string; name_en: string; name_es: string | null };
type Member = { id: string; user_id: string; full_name: string | null };

type SopRow = {
  id: string;
  sop_code: string | null;
  zone_type: string | null;
  task_en: string;
  task_es: string;
  sop_en: string | null;
  sop_es: string | null;
  estimated_minutes: number | null;
  default_frequency_id: string | null;
};

type MasterTask = {
  id: string;
  task_number: string;
  room_id: string | null;
  frequency_id: string | null;
  sop_id: string | null;
  task_en: string;
  task_es: string;
  sop_en: string | null;
  sop_es: string | null;
  pass_fail_en: string | null;
  pass_fail_es: string | null;
  estimated_minutes: number | null;
  active: boolean;
};

type Assignment = { id: string; task_id: string; member_id: string | null };
type Completion = { task_id: string; due_date: string; completed: boolean; passed: boolean | null; note: string | null };

type Status = 'done' | 'due' | 'not_due' | 'optional' | 'never_done';

const STATUS_STYLE: Record<Status, string> = {
  done: 'text-sage bg-sage/10',
  due: 'text-rust bg-rust/10',
  never_done: 'text-rust bg-rust/10',
  not_due: 'text-dusk bg-mist',
  optional: 'text-brass bg-mist',
};

const STATUS_LABEL: Record<Status, string> = {
  done: 'Done today',
  due: 'Due',
  never_done: 'Never set up',
  not_due: 'Not due yet',
  optional: 'As needed',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function computeStatus(task: MasterTask, freq: Frequency | null, last: Completion | null, todayStr: string): Status {
  if (last?.due_date === todayStr && last.completed) return 'done';
  if (!freq || freq.interval_days == null) return last ? 'optional' : 'never_done';
  if (!last) return 'due';
  const nextDue = new Date(last.due_date);
  nextDue.setDate(nextDue.getDate() + Math.ceil(Number(freq.interval_days)));
  return nextDue.getTime() <= new Date(todayStr).getTime() ? 'due' : 'not_due';
}

export default function StaffTasksClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const locale = useLocale();
  const supabase = createClient();
  const showToast = useToast();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [lastCompletionByTask, setLastCompletionByTask] = useState<Record<string, Completion>>({});
  const [sopLibrary, setSopLibrary] = useState<SopRow[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [deployBusyId, setDeployBusyId] = useState<string | null>(null);
  const [deployRoom, setDeployRoom] = useState<Record<string, string>>({});
  const [deployMember, setDeployMember] = useState<Record<string, string>>({});

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const freqById = useMemo(() => new Map(frequencies.map((f) => [f.id, f])), [frequencies]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const assignmentsByTask = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.task_id);
      if (list) list.push(a);
      else map.set(a.task_id, [a]);
    }
    return map;
  }, [assignments]);
  const deployedCountBySopId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.sop_id) continue;
      map.set(t.sop_id, (map.get(t.sop_id) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: taskRows }, { data: roomRows }, { data: freqRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from('master_tasks')
        .select('id, task_number, room_id, frequency_id, sop_id, task_en, task_es, sop_en, sop_es, pass_fail_en, pass_fail_es, estimated_minutes, active')
        .eq('property_id', propertyId)
        .eq('active', true)
        .order('sort_order'),
      supabase.from('rooms').select('id, name_en, name_es').eq('property_id', propertyId).eq('active', true),
      supabase.from('frequencies').select('id, code, label_en, label_es, interval_days').order('sort_order'),
      supabase.from('property_members').select('id, user_id, profiles(full_name)').eq('property_id', propertyId),
    ]);

    const taskList = (taskRows as MasterTask[]) ?? [];
    setTasks(taskList);
    setRooms((roomRows as Room[]) ?? []);
    setFrequencies((freqRows as Frequency[]) ?? []);
    setMembers(
      (memberRows ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );

    const taskIds = taskList.map((t) => t.id);
    if (taskIds.length > 0) {
      const [{ data: assignRows }, { data: completionRows }] = await Promise.all([
        supabase.from('task_assignments').select('id, task_id, member_id').eq('active', true).in('task_id', taskIds),
        supabase
          .from('task_completions')
          .select('task_id, due_date, completed, passed, note')
          .in('task_id', taskIds)
          .order('due_date', { ascending: false }),
      ]);
      setAssignments((assignRows as Assignment[]) ?? []);
      // Rows arrive newest-due_date-first -- first occurrence per task_id is
      // its most recent completion, so a plain forEach-if-absent dedupe
      // is enough, no need to sort client-side.
      const latest: Record<string, Completion> = {};
      for (const c of (completionRows as Completion[]) ?? []) {
        if (!latest[c.task_id]) latest[c.task_id] = c;
      }
      setLastCompletionByTask(latest);
    } else {
      setAssignments([]);
      setLastCompletionByTask({});
    }

    if (canManage(role)) {
      const { data: sopRows } = await supabase
        .from('sop_library')
        .select('id, sop_code, zone_type, task_en, task_es, sop_en, sop_es, estimated_minutes, default_frequency_id')
        .eq('active', true)
        .order('zone_type')
        .order('task_en');
      setSopLibrary((sopRows as SopRow[]) ?? []);
    }

    setLoading(false);
  }, [propertyId, role, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function taskName(t: { task_en: string; task_es: string }) {
    return locale === 'es' && t.task_es ? t.task_es : t.task_en;
  }
  function sopText(t: { sop_en: string | null; sop_es: string | null }) {
    return (locale === 'es' && t.sop_es ? t.sop_es : t.sop_en) ?? null;
  }
  function passFailText(t: { pass_fail_en: string | null; pass_fail_es: string | null }) {
    return (locale === 'es' && t.pass_fail_es ? t.pass_fail_es : t.pass_fail_en) ?? null;
  }

  async function markDone(taskId: string, passed: boolean) {
    setBusyTaskId(taskId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const note = noteDrafts[taskId]?.trim() || null;
    const dueDate = todayISO();
    const { error } = await supabase.from('task_completions').upsert(
      {
        task_id: taskId,
        property_id: propertyId,
        due_date: dueDate,
        completed: true,
        completed_at: new Date().toISOString(),
        completed_by: user?.id ?? null,
        passed,
        note,
      },
      { onConflict: 'task_id,due_date' }
    );
    setBusyTaskId(null);
    if (error) {
      showToast('Failed to log completion.', { variant: 'error' });
      return;
    }
    setLastCompletionByTask((prev) => ({ ...prev, [taskId]: { task_id: taskId, due_date: dueDate, completed: true, passed, note } }));
    setExpandedTaskId(null);
    showToast(passed ? 'Marked done.' : 'Logged with an issue noted.', { variant: passed ? 'success' : 'default' });
  }

  async function assignMember(taskId: string, memberId: string) {
    const existing = assignmentsByTask.get(taskId) ?? [];
    if (existing.some((a) => a.member_id === memberId)) return;
    // Effective-dated reassignment, not a delete -- deactivates the current
    // assignment(s) rather than removing history, matching what
    // effective_from/effective_to/active on this table are for.
    if (existing.length > 0) {
      await supabase
        .from('task_assignments')
        .update({ active: false, effective_to: todayISO() })
        .in(
          'id',
          existing.map((a) => a.id)
        );
    }
    const { data, error } = await supabase
      .from('task_assignments')
      .insert({ task_id: taskId, member_id: memberId || null })
      .select('id, task_id, member_id')
      .single();
    if (error || !data) {
      showToast('Failed to assign.', { variant: 'error' });
      load();
      return;
    }
    setAssignments((prev) => [...prev.filter((a) => a.task_id !== taskId), data as Assignment]);
  }

  async function deploySop(sop: SopRow) {
    setDeployBusyId(sop.id);
    const roomId = deployRoom[sop.id] ?? '';
    const roomNameEn = roomId ? roomById.get(roomId)?.name_en ?? null : null;
    const memberId = deployMember[sop.id] || null;
    const { error } = await supabase.rpc('deploy_sop_to_property', {
      p_sop_id: sop.id,
      p_property_id: propertyId,
      p_room_name_en: roomNameEn,
      p_member_id: memberId,
    });
    setDeployBusyId(null);
    if (error) {
      showToast(error.message || 'Failed to deploy.', { variant: 'error' });
      return;
    }
    showToast(`Added "${taskName(sop)}" to the task list.`, { variant: 'success' });
    load();
  }

  if (loading) return <SkeletonList />;

  const todayStr = todayISO();
  const rows = tasks.map((t) => ({
    task: t,
    freq: t.frequency_id ? freqById.get(t.frequency_id) ?? null : null,
    last: lastCompletionByTask[t.id] ?? null,
    status: computeStatus(t, t.frequency_id ? freqById.get(t.frequency_id) ?? null : null, lastCompletionByTask[t.id] ?? null, todayStr),
  }));
  const order: Status[] = ['due', 'never_done', 'optional', 'not_due', 'done'];
  rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || taskName(a.task).localeCompare(taskName(b.task)));

  const sopsByZone = sopLibrary.reduce((acc, s) => {
    const key = s.zone_type || 'General';
    (acc[key] ??= []).push(s);
    return acc;
  }, {} as Record<string, SopRow[]>);

  return (
    <div className="max-w-md lg:max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1 flex items-center gap-2">
        <ListChecks size={22} className="text-brass" strokeWidth={1.75} aria-hidden="true" />
        Staff Task Center
      </h1>
      <p className="text-sm text-dusk mb-4">What needs doing, from the real task library.</p>

      {canManage(role) && (
        <div className="mb-6 rounded-2xl border border-cardBorder bg-card shadow-card overflow-hidden">
          <button
            onClick={() => setShowLibrary((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            <Library size={16} className="text-brass shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1 font-display text-denim">Deploy from the task library</span>
            <span className="text-xs text-dusk">({sopLibrary.length})</span>
            <ChevronDown size={16} className={`text-dusk transition-transform ${showLibrary ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {showLibrary && (
            <div className="border-t border-cardBorder p-4 space-y-4 max-h-[28rem] overflow-y-auto">
              {Object.entries(sopsByZone).map(([zone, sops]) => (
                <div key={zone}>
                  <p className="text-xs font-medium uppercase tracking-wider text-dusk mb-1.5">{zone}</p>
                  <ul className="space-y-2">
                    {sops.map((sop) => {
                      const deployedCount = deployedCountBySopId.get(sop.id) ?? 0;
                      return (
                        <li key={sop.id} className="rounded-xl bg-mist p-2.5">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm text-denim flex-1">{taskName(sop)}</p>
                            {deployedCount > 0 && (
                              <span className="shrink-0 text-[10px] font-medium text-sage bg-sage/10 px-2 py-0.5 rounded-full">
                                Deployed ×{deployedCount}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <select
                              value={deployRoom[sop.id] ?? ''}
                              onChange={(e) => setDeployRoom((p) => ({ ...p, [sop.id]: e.target.value }))}
                              className="text-xs border border-cardBorder rounded-full px-2 py-1 bg-card text-denim"
                            >
                              <option value="">No specific room</option>
                              {rooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {locale === 'es' && r.name_es ? r.name_es : r.name_en}
                                </option>
                              ))}
                            </select>
                            <select
                              value={deployMember[sop.id] ?? ''}
                              onChange={(e) => setDeployMember((p) => ({ ...p, [sop.id]: e.target.value }))}
                              className="text-xs border border-cardBorder rounded-full px-2 py-1 bg-card text-denim"
                            >
                              <option value="">Unassigned</option>
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.full_name ?? 'Unnamed'}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => deploySop(sop)}
                              disabled={deployBusyId === sop.id}
                              className="text-xs font-medium bg-denim text-white px-3 py-1 rounded-full disabled:opacity-40"
                            >
                              {deployBusyId === sop.id ? 'Adding…' : 'Add to list'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-2xl shadow-card">
          {canManage(role) ? 'Nothing deployed yet -- open the library above to add your first tasks.' : 'No tasks set up yet -- ask a manager to deploy some from the task library.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ task, freq, last, status }) => {
            const room = task.room_id ? roomById.get(task.room_id) : null;
            const assigned = (assignmentsByTask.get(task.id) ?? [])
              .map((a) => (a.member_id ? memberById.get(a.member_id)?.full_name : null))
              .filter(Boolean);
            const expanded = expandedTaskId === task.id;
            const sop = sopText(task);
            const passFail = passFailText(task);
            return (
              <li key={task.id} className="rounded-2xl border border-cardBorder bg-card shadow-card p-3.5">
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => (status === 'done' ? null : setExpandedTaskId(expanded ? null : task.id))}
                    disabled={busyTaskId === task.id}
                    className="shrink-0 mt-0.5 text-denim disabled:opacity-40"
                    aria-label={status === 'done' ? 'Already done today' : `Mark ${taskName(task)} done`}
                  >
                    {status === 'done' ? (
                      <CheckCircle2 size={20} className="text-sage" strokeWidth={1.75} />
                    ) : (
                      <Circle size={20} strokeWidth={1.75} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${status === 'done' ? 'text-dusk line-through' : 'text-denim'}`}>
                      {taskName(task)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {room && (
                        <span className="text-[10px] text-dusk bg-mist px-2 py-0.5 rounded-full">
                          {locale === 'es' && room.name_es ? room.name_es : room.name_en}
                        </span>
                      )}
                      {freq && (
                        <span className="text-[10px] text-dusk bg-mist px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={10} strokeWidth={1.75} aria-hidden="true" />
                          {locale === 'es' ? freq.label_es : freq.label_en}
                        </span>
                      )}
                      {task.estimated_minutes && (
                        <span className="text-[10px] text-dusk bg-mist px-2 py-0.5 rounded-full">~{task.estimated_minutes} min</span>
                      )}
                      {assigned.length > 0 && (
                        <span className="text-[10px] text-brass bg-mist px-2 py-0.5 rounded-full">{assigned.join(', ')}</span>
                      )}
                    </div>
                    {last?.note && (
                      <p className="text-xs text-dusk italic mt-1">Last note: "{last.note}"</p>
                    )}

                    {canManage(role) && (
                      <div className="mt-2">
                        <select
                          value={(assignmentsByTask.get(task.id) ?? [])[0]?.member_id ?? ''}
                          onChange={(e) => assignMember(task.id, e.target.value)}
                          className="text-xs border border-cardBorder rounded-full px-2 py-1 bg-mist text-dusk"
                        >
                          <option value="">Unassigned</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name ?? 'Unnamed'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {expanded && status !== 'done' && (
                      <div className="mt-3 pt-3 border-t border-cardBorder space-y-2">
                        {sop && <p className="text-xs text-dusk">{sop}</p>}
                        {passFail && <p className="text-xs text-brass">Pass/fail: {passFail}</p>}
                        <div>
                          <FieldLabel>Note (optional)</FieldLabel>
                          <input
                            value={noteDrafts[task.id] ?? ''}
                            onChange={(e) => setNoteDrafts((p) => ({ ...p, [task.id]: e.target.value }))}
                            placeholder="e.g. Ran out of supplies, will finish tomorrow"
                            className="w-full text-sm border border-cardBorder rounded-full px-3 py-1.5 bg-card"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => markDone(task.id, true)}
                            disabled={busyTaskId === task.id}
                            className="flex-1 py-2 rounded-full bg-denim text-white text-xs font-medium disabled:opacity-40"
                          >
                            {busyTaskId === task.id ? 'Saving…' : 'Mark done'}
                          </button>
                          <button
                            onClick={() => markDone(task.id, false)}
                            disabled={busyTaskId === task.id}
                            className="flex-1 py-2 rounded-full bg-rust/10 text-rust text-xs font-medium disabled:opacity-40"
                          >
                            Report an issue
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
