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
import { jobFamily, jobFamilyLabel, jobLabel, type JobFamily } from '@/lib/job-types';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { storageThumbnail } from '@/lib/storage-image';
import CameraCapture from '@/components/CameraCapture';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';
import Link from 'next/link';
import { Camera, CheckCircle2, ChevronDown, Circle, ClipboardList, Clock, Library, ListChecks } from 'lucide-react';
import Pin from '@/components/PinAccent';

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
  job_type: string | null;
  photo_url: string | null;
  active: boolean;
};

type Assignment = { id: string; task_id: string; member_id: string | null };
// master_task_sops joined to its SOP. sop_id is a many-to-one FK, so
// PostgREST returns a single embedded object -- but the generated types
// model it as an array, and getting this wrong fails silently (no poster
// ever renders, no error anywhere). Accepting both shapes is three lines
// and removes the guess entirely.
type SopEmbed = { expected_appearance_url: string | null } | null;
type PosterRow = {
  master_task_id: string;
  sop_library: SopEmbed | SopEmbed[];
};

function posterUrl(row: PosterRow): string | null {
  const embed = Array.isArray(row.sop_library) ? row.sop_library[0] : row.sop_library;
  return embed?.expected_appearance_url ?? null;
}
type Completion = {
  task_id: string;
  due_date: string;
  completed: boolean;
  passed: boolean | null;
  note: string | null;
  photo_url: string | null;
};

type Status = 'done' | 'due' | 'not_due' | 'optional' | 'never_done';

// SS-277: due/never_done reuse the exact Inventory low-stock badge tokens
// (bg-[#FDF2F2]/border-[#F8C4C4]/text-[#9B2C2C]) rather than a new rose
// variant -- both already shared one rust/10 treatment before this, and
// moving only one of the two to the new tokens would have fragmented that
// pairing instead of fixing it.
const STATUS_STYLE: Record<Status, string> = {
  done: 'text-sage bg-sage/10',
  due: 'bg-[#FDF2F2] border border-[#F8C4C4] text-[#9B2C2C]',
  never_done: 'bg-[#FDF2F2] border border-[#F8C4C4] text-[#9B2C2C]',
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

// `today` is today's row whatever its state; `lastDone` is the most recent
// row that is actually completed. They have to be separate: un-completing
// leaves a completed=false row dated today (R21 -- the row is never
// deleted), and feeding that row into the recurrence maths below would
// push nextDue a full interval into the future and report a task the user
// just re-opened as "Not due yet". Recurrence is driven only by real
// completions; today's row only decides whether it reads as done now.
function computeStatus(
  task: MasterTask,
  freq: Frequency | null,
  lastDone: Completion | null,
  today: Completion | null,
  todayStr: string
): Status {
  if (today?.completed) return 'done';
  if (!freq || freq.interval_days == null) return lastDone ? 'optional' : 'never_done';
  if (!lastDone) return 'due';
  const nextDue = new Date(lastDone.due_date);
  nextDue.setDate(nextDue.getDate() + Math.ceil(Number(freq.interval_days)));
  return nextDue.getTime() <= new Date(todayStr).getTime() ? 'due' : 'not_due';
}

export default function StaffTasksClient({
  propertyId,
  scope = 'all',
}: {
  propertyId: string;
  // 'mine' embeds this as My Day's task widget: assigned-to-me and
  // currently actionable (due or never set up) only, no page chrome, no
  // manager admin affordances -- everything else about the data layer and
  // mark-done flow is identical, so this is the same component rather than
  // a parallel implementation that could drift out of sync with it.
  scope?: 'mine' | 'all';
}) {
  const role = usePropertyRole();
  const locale = useLocale();
  const supabase = createClient();
  const showToast = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, [supabase]);

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [lastCompletionByTask, setLastCompletionByTask] = useState<Record<string, Completion>>({});
  const [todayCompletionByTask, setTodayCompletionByTask] = useState<Record<string, Completion>>({});
  const [posterByTaskId, setPosterByTaskId] = useState<Record<string, string>>({});
  const [sopLibrary, setSopLibrary] = useState<SopRow[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [jobFilter, setJobFilter] = useState<JobFamily | 'all'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [photoDrafts, setPhotoDrafts] = useState<Record<string, string>>({});
  const [photoBusyTaskId, setPhotoBusyTaskId] = useState<string | null>(null);
  const [cameraTaskId, setCameraTaskId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [deployBusyId, setDeployBusyId] = useState<string | null>(null);
  const [deployRoom, setDeployRoom] = useState<Record<string, string>>({});
  const [deployMember, setDeployMember] = useState<Record<string, string>>({});

  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const freqById = useMemo(() => new Map(frequencies.map((f) => [f.id, f])), [frequencies]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const myMemberId = useMemo(() => members.find((m) => m.user_id === currentUserId)?.id ?? null, [members, currentUserId]);
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
        .select('id, task_number, room_id, frequency_id, sop_id, task_en, task_es, sop_en, sop_es, pass_fail_en, pass_fail_es, estimated_minutes, job_type, photo_url, active')
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
      const [{ data: assignRows }, { data: completionRows }, { data: posterRows }] = await Promise.all([
        supabase.from('task_assignments').select('id, task_id, member_id').eq('active', true).in('task_id', taskIds),
        supabase
          .from('task_completions')
          .select('task_id, due_date, completed, passed, note, photo_url')
          .in('task_id', taskIds)
          .order('due_date', { ascending: false }),
        // Deliberately NOT behind canManage: the SOP poster is the picture
        // of what finished looks like, which is precisely what the person
        // doing the job needs. The sopLibrary fetch below stays
        // manager-only -- that one is the deploy-from-library admin tool,
        // a different thing that happens to read the same table.
        supabase
          .from('master_task_sops')
          .select('master_task_id, sop_library(expected_appearance_url)')
          .in('master_task_id', taskIds)
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true }),
      ]);
      setAssignments((assignRows as Assignment[]) ?? []);
      // Rows arrive newest-due_date-first, so the first row seen per task_id
      // is its most recent -- a forEach-if-absent dedupe is enough, no
      // client-side sort needed. Two maps, not one: `latest` is the newest
      // row that is genuinely completed (drives recurrence), `today` is
      // today's row whatever its state (drives the done/undone tick). A
      // re-opened task has a today row with completed=false and must still
      // fall back to its previous real completion for scheduling.
      const today = todayISO();
      const latest: Record<string, Completion> = {};
      const todays: Record<string, Completion> = {};
      for (const c of (completionRows as Completion[]) ?? []) {
        if (c.completed && !latest[c.task_id]) latest[c.task_id] = c;
        if (c.due_date === today && !todays[c.task_id]) todays[c.task_id] = c;
      }
      setLastCompletionByTask(latest);
      setTodayCompletionByTask(todays);

      // One poster per task: rows arrive primary-first then by sort_order,
      // so the first row seen per master_task_id is the one to show --
      // same first-wins dedupe as the completions above. Links whose SOP
      // has no poster are skipped rather than stored as null, so a task
      // with a second, poster-bearing SOP still gets a picture.
      const posters: Record<string, string> = {};
      for (const r of (posterRows as unknown as PosterRow[]) ?? []) {
        const url = posterUrl(r);
        if (url && !posters[r.master_task_id]) posters[r.master_task_id] = url;
      }
      setPosterByTaskId(posters);
    } else {
      setAssignments([]);
      setLastCompletionByTask({});
      setTodayCompletionByTask({});
      setPosterByTaskId({});
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
    const photoUrl = photoDrafts[taskId] ?? todayCompletionByTask[taskId]?.photo_url ?? null;
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
        photo_url: photoUrl,
      },
      { onConflict: 'task_id,due_date' }
    );
    setBusyTaskId(null);
    if (error) {
      showToast('Failed to log completion.', { variant: 'error' });
      return;
    }
    const row: Completion = { task_id: taskId, due_date: dueDate, completed: true, passed, note, photo_url: photoUrl };
    setTodayCompletionByTask((prev) => ({ ...prev, [taskId]: row }));
    setLastCompletionByTask((prev) => ({ ...prev, [taskId]: row }));
    setExpandedTaskId(null);
    showToast(passed ? 'Marked done.' : 'Logged with an issue noted.', { variant: passed ? 'success' : 'default' });
  }

  // Untick. R21: the row is never deleted -- it stays with completed=false
  // so the record of who ticked it survives being re-opened. That's also
  // why lastCompletionByTask only ever holds completed rows: the next-due
  // maths has to ignore this one, or a task the user just re-opened would
  // report as "Not due yet" for a whole interval.
  async function reopen(taskId: string) {
    const dueDate = todayISO();
    setBusyTaskId(taskId);
    const { error } = await supabase
      .from('task_completions')
      .update({ completed: false, completed_at: null })
      .eq('task_id', taskId)
      .eq('due_date', dueDate);
    setBusyTaskId(null);
    if (error) {
      showToast('Could not reopen that task.', { variant: 'error' });
      return;
    }
    setTodayCompletionByTask((prev) => {
      const existing = prev[taskId];
      return existing ? { ...prev, [taskId]: { ...existing, completed: false } } : prev;
    });
    // If the completed-row pointer was today's row, drop it so the task
    // falls back to its previous real completion -- or to 'due' when there
    // wasn't one.
    setLastCompletionByTask((prev) => {
      if (prev[taskId]?.due_date !== dueDate) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    showToast('Reopened.', { variant: 'default' });
  }

  // One tap on the tick toggles the task, which is what a checkbox is
  // expected to do. The detail panel (note, photo, "report an issue") is
  // still there behind the pin for when there's more to record than
  // "done" -- but recording nothing extra must not cost two taps.
  function toggleDone(taskId: string, isDone: boolean) {
    return isDone ? reopen(taskId) : markDone(taskId, true);
  }

  // Same upload path as CapturePhotoClient (compress -> item-photos ->
  // public URL); only the destination differs. This one lands on the
  // completion row itself rather than in capture_staging, because the
  // photo's meaning here is already known -- it's this task, today.
  async function attachPhoto(taskId: string, file: File) {
    setPhotoBusyTaskId(taskId);
    try {
      const compressed = await compressImageToBlob(file);
      const path = `${propertyId}/task-${taskId}-${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
      setPhotoDrafts((p) => ({ ...p, [taskId]: data.publicUrl }));
      // Already logged for today? Persist immediately -- there's no
      // "Mark done" press left to flush the draft, so holding it in local
      // state would silently lose it.
      if (todayCompletionByTask[taskId]) {
        const { error } = await supabase
          .from('task_completions')
          .update({ photo_url: data.publicUrl })
          .eq('task_id', taskId)
          .eq('due_date', todayISO());
        if (error) throw error;
        setTodayCompletionByTask((prev) => {
          const existing = prev[taskId];
          return existing ? { ...prev, [taskId]: { ...existing, photo_url: data.publicUrl } } : prev;
        });
      }
    } catch {
      showToast('Photo upload failed.', { variant: 'error' });
    } finally {
      setPhotoBusyTaskId(null);
    }
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

  if (loading) return <SkeletonList rows={scope === 'mine' ? 2 : 5} />;

  const todayStr = todayISO();
  const rows = tasks.map((t) => {
    const freq = t.frequency_id ? freqById.get(t.frequency_id) ?? null : null;
    const lastDone = lastCompletionByTask[t.id] ?? null;
    const today = todayCompletionByTask[t.id] ?? null;
    return {
      task: t,
      freq,
      // What the card shows as "last note"/photo: today's row if there is
      // one, otherwise the previous real completion.
      last: today ?? lastDone,
      status: computeStatus(t, freq, lastDone, today, todayStr),
    };
  });
  const order: Status[] = ['due', 'never_done', 'optional', 'not_due', 'done'];
  rows.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || taskName(a.task).localeCompare(taskName(b.task)));

  // My Day's widget: what's assigned to the viewer and actionable today --
  // not the full property task board, and not future recurring items that
  // aren't due yet. 'done' is included deliberately (SS-244): a task ticked
  // off stays on the list struck through for the rest of the day rather
  // than disappearing the instant it's completed. Vanishing it destroys the
  // sense of progress and leaves no way to undo a mis-tap.
  const scopedRows =
    scope === 'mine'
      ? rows.filter(
          (r) =>
            (r.status === 'due' || r.status === 'never_done' || r.status === 'done') &&
            (assignmentsByTask.get(r.task.id) ?? []).some((a) => a.member_id === myMemberId)
        )
      : rows;

  // Which job families actually exist here, derived from the data rather than
  // hardcoded -- Lax is entirely 'maintenance' (79 tasks), Main is 12
  // granular cleaning-family types plus one uncategorised row, and a property
  // with only one family shouldn't be shown a pointless filter.
  const familiesPresent = Array.from(new Set(scopedRows.map((r) => jobFamily(r.task.job_type))));
  const visibleRows =
    jobFilter === 'all' ? scopedRows : scopedRows.filter((r) => jobFamily(r.task.job_type) === jobFilter);

  const sopsByZone = sopLibrary.reduce((acc, s) => {
    const key = s.zone_type || 'General';
    (acc[key] ??= []).push(s);
    return acc;
  }, {} as Record<string, SopRow[]>);

  const content = (
    <>
      {/* One camera for the whole list, driven by which task asked for it --
          not one mounted per card. */}
      <CameraCapture
        open={cameraTaskId !== null}
        onCapture={(file) => {
          const id = cameraTaskId;
          setCameraTaskId(null);
          if (id) attachPhoto(id, file);
        }}
        onClose={() => setCameraTaskId(null)}
      />

      {canManage(role) && scope !== 'mine' && (
        // SS-277: bespoke button+chevron shell kept deliberately, not
        // swapped for the shared CollapsibleCard+CardHeader pattern -- that
        // component always renders Pin as its collapse control with no way
        // to opt out, and this card is explicitly chevron-only, no pin. The
        // interaction itself (button + rotating ChevronDown) is unchanged,
        // already correct; only the shell radius moved to the real token.
        <div className="mb-6 rounded-xl3 border border-cardBorder bg-card shadow-card overflow-hidden">
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

      {/* Cleaning vs Maintenance. Only shown when a property actually has
          more than one family -- Lax is 100% maintenance and Main is almost
          entirely cleaning, so a filter with one real option would be noise.
          Counts come from the scoped rows so "Mine" reflects what's assigned. */}
      {scope !== 'mine' && familiesPresent.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {(['all', ...familiesPresent] as const).map((f) => {
            const count =
              f === 'all' ? scopedRows.length : scopedRows.filter((r) => jobFamily(r.task.job_type) === f).length;
            const label = f === 'all' ? (locale === 'es' ? 'Todas' : 'All') : jobFamilyLabel(f as JobFamily, locale);
            const isActive = jobFilter === f;
            return (
              <button
                key={f}
                onClick={() => setJobFilter(f as JobFamily | 'all')}
                aria-pressed={isActive}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  isActive ? 'bg-denim text-white border-denim' : 'bg-mist text-denim border-cardBorder'
                }`}
              >
                {label} <span className={isActive ? 'text-white/70' : 'text-dusk'}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="text-sm text-dusk text-center py-4 bg-card rounded-2xl shadow-card">
          {scope === 'mine'
            ? 'Nothing due right now.'
            : canManage(role)
            ? 'Nothing deployed yet -- open the library above to add your first tasks.'
            : 'No tasks set up yet -- ask a manager to deploy some from the task library.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleRows.map(({ task, freq, last, status }) => {
            const room = task.room_id ? roomById.get(task.room_id) : null;
            const assigned = (assignmentsByTask.get(task.id) ?? [])
              .map((a) => (a.member_id ? memberById.get(a.member_id)?.full_name : null))
              .filter(Boolean);
            const expanded = expandedTaskId === task.id;
            const sop = sopText(task);
            const passFail = passFailText(task);
            const photoUrl = photoDrafts[task.id] ?? last?.photo_url ?? null;
            // The task's own illustration first (what this job is), falling
            // back to the attached SOP's poster (what finished looks like).
            // Different meanings, but either is more use on the row than
            // nothing -- and until now neither rendered anywhere. No
            // placeholder when both are absent: an empty grey square on
            // most rows is worse than no square at all.
            const tileImage = task.photo_url ?? posterByTaskId[task.id] ?? null;
            return (
              <li
                key={task.id}
                className="relative rounded-xl2 border border-brass/30 bg-mist shadow-card hover:shadow-cardHover transition-shadow p-3.5"
              >
                {/* D-21: the pin dot is this card's collapse control. It was
                    decorative here while the tick doubled as the expander;
                    now that the tick actually completes the task in one tap,
                    the detail panel needs its own control and D-21 says which
                    one that is. No chevron. */}
                <Pin size="sm" collapsed={!expanded} onToggle={() => setExpandedTaskId(expanded ? null : task.id)} />
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleDone(task.id, status === 'done')}
                    disabled={busyTaskId === task.id}
                    className="shrink-0 mt-0.5 text-denim disabled:opacity-40"
                    aria-pressed={status === 'done'}
                    aria-label={
                      status === 'done'
                        ? `Reopen ${taskName(task)}`
                        : `Mark ${taskName(task)} done`
                    }
                  >
                    {status === 'done' ? (
                      <CheckCircle2 size={20} className="text-sage" strokeWidth={1.75} />
                    ) : (
                      <Circle size={20} strokeWidth={1.75} />
                    )}
                  </button>
                  {tileImage && (
                    // 44px keeps the row inside D-15's collapsed height and
                    // keeps the card reading as a card, not a wide strip
                    // (D-22). Decorative: the task name beside it already
                    // says what this is, so alt is empty rather than a
                    // duplicate announcement.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={storageThumbnail(tileImage, 88)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="shrink-0 h-11 w-11 rounded-lg object-cover bg-card"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${status === 'done' ? 'text-dusk line-through' : 'text-denim'}`}>
                      {taskName(task)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {/* The specific job type, not just the coarse family --
                          "Bathroom Cleaning" is more useful on the card than
                          "Cleaning", and it's what makes a maintenance task
                          visibly different from a cleaning one at a glance.
                          Hidden when uncategorised rather than showing an
                          empty chip. */}
                      {task.job_type && (
                        <span className="text-[10px] font-medium text-brass bg-brass/10 px-2 py-0.5 rounded-full">
                          {jobLabel(task.job_type, locale)}
                        </span>
                      )}
                      {room && (
                        <span className="text-[10px] text-dusk bg-mist px-2 py-0.5 rounded-full">
                          {locale === 'es' && room.name_es ? room.name_es : room.name_en}
                        </span>
                      )}
                      {freq && (
                        <span className="text-[10px] text-dusk bg-card border border-cardBorder px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={10} className="text-brass" strokeWidth={1.75} aria-hidden="true" />
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

                    {canManage(role) && scope !== 'mine' && (
                      <div className="mt-2">
                        <select
                          value={(assignmentsByTask.get(task.id) ?? [])[0]?.member_id ?? ''}
                          onChange={(e) => assignMember(task.id, e.target.value)}
                          className="text-xs border border-cardBorder rounded-full px-2 py-1 bg-card text-dusk"
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

                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-cardBorder space-y-2">
                        {sop && <p className="text-xs text-dusk">{sop}</p>}
                        {/* Links to the shared procedure rather than
                            duplicating its text on the card. Only shown when
                            the task actually references one -- sop_id is set
                            on just 1 of 141 tasks today, which is the gap the
                            SOP Library page exists to close. */}
                        {task.sop_id && (
                          <Link
                            href={`/properties/${propertyId}/tools/sops`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brass underline underline-offset-2"
                          >
                            <ClipboardList size={12} strokeWidth={1.75} aria-hidden="true" />
                            {locale === 'es' ? 'Ver procedimiento completo' : 'View full procedure'}
                          </Link>
                        )}
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

                        {/* task_completions.photo_url, wired at last. Distinct
                            from the SOP's expected_appearance_url: that one is
                            the reference for what finished should look like,
                            this is the evidence of what it actually looked
                            like. Never conflate the two. */}
                        <div>
                          <FieldLabel>Photo (optional)</FieldLabel>
                          <div className="flex items-center gap-2">
                            {photoUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={storageThumbnail(photoUrl, 96)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-12 w-12 rounded-lg object-cover bg-mist"
                              />
                            )}
                            <button
                              onClick={() => setCameraTaskId(task.id)}
                              disabled={photoBusyTaskId === task.id}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-brass underline underline-offset-2 disabled:opacity-40"
                            >
                              <Camera size={13} strokeWidth={1.75} aria-hidden="true" />
                              {photoBusyTaskId === task.id
                                ? 'Uploading…'
                                : photoUrl
                                ? 'Replace photo'
                                : 'Add a photo'}
                            </button>
                          </div>
                        </div>

                        {status === 'done' ? (
                          <p className="text-xs text-dusk">
                            Logged for today. Tap the tick to reopen it.
                          </p>
                        ) : (
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
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  if (scope === 'mine') return content;

  return (
    <div className="bg-[#F9F5EF] min-h-screen">
      <div className="max-w-[720px] mx-auto p-4">
        <h1 className="text-2xl font-display font-normal text-denim mb-1 flex items-center gap-2">
          <ListChecks size={22} className="text-brass" strokeWidth={1.75} aria-hidden="true" />
          Staff Task Center
        </h1>
        <p className="text-[11px] font-interDisplay font-normal text-dusk mb-4">What needs doing, from the real task library.</p>
        {content}
      </div>
    </div>
  );
}
