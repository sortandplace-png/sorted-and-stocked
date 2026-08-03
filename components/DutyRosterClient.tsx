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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { storageThumbnail } from '@/lib/storage-image';
import { signSopPosters } from '@/lib/sop-posters';
import { routes } from '@/lib/app-routes';
import { getEasternIsoWeekday } from '@/lib/eastern-weekday';
import { compressImageToBlob } from '@/lib/compress-image';
import CameraCapture from '@/components/CameraCapture';
import TaskSuppliesList from '@/components/TaskSuppliesList';
import AddSupplyModal from '@/components/AddSupplyModal';
import { fetchSuppliesByTask, type TaskSupply } from '@/lib/task-supplies';
import { ClipboardList, Camera as CameraIcon, Image as ImageIcon, X as XIcon } from 'lucide-react';

type Frequency = {
  id: string;
  code: string;
  label_en: string;
  label_es: string;
  recurrence_kind: string;
  sort_order: number;
};
// SS-273 floor filter. floor has no _es sibling in the schema (confirmed
// live -- only one column) and only three real values exist, so a small
// static display map covers it rather than a migration, same shape as the
// staples category translation added earlier.
const FLOOR_ES: Record<string, string> = {
  Basement: 'Sótano',
  'Main Floor': 'Planta Principal',
  Upstairs: 'Piso Superior',
};
// Fixed order, not alphabetical -- alphabetical happens to match here
// (Basement, Main Floor, Upstairs) but that is a coincidence of these
// specific names, not something to depend on if a fourth floor is ever
// added with a name that sorts oddly.
const FLOOR_ORDER = ['Basement', 'Main Floor', 'Upstairs'];

type Room = { id: string; name_en: string; name_es: string; floor: string | null; property_id: string };

// SS-273. Sunday-first display order, ISO weekday values (matching the
// day_of_week column's own convention: 1=Mon..7=Sun) -- Saturday/6 is
// deliberately absent, not an oversight.
const DAY_PICKER_OPTIONS: { iso: number; key: string }[] = [
  { iso: 7, key: 'daySun' },
  { iso: 1, key: 'dayMon' },
  { iso: 2, key: 'dayTue' },
  { iso: 3, key: 'dayWed' },
  { iso: 4, key: 'dayThu' },
  { iso: 5, key: 'dayFri' },
];
// SS-131 said assignment is to a PERSON; SS-429 (Racquel's ruling, option B)
// widened that: an assignment targets a person (member_id) OR a staff slot
// (slot_id), never both -- the DB check task_assignments_one_target enforces
// it. Assigning to a slot works with zero staff accounts, and whoever is
// later invited into the slot inherits its tasks via is_assigned_to_task(),
// which now matches on either link.
type Member = { id: string; user_id: string; full_name: string | null; property_id: string };
type Slot = { id: string; label_en: string; label_es: string; user_id: string | null; active: boolean; property_id: string };
type Assignment = { id: string; task_id: string; member_id: string | null; slot_id: string | null };

// The one <select> carries both kinds of assignee, so the option value
// encodes which table the id belongs to.
const MEMBER_PREFIX = 'm:';
const SLOT_PREFIX = 's:';
type Task = {
  id: string;
  task_number: string;
  property_id: string;
  room_id: string | null;
  frequency_id: string | null;
  task_en: string;
  task_es: string;
  job_type: string | null;
  assigned_role: string | null;
  // SS-517: the "With Procedures" tile counts this FK directly. Verified
  // live before the change: zero active tasks carry sop_id without sop_en
  // text, so the id is strictly the stronger signal (Racquel's chat-side
  // resolution, 2 Aug). The 83 tasks with text but NO id are SS-534, a
  // separate data defect this tile must not paper over by counting text.
  sop_id: string | null;
  source_area_en: string | null;
  source_area_es: string | null;
  photo_url: string | null;
  active: boolean;
  sort_order: number;
  // SS-273. ISO weekday (1=Mon..7=Sun), same convention my-day/page.tsx
  // already reads this column with. NULL means "every day" -- confirmed
  // live that 0 of 208 active tasks on Main have this set today, so that
  // is the effective state of every task right now, not a hypothetical.
  day_of_week: number | null;
  time_of_day: 'AM' | 'PM' | null;
  estimated_minutes: number | null;
};

// The linked SOP, embedded on master_task_sops. sop_id is a many-to-one
// FK so PostgREST returns an object, but the generated types model it as
// an array -- and guessing wrong there fails silently (no poster, no
// text, no error), so both shapes are accepted.
type SopEmbed = {
  id: string;
  expected_appearance_url: string | null;
  sop_en: string | null;
  sop_es: string | null;
} | null;
type SopLinkRow = { master_task_id: string; sop_library: SopEmbed | SopEmbed[] };
type LinkedSop = { sopId: string; sopEn: string | null; sopEs: string | null };

const UNASSIGNED = 'Unassigned';
const NO_ROOM = '__noroom__';

// Areas whose work is not room-shaped: you maintain the boiler, watch the
// children, sweep the patio. A null room_id on one of these is correct
// data, not a gap to chase -- so they are excluded from Rooms Missing
// rather than counted and quietly ignored.
//
// SS-517: keyed on job_type, NOT source_area_en. The old list
// (['Maintenance', 'Childcare', 'Outdoors'] against source_area_en) did
// match rows -- the register's "matches nothing" theory was wrong, checked
// live before this edit -- but it excluded by DISPLAY AREA, so a
// shades_windows task filed under the "Outdoors" area was wrongly excused
// from needing a room. job_type is the work classification the 96
// legitimately-area-level tasks were actually counted by, and these three
// lowercase values are the stored ones.
const NON_ROOM_JOB_TYPES = ['maintenance', 'childcare', 'outdoor_perimeter'];

export default function DutyRosterClient({
  propertyId,
  properties,
}: {
  propertyId: string;
  /** SS-436/SS-410: when the operator console passes its member-property
   *  list (labelled household + property, e.g. "Strauss Main" -- asked
   *  three times), the roster goes CROSS-HOUSE: every query spans these
   *  properties and a house filter appears, default All Houses. Absent (a
   *  single-property mount), behaviour is exactly the old one. */
  properties?: { id: string; label: string }[];
}) {
  const t = useTranslations('dutyRoster');
  const tSupplies = useTranslations('taskSupplies');
  const locale = useLocale();
  const es = locale === 'es';
  const supabase = createClient();

  // SS-459 rule 2: house rows alphabetized by the label the viewer sees
  // (All Houses always first -- it renders as its own leading pill below).
  const propertyOptions = useMemo(
    () =>
      properties && properties.length > 0
        ? [...properties].sort((a, b) => a.label.localeCompare(b.label))
        : [{ id: propertyId, label: '' }],
    [properties, propertyId]
  );
  const propertyIds = useMemo(() => propertyOptions.map((p) => p.id), [propertyOptions]);
  const crossHouse = propertyOptions.length > 1;
  const labelByProperty = useMemo(() => new Map(propertyOptions.map((p) => [p.id, p.label])), [propertyOptions]);
  // 'all' or a property id. Only rendered (and only meaningful) cross-house.
  const [house, setHouse] = useState<string>('all');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sopCounts, setSopCounts] = useState<Record<string, number>>({});
  const [posterByTask, setPosterByTask] = useState<Record<string, string>>({});
  // SS-291 (reopened 31 Jul): task photos and SOP posters live in the
  // PRIVATE sop-posters bucket (SS-363), but the columns store public-style
  // URLs -- unsigned they 400 and the tiles rendered placeholders. Keyed
  // original URL -> signed URL; public-bucket URLs aren't in the map and
  // pass through unchanged.
  const [signedByUrl, setSignedByUrl] = useState<Record<string, string>>({});
  const [sopTextByTask, setSopTextByTask] = useState<Record<string, LinkedSop>>({});
  // Which tile has its procedure open. One at a time -- a grid with every
  // panel expanded is not a grid any more.
  const [openSopTaskId, setOpenSopTaskId] = useState<string | null>(null);
  // Retired (active=false) tasks are out of scope by default -- see the
  // scopedTasks note below.
  const [showRetired, setShowRetired] = useState(false);
  // Which room sections are collapsed. Sections start expanded, so an empty
  // set is the correct initial state -- this is the inverse of the Shopping
  // List, which seeds "everything collapsed" because it can hold 124 items
  // in one bucket. Here the sections themselves are the structure.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Room creation: rooms was seeded by SQL only, with no in-app path to add
  // one at all -- confirmed while investigating SS-374's empty states. A
  // property with zero rooms has zero assignable tasks, since every task
  // here organizes by room. Kept deliberately minimal (name EN/ES + an
  // optional floor) rather than a full rooms-management screen -- this
  // unblocks task assignment, it isn't a rewrite of how rooms work.
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomEn, setNewRoomEn] = useState('');
  const [newRoomEs, setNewRoomEs] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState('');
  const [newRoomError, setNewRoomError] = useState<string | null>(null);
  const [newRoomSaving, setNewRoomSaving] = useState(false);

  // task_supplies -- the "products with links" join. Loaded per visible
  // task set alongside everything else in load(), keyed by task_id.
  const [suppliesByTask, setSuppliesByTask] = useState<Map<string, TaskSupply[]>>(new Map());
  const [addSupplyTaskId, setAddSupplyTaskId] = useState<string | null>(null);
  const [removingSupplyId, setRemovingSupplyId] = useState<string | null>(null);
  // task_supplies structurally depends on inventory_items -- a supply IS a
  // join to an inventory row. So a property with tasks but its inventory
  // module switched off cannot meaningfully use supplies, and one with the
  // module on but zero items has nothing to pick. Both currently fail
  // quietly (an empty picker, or a supply pointing at something the
  // property can't display anywhere). Fetched so the UI can say which.
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [inventoryItemCount, setInventoryItemCount] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  // SS-273. 'all' is the default per spec -- distinct from `room`, which
  // narrows to one room; this narrows to a whole floor's worth of rooms.
  const [floor, setFloor] = useState('all');
  // SS-273. Sun-Fri only in the picker (Shabbos excluded by design -- a
  // frum household is not opening this app to plan Shabbos tasks), 'all'
  // meaning every day. Defaults to today's real ISO weekday computed once
  // on mount, EXCEPT when today is Shabbos itself: 6 (Saturday) is not a
  // selectable option, so there is no valid "today" to default to and this
  // falls back to 'all' rather than silently picking an adjacent day that
  // is not actually today.
  const [dayFilter, setDayFilter] = useState<number | 'all'>(() => {
    const today = getEasternIsoWeekday(new Date());
    return today === 6 ? 'all' : today;
  });
  const [room, setRoom] = useState('all');
  const [job, setJob] = useState('all');
  const [freq, setFreq] = useState('all');
  const [assignment, setAssignment] = useState('all');

  // Task CRUD. One form for both Add and Edit -- editing pre-fills the same
  // fields Add starts blank, so there is one save path to keep correct
  // rather than two.
  //
  // assigned_role is deliberately NOT a field in this form. The room-edit
  // code above its own comment already documents why: "assigned_role is
  // deliberately left alone. Not dropped, not cleared -- just no longer
  // written. It is null on every active task." Confirmed still true (0 of
  // 208 active tasks on Main have it set) before leaving it out -- adding a
  // field for something the team already decided to stop writing would
  // undo that decision by accident, not on purpose.
  const [taskForm, setTaskForm] = useState<{ mode: 'add' | 'edit'; taskId: string | null } | null>(null);
  const [formTaskEn, setFormTaskEn] = useState('');
  const [formTaskEs, setFormTaskEs] = useState('');
  const [formRoomId, setFormRoomId] = useState('');
  const [formFrequencyId, setFormFrequencyId] = useState('');
  const [formJobType, setFormJobType] = useState('');
  const [formTimeOfDay, setFormTimeOfDay] = useState<'' | 'AM' | 'PM'>('');
  // Optional. Not in the brief's own field list, but it is the one thing
  // that gives the day-of-week filter added earlier tonight something real
  // to demonstrate against -- confirmed live before adding it here that 0
  // of 208 active tasks have this set, so the filter currently has nothing
  // to narrow. This is the actual way that gets fixed.
  const [formDayOfWeek, setFormDayOfWeek] = useState<'' | number>('');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // SS-312: master_tasks.photo_url had no upload path anywhere in the app --
  // the only way to set it was asking Code to do it by hand. Deferred
  // upload (file held in state, uploaded inside saveTask), same pattern
  // NewRecipeModal already uses -- a brand-new task has no id to build a
  // storage path from until the insert below completes, so a path keyed on
  // a fresh UUID instead of the task id avoids that ordering problem for
  // both add and edit.
  const [formExistingPhotoUrl, setFormExistingPhotoUrl] = useState<string | null>(null);
  const [formPhotoFile, setFormPhotoFile] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formPhotoRemoved, setFormPhotoRemoved] = useState(false);
  const [showTaskCamera, setShowTaskCamera] = useState(false);
  const taskGalleryInputRef = useRef<HTMLInputElement>(null);
  // SS-436: which house a NEW task belongs to. Defaults to the selected
  // house filter (or the console property under All Houses); an edit pins
  // it to the task's own property and it is not changeable there -- moving
  // a task between houses is 145/146's lesson, not a dropdown.
  const [formPropertyId, setFormPropertyId] = useState<string>(propertyId);

  function openAddTask() {
    setFormTaskEn('');
    setFormTaskEs('');
    setFormRoomId('');
    setFormPropertyId(crossHouse && house !== 'all' ? house : propertyId);
    setFormFrequencyId('');
    setFormJobType('');
    setFormTimeOfDay('');
    setFormDayOfWeek('');
    setFormEstimatedMinutes('');
    setFormError(null);
    setFormExistingPhotoUrl(null);
    setFormPhotoFile(null);
    setFormPhotoPreview(null);
    setFormPhotoRemoved(false);
    setTaskForm({ mode: 'add', taskId: null });
  }

  function openEditTask(x: Task) {
    setFormTaskEn(x.task_en);
    setFormTaskEs(x.task_es);
    setFormRoomId(x.room_id ?? '');
    setFormPropertyId(x.property_id);
    setFormFrequencyId(x.frequency_id ?? '');
    setFormJobType(x.job_type ?? '');
    setFormTimeOfDay(x.time_of_day ?? '');
    setFormDayOfWeek(x.day_of_week ?? '');
    setFormEstimatedMinutes(x.estimated_minutes?.toString() ?? '');
    setFormError(null);
    setFormExistingPhotoUrl(x.photo_url ?? null);
    setFormPhotoFile(null);
    setFormPhotoPreview(null);
    setFormPhotoRemoved(false);
    setTaskForm({ mode: 'edit', taskId: x.id });
  }

  function closeTaskForm() {
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setTaskForm(null);
  }

  function handleTaskPhotoFile(file: File) {
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(file);
    setFormPhotoPreview(URL.createObjectURL(file));
    setFormPhotoRemoved(false);
    setShowTaskCamera(false);
  }

  function removeTaskPhoto() {
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhotoFile(null);
    setFormPhotoPreview(null);
    setFormPhotoRemoved(true);
  }

  async function saveTask() {
    // Bilingual at creation, not after (R19) -- the same gate
    // IdentifyItemClient already enforces for the same reason: letting this
    // save without both names just moves the failure to whoever notices the
    // blank Spanish column later, with no obvious cause at that point.
    if (!formTaskEn.trim() || !formTaskEs.trim()) {
      setFormError(t('bothLanguagesRequired'));
      return;
    }
    setFormSaving(true);
    setFormError(null);

    // SS-312/SS-104: a photo failure must not block the rest of the task
    // from saving, and must not fail silently either -- same lesson SS-104
    // just fixed for the recipe photo path. photoErrorMessage is reported
    // after a successful task save rather than swallowed or treated as
    // reason to abandon the whole save.
    let photoUrl = formExistingPhotoUrl;
    let photoErrorMessage: string | null = null;
    if (formPhotoRemoved) {
      photoUrl = null;
    } else if (formPhotoFile) {
      try {
        const compressed = await compressImageToBlob(formPhotoFile);
        const path = `${formPropertyId}/task-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('sop-posters')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (uploadError) {
          photoErrorMessage = uploadError.message;
        } else {
          const { data } = supabase.storage.from('sop-posters').getPublicUrl(path);
          photoUrl = data.publicUrl;
        }
      } catch (err) {
        photoErrorMessage = err instanceof Error ? err.message : 'Unknown error';
      }
    }

    const payload = {
      task_en: formTaskEn.trim(),
      task_es: formTaskEs.trim(),
      room_id: formRoomId || null,
      frequency_id: formFrequencyId || null,
      job_type: formJobType.trim() || null,
      time_of_day: formTimeOfDay || null,
      day_of_week: formDayOfWeek === '' ? null : formDayOfWeek,
      estimated_minutes: formEstimatedMinutes.trim() ? Number(formEstimatedMinutes) : null,
      photo_url: photoUrl,
    };

    if (taskForm?.mode === 'edit' && taskForm.taskId) {
      const { error } = await supabase.from('master_tasks').update(payload).eq('id', taskForm.taskId);
      setFormSaving(false);
      if (error) {
        setFormError(error.message || t('saveFailed'));
        return;
      }
    } else {
      // sort_order is NOT NULL with no default (confirmed against the
      // schema before writing this) -- a new task without one would fail
      // the insert outright. Placed after every task currently loaded so
      // it lands at the end of its room's list rather than jumping to the
      // top of whatever sort_order happens to be lowest.
      const nextSortOrder = tasks.reduce((max, x) => Math.max(max, x.sort_order), 0) + 1;

      // task_number is ALSO NOT NULL with no default and no generating
      // trigger (confirmed against the schema and pg_trigger before writing
      // this -- the one trigger on this table is the bilingual check, not a
      // number generator). Existing rows are "T-" + a 5-digit zero-padded
      // sequence (T-00305 is the current high mark). Queried fresh here
      // rather than computed from whatever rows happen to already be
      // loaded in this session, so two people adding a task around the same
      // moment are working from a number each just looked up, not a stale
      // one held in memory since page load.
      const { data: maxRow } = await supabase
        .from('master_tasks')
        .select('task_number')
        .order('task_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastNum = maxRow?.task_number ? parseInt(maxRow.task_number.replace(/\D/g, ''), 10) : 0;
      const taskNumber = `T-${String(lastNum + 1).padStart(5, '0')}`;

      const { error } = await supabase.from('master_tasks').insert({
        ...payload,
        // SS-436: the house chosen in the modal, never silently the console
        // property -- a new task belongs to the house whose work it is.
        property_id: formPropertyId,
        active: true,
        sort_order: nextSortOrder,
        task_number: taskNumber,
      });
      setFormSaving(false);
      if (error) {
        setFormError(error.message || t('saveFailed'));
        return;
      }
    }

    if (photoErrorMessage) {
      // The task itself saved fine -- only the photo failed. Left open with
      // the error visible rather than auto-closing, same as every other
      // formError path in this modal, so the failure isn't hidden the
      // instant it happens.
      setFormError(t('photoUploadFailed', { error: photoErrorMessage }));
      setFormPhotoFile(null);
      load();
      return;
    }

    closeTaskForm();
    load();
  }

  function openAddRoom() {
    setNewRoomEn('');
    setNewRoomEs('');
    setNewRoomFloor('');
    setNewRoomError(null);
    setShowAddRoom(true);
  }

  async function saveRoom() {
    // Bilingual at creation (R19), same gate every other create-a-thing
    // form in this app enforces -- rooms.name_es is NOT NULL with no
    // default, so an English-only row would fail the insert outright
    // anyway; this just gives that failure a real message instead of a
    // raw Postgres error.
    if (!newRoomEn.trim() || !newRoomEs.trim()) {
      setNewRoomError(t('bothLanguagesRequired'));
      return;
    }
    setNewRoomSaving(true);
    setNewRoomError(null);

    // sort_order is NOT NULL with no default (confirmed against the
    // schema) -- placed after every room already loaded, same convention
    // saveTask above uses for master_tasks.sort_order.
    const nextSortOrder = rooms.length;

    const { error } = await supabase.from('rooms').insert({
      // SS-436: rooms are created into the house selected in the filter --
      // creating one under All Houses lands on the console property, which
      // the modal states rather than hides.
      property_id: crossHouse && house !== 'all' ? house : propertyId,
      name_en: newRoomEn.trim(),
      name_es: newRoomEs.trim(),
      floor: newRoomFloor.trim() || null,
      sort_order: nextSortOrder,
      active: true,
    });

    setNewRoomSaving(false);
    if (error) {
      setNewRoomError(error.message || t('saveFailed'));
      return;
    }

    setShowAddRoom(false);
    load();
  }

  async function removeSupply(supplyId: string) {
    setRemovingSupplyId(supplyId);
    const { error } = await supabase.from('task_supplies').delete().eq('id', supplyId);
    setRemovingSupplyId(null);
    if (error) {
      setLoadError(error.message);
      return;
    }
    // Drop it locally rather than refetching the whole page for one row.
    setSuppliesByTask((prev) => {
      const next = new Map(prev);
      for (const [taskId, list] of next) {
        const filtered = list.filter((s) => s.id !== supplyId);
        if (filtered.length !== list.length) next.set(taskId, filtered);
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    const settled = await Promise.allSettled([
      supabase
        .from('master_tasks')
        .select('id, task_number, property_id, room_id, frequency_id, task_en, task_es, job_type, assigned_role, sop_id, source_area_en, source_area_es, photo_url, active, sort_order, day_of_week, time_of_day, estimated_minutes')
        .in('property_id', propertyIds)
        .order('sort_order'),
      supabase.from('frequencies').select('id, code, label_en, label_es, recurrence_kind, sort_order').order('sort_order'),
      supabase.from('rooms').select('id, name_en, name_es, floor, property_id').in('property_id', propertyIds).order('sort_order'),
      supabase
        .from('property_members')
        .select('id, user_id, property_id, profiles(full_name)')
        .in('property_id', propertyIds),
      // Already fetched for the SOP count; the poster and the procedure
      // text ride along on the same query rather than costing a second
      // round trip. Ordered so the first row per task is its primary SOP.
      supabase
        .from('master_task_sops')
        .select('master_task_id, sop_library(id, expected_appearance_url, sop_en, sop_es)')
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true }),
      // Only live assignments. Ended ones stay on the table as history.
      supabase.from('task_assignments').select('id, task_id, member_id, slot_id').eq('active', true),
      // SS-429 B: slots are assignable alongside people. Inactive slots are
      // not offered for NEW assignments but stay resolvable for display.
      supabase.from('staff_slots').select('id, label_en, label_es, user_id, active, property_id').in('property_id', propertyIds).order('sort_order'),
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

    // Supplies ride on a follow-up query rather than the Promise.allSettled
    // batch above: it needs the task ids, which only exist once that batch
    // has resolved. Failure here is deliberately non-fatal -- a task list
    // that renders without its supply rows is far better than one that
    // doesn't render at all, same principle as the failed[] handling above.
    const taskIdsForSupplies = (rows[0] as Task[]).map((x) => x.id);
    fetchSuppliesByTask(supabase, taskIdsForSupplies)
      .then(setSuppliesByTask)
      .catch(() => setSuppliesByTask(new Map()));

    // Same non-fatal treatment as supplies above: if either of these fails
    // the roster still renders, it just cannot explain the supplies state.
    supabase
      .from('properties')
      .select('feature_flags')
      .eq('id', propertyId)
      .single()
      .then(({ data }) => {
        const flags = (data?.feature_flags ?? {}) as Record<string, unknown>;
        setInventoryEnabled(flags.module_inventory !== false);
      });
    supabase
      .from('inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .then(({ count }) => setInventoryItemCount(count ?? 0));
    setMembers(
      (rows[3] as { id: string; user_id: string; property_id: string; profiles: unknown }[]).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        property_id: m.property_id,
        full_name: (m.profiles as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );

    // One pass over the SOP links produces all three things the tiles
    // need: how many SOPs a task has, its poster, and its procedure text.
    //
    // Poster and text are accumulated separately on purpose. The poster
    // may come from a later link when the primary SOP has no picture; the
    // TEXT must not, or a tile would show one procedure's words beside a
    // different procedure's photo.
    const counts: Record<string, number> = {};
    const posters: Record<string, string> = {};
    const sopTexts: Record<string, LinkedSop> = {};
    (rows[4] as unknown as SopLinkRow[]).forEach((r) => {
      counts[r.master_task_id] = (counts[r.master_task_id] ?? 0) + 1;
      const embed = Array.isArray(r.sop_library) ? r.sop_library[0] ?? null : r.sop_library;
      if (!embed) return;
      if (embed.expected_appearance_url && !posters[r.master_task_id]) {
        posters[r.master_task_id] = embed.expected_appearance_url;
      }
      if (!sopTexts[r.master_task_id]) {
        sopTexts[r.master_task_id] = { sopId: embed.id, sopEn: embed.sop_en, sopEs: embed.sop_es };
      }
    });
    setSopCounts(counts);
    setPosterByTask(posters);
    setSopTextByTask(sopTexts);
    // One batched signing pass for everything the tiles can show (SS-291).
    try {
      const signed = await signSopPosters(supabase, [
        ...(rows[0] as Task[]).map((x) => x.photo_url),
        ...Object.values(posters),
      ]);
      const byUrl: Record<string, string> = {};
      signed.forEach((v, k) => {
        if (v.fullUrl) byUrl[k] = v.fullUrl;
      });
      setSignedByUrl(byUrl);
    } catch {
      setSignedByUrl({});
    }
    setAssignments(rows[5] as Assignment[]);
    setSlots(rows[6] as Slot[]);
    setLoadError(failed.length > 0 ? t('loadPartial') : null);
    setLoading(false);
  }, [propertyId, propertyIds, supabase, t]);

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
      if (a.member_id || a.slot_id) m.set(a.task_id, a);
    });
    return m;
  }, [assignments]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);

  const memberName = (memberId: string | null | undefined) => {
    if (!memberId) return null;
    return memberById.get(memberId)?.full_name ?? null;
  };

  const slotLabel = (slotId: string | null | undefined) => {
    if (!slotId) return null;
    const s = slotById.get(slotId);
    if (!s) return null;
    return locale === 'es' ? s.label_es || s.label_en : s.label_en;
  };

  // What the assignment badge and the select show for a task -- a person's
  // name, or the slot's label. Never a typed name from anywhere else (R17).
  const assigneeDisplay = (a: Assignment | undefined) => {
    if (!a) return null;
    if (a.member_id) return memberName(a.member_id);
    return slotLabel(a.slot_id);
  };

  const assigneeValue = (a: Assignment | undefined) => {
    if (!a) return '';
    if (a.member_id) return `${MEMBER_PREFIX}${a.member_id}`;
    if (a.slot_id) return `${SLOT_PREFIX}${a.slot_id}`;
    return '';
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
  // A null-room task has no floor either -- roomById.get(null) misses and
  // ?. short-circuits to undefined, which never equals a real floor name,
  // so these tasks correctly drop out of any specific floor and only
  // appear under "All floors".
  const matchFloor = (x: Task) => floor === 'all' || roomById.get(x.room_id ?? '')?.floor === floor;
  // SS-273. NULL day_of_week means "every day" -- the same rule
  // my-day/page.tsx's own query already applies (day_of_week.is.null OR
  // day_of_week.eq.today), not a new one invented for this filter. That is
  // what makes a Daily task always show regardless of which day is picked,
  // and it is ALSO the effective behaviour for every Weekly/Monthly/
  // Seasonal task today, since none of the 208 active tasks on Main have
  // day_of_week set yet -- confirmed live before writing this. This filter
  // narrows correctly the moment a task's day gets assigned; it does not
  // retroactively invent a day for tasks that have none.
  const matchDay = (x: Task) => dayFilter === 'all' || x.day_of_week === null || x.day_of_week === dayFilter;
  const matchJob = (x: Task) => job === 'all' || (x.job_type ?? '') === job;
  const matchSearch = (x: Task) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [x.task_en, x.task_es, roomLabel(x.room_id), x.job_type ?? ''].join(' ').toLowerCase().includes(q);
  };

  // SS-309. `active` was selected into Task and then never read anywhere --
  // not in the query, not client-side. So retired rows rendered as tiles
  // and counted in every stat: five Childcare duplicates from a July 19
  // batch insert, each pair already correctly one active + one inactive,
  // inflating "Total" by five.
  //
  // Scoped ONCE here rather than filtered at each call site, so the stats,
  // the dropdown option lists and the tile grid cannot disagree about what
  // they are counting. Everything downstream reads scopedTasks.
  //
  // Not hidden outright: this page is owner/manager only, and an admin is
  // exactly who might need to find a retired task to reactivate it.
  // Hiding them with no way back would trade a visible wrong number for an
  // invisible missing row.
  const scopedTasks = useMemo(
    () =>
      (showRetired ? tasks : tasks.filter((x) => x.active)).filter(
        // SS-436: the house filter scopes EVERYTHING downstream -- stats,
        // dropdown option pools, sections -- exactly like showRetired does,
        // so no surface can disagree about which houses it is counting.
        (x) => !crossHouse || house === 'all' || x.property_id === house
      ),
    [tasks, showRetired, crossHouse, house]
  );
  const retiredCount = useMemo(() => tasks.filter((x) => !x.active).length, [tasks]);

  // Cross-narrowing: each dropdown is built from what the OTHER filters leave,
  // so no combination can be assembled that returns nothing.
  const freqOptions = useMemo(() => {
    const present = new Set(
      scopedTasks
        .filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && matchJob(x) && matchAssignment(x) && matchSearch(x))
        .map((x) => x.frequency_id)
    );
    return frequencies.filter((f) => present.has(f.id));
  }, [scopedTasks, frequencies, dayFilter, floor, room, job, assignment, search]);

  const roomOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    const ids = new Set(pool.map((x) => x.room_id));
    return { hasNull: ids.has(null), list: rooms.filter((r) => ids.has(r.id)) };
  }, [scopedTasks, rooms, dayFilter, floor, job, freq, assignment, search, passesFrequency]);

  const jobOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x));
    return [...new Set(pool.map((x) => x.job_type).filter(Boolean))].sort() as string[];
  }, [scopedTasks, dayFilter, floor, room, freq, assignment, search, passesFrequency]);

  const filtered = useMemo(
    () => scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchSearch(x)),
    [scopedTasks, dayFilter, floor, room, job, freq, assignment, search, passesFrequency]
  );

  // Room sections. Label is the room name when room_id is set, otherwise the
  // task's source area -- every null-room task has one (checked live: 24 of
  // 124 on Main have no room, 0 of those lack an area), so there is no
  // "everything else" bucket to design around.
  //
  // Built from `filtered`, not from tasks, so every existing filter keeps
  // working untouched: a section only exists if something in it survived the
  // filters, which is also why zero-match sections disappear rather than
  // needing to be hidden.
  //
  // Sorted by the label the viewer actually sees, using localeCompare with
  // the active locale. The brief said A-Z by task_en, but sorting Spanish
  // text by its English original produces an order that looks scrambled to
  // the person reading it -- and accented characters need locale-aware
  // collation regardless.
  const sections = useMemo(() => {
    const map = new Map<string, { roomLabel: string; houseLabel: string; items: Task[] }>();
    for (const x of filtered) {
      const room = x.room_id ? roomById.get(x.room_id) : null;
      const roomLabel = room
        ? (es ? room.name_es || room.name_en : room.name_en)
        : (es ? x.source_area_es || x.source_area_en : x.source_area_en) || t('noRoom');
      // SS-436 reopen defect 5: never a concatenated house-room bar
      // ("low baby room"). Under All Houses two houses can both have a
      // Kitchen, so the house still keys the grouping -- but it renders as
      // its own small eyebrow on the header, separate from the room name.
      const houseLabel = crossHouse && house === 'all' ? (labelByProperty.get(x.property_id) ?? '') : '';
      const key = `${houseLabel}|${roomLabel}`;
      const entry = map.get(key);
      if (entry) entry.items.push(x);
      else map.set(key, { roomLabel, houseLabel, items: [x] });
    }
    // SS-459 rule 1: within each room group, tiles flow DAILY first
    // (alphabetical), then WEEKLY (alphabetical), then lower frequencies --
    // frequency rank comes from frequencies.sort_order (daily < weekly <
    // monthly...), tasks with no frequency last, alphabetical inside each
    // rank.
    const freqRank = (x: Task) => {
      const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
      return f ? f.sort_order : Number.MAX_SAFE_INTEGER;
    };
    return [...map.entries()]
      .map(([key, { roomLabel, houseLabel, items }]) => ({
        label: key,
        roomLabel,
        houseLabel,
        items: [...items].sort(
          (a, b) =>
            freqRank(a) - freqRank(b) ||
            (es ? a.task_es || a.task_en : a.task_en).localeCompare(
              es ? b.task_es || b.task_en : b.task_en,
              locale
            )
        ),
      }))
      // House groups stay together (alphabetical), rooms alphabetical
      // within each house.
      .sort(
        (a, b) =>
          a.houseLabel.localeCompare(b.houseLabel, locale) ||
          a.roomLabel.localeCompare(b.roomLabel, locale)
      );
  }, [filtered, roomById, es, locale, t, crossHouse, house, labelByProperty, freqById]);

  // Every room for this property, A-Z, for the inline room editor. Distinct
  // from `roomOptions` above, which is deliberately narrowed by the other
  // filters -- you must be able to move a task INTO a room that the current
  // filter would otherwise hide.
  const roomOptionsAZ = useMemo(
    () => [...rooms].sort((a, b) => (es ? a.name_es || a.name_en : a.name_en).localeCompare(es ? b.name_es || b.name_en : b.name_en, locale)),
    [rooms, es, locale]
  );

  // SS-436: a task can only be moved into (or created in) a room of ITS
  // OWN house -- offering Main's Kitchen on a Low task would silently
  // cross-link properties, the exact defect class 145/146 reconciled.
  const roomsForProperty = useCallback(
    (pid: string) => roomOptionsAZ.filter((r) => r.property_id === pid),
    [roomOptionsAZ]
  );

  // SS-436: assignees are house-scoped the same way -- a tile offers the
  // people and slots of the task's own property, never the union.
  const assigneesForProperty = useCallback(
    (pid: string) => [
      ...members
        .filter((m) => m.property_id === pid)
        .map((m) => ({ id: `${MEMBER_PREFIX}${m.id}`, label: m.full_name ?? t('unnamedMember') })),
      ...slots
        .filter((s) => s.property_id === pid && s.active)
        .map((s) => ({
          id: `${SLOT_PREFIX}${s.id}`,
          label: locale === 'es' ? s.label_es || s.label_en : s.label_en,
        })),
    ],
    [members, slots, locale, t]
  );

  function toggleSection(label: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // Derived from `filtered`, so the tiles answer "of what I'm looking at
  // right now" and move as the filters move. That is the whole reason they
  // stayed in this component rather than being hoisted into a page shell.
  //
  // SS-517 note on "Total": the register compared this tile (928) against a
  // global count of 930 and called it wrong. It is not -- the two extra
  // rows are QA Demo's, and this page deliberately scopes to propertyIds.
  // Filtered-derived stats are correct behaviour, kept.
  const stats = useMemo(
    () => ({
      total: filtered.length,
      unassigned: filtered.filter(isUnassigned).length,
      // SS-517: count the sop_id FK on the task, not the sopCounts join
      // map -- the join (master_task_sops) links only 160 tasks while 642
      // carry sop_id, and Racquel's chat-side resolution ruled sop_id IS
      // the definition of "has a procedure".
      withSop: filtered.filter((x) => x.sop_id !== null).length,
      roomsMissing: filtered.filter(
        (x) => x.room_id === null && !NON_ROOM_JOB_TYPES.includes(x.job_type ?? '')
      ).length,
    }),
    // assignmentByTask (memoized), not isUnassigned (recreated per render):
    // the closure the unassigned count actually varies with.
    [filtered, assignmentByTask]
  );

  // SS-273. Fixed order (not alphabetical, not sort_order) so the tab row
  // reads Basement -> Main Floor -> Upstairs regardless of how individual
  // rooms happen to be ordered within each floor. Only real, present floor
  // values -- a property with no floor data on any room shows no tab row
  // at all rather than an empty one.
  // SS-436 cross-house: floors are a per-house concept -- Main and Low have
  // them, Lax and Country are deliberately NULL (SS-420) -- so the tab row
  // only renders once a single house is selected, from that house's own
  // rooms. All Houses shows no floor row rather than a union of floor names
  // that silently means different things per house.
  const floorRoomPool = crossHouse
    ? house === 'all'
      ? []
      : rooms.filter((r) => r.property_id === house)
    : rooms;
  const allFloorNames = FLOOR_ORDER.filter((f) => floorRoomPool.some((r) => r.floor === f));
  const floorLabel = (f: string) => (es && FLOOR_ES[f] ? FLOOR_ES[f] : f);

  // floor is deliberately excluded from filtersActive/clearFilters -- it is
  // a top-level view tab, same role Inventory's own floor tabs play there,
  // not one of the filter pills a person "clears." Persists across a clear
  // the same way switching floors on Inventory does.
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
  // SS-130: the room eyebrow was display-only, which is what made
  // "Rooms Missing" a number you could read but not act on. Owner/manager
  // only by construction -- this whole page redirects staff out.
  //
  // Optimistic: the tile (and the section it sits in) moves immediately,
  // then rolls back to the loaded state if the write fails. Changing a room
  // re-buckets the task, because `sections` derives from the same task list
  // rather than caching its own copy.
  async function setTaskRoom(taskId: string, roomId: string | null) {
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, room_id: roomId } : x)));
    const { error } = await supabase.from('master_tasks').update({ room_id: roomId }).eq('id', taskId);
    if (error) {
      setTasks(previous);
      setLoadError(t('saveFailed'));
    }
  }

  // Retired tasks are reachable behind the filter (SS-309) but there was no
  // way back from there. R21 says deprecate rather than delete, which only
  // works if un-deprecating is possible.
  async function reactivateTask(taskId: string) {
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, active: true } : x)));
    const { error } = await supabase.from('master_tasks').update({ active: true }).eq('id', taskId);
    if (error) {
      setTasks(previous);
      setLoadError(t('saveFailed'));
    }
  }

  // The other direction of reactivateTask above, same optimistic-then-
  // rollback shape. Soft-delete only (R21) -- active: false, never a real
  // delete -- which is exactly what makes reactivateTask meaningful as a
  // way back.
  async function retireTask(taskId: string) {
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, active: false } : x)));
    const { error } = await supabase.from('master_tasks').update({ active: false }).eq('id', taskId);
    if (error) {
      setTasks(previous);
      setLoadError(t('saveFailed'));
    }
  }

  // `target` is the select's encoded value: m:<member_id>, s:<slot_id>, or ''.
  async function assign(taskId: string, target: string) {
    const existing = assignmentByTask.get(taskId);
    if (existing && assigneeValue(existing) === target) return;

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
    if (!target) {
      setAssignments((prev) => prev.filter((a) => a.task_id !== taskId));
      return;
    }

    // SS-429 B: one column or the other, never both (DB check enforces the
    // same). A slot assignment works with zero staff accounts; whoever is
    // later linked into the slot inherits the task.
    const isSlot = target.startsWith(SLOT_PREFIX);
    const targetId = isSlot ? target.slice(SLOT_PREFIX.length) : target.slice(MEMBER_PREFIX.length);
    const row = {
      task_id: taskId,
      member_id: isSlot ? null : targetId,
      slot_id: isSlot ? targetId : null,
    };

    const { data, error } = await supabase
      .from('task_assignments')
      .insert(row)
      .select('id, task_id, member_id, slot_id')
      .single();
    if (error || !data) {
      setLoadError(t('saveFailed'));
      load(); // never leave the screen claiming a save that failed
      return;
    }
    setAssignments((prev) => [...prev.filter((a) => a.task_id !== taskId), data as Assignment]);
  }

  // (The flat cross-property assignee list was replaced by
  // assigneesForProperty above -- SS-436 scopes every tile's options to the
  // task's own house. R17 and the SS-429 B slot rules carry over unchanged.)

  // SS-436: switching house resets the floor tab and room filter -- both
  // are per-house concepts, and a Main floor name filtering Low's tasks
  // would silently show nothing.
  useEffect(() => {
    setFloor('all');
    setRoom('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [house]);

  const pill =
    'appearance-none bg-card border border-cardBorder rounded-full px-3 py-1.5 text-[12px] text-denim';

  // Outer container removed (SS-156 Phase 2) -- the page frame owns the
  // background and max-width now, so the Tasks and Roster tabs stop
  // changing width and colour as you switch. The standalone
  // /staff/duty-roster route supplies the same frame itself.
  //
  // The stat tiles moved up into TaskCenterTabs so they are visible on
  // both tabs rather than only this one. Their computation (`stats`, from
  // `filtered`) is still here and untouched -- see the note above it.
  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-[34px] font-normal text-denim">{t('title')}</h1>
          <p className="text-[13px] text-dusk mb-5">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* SS-269: the one thing that made "photograph after" unverifiable
              was there being nowhere to go look afterward -- this is that
              destination, linked from the page managers already use to
              manage tasks. */}
          <Link
            href={`/properties/${propertyId}/tools/task-verification`}
            className="text-[13px] font-medium text-brass underline underline-offset-2"
          >
            {t('viewVerification')}
          </Link>
          <button
            onClick={openAddRoom}
            className="bg-card border border-cardBorder text-denim text-[13px] font-medium px-4 py-2 rounded-full hover:bg-mist transition-colors"
          >
            + {t('addRoom')}
          </button>
          <button
            onClick={openAddTask}
            className="bg-denim text-white text-[13px] font-medium px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            + {t('addTask')}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="mb-4 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{loadError}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { k: 'statTotal', v: stats.total },
          { k: 'statUnassigned', v: stats.unassigned },
          { k: 'statWithSop', v: stats.withSop },
          // Carries a hint because a zero here is a real answer, not an
          // empty one: without saying why, "Rooms Missing 0" looks like the
          // count is broken. Rendered as a caption as well as a title
          // attribute -- a hover-only tooltip tells a phone user nothing.
          { k: 'statRoomsMissing', v: stats.roomsMissing, hint: t('statRoomsMissingHint') },
        ].map((s) => (
          <div
            key={s.k}
            title={s.hint}
            className="relative bg-card border border-cardBorder rounded-xl2 shadow-card p-4"
          >
            <PinDot />
            <p className="text-[12px] text-dusk">{t(s.k)}</p>
            <p className="font-display text-[24px] text-denim leading-tight mt-0.5">{s.v}</p>
            {s.hint && <p className="text-[10px] text-dusk leading-snug mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>

      {/* SS-266/tools-cleanup: the "Deploy from the task library" panel that
          used to sit here is removed, not hidden -- the SOP Library is
          reachable from Tools, and this was a second door to the same
          room. Its dedicated state (sopLibrary, showLibrary, deployBusyId,
          deployRoom, deployMember), its own sop_library fetch, and
          deploySop() were removed alongside it rather than left as dead
          code with nothing left to render them. master_task_sops (the
          query that feeds each tile's own SOP count/poster/procedure text)
          is untouched -- a different query, still very much in use. */}

      {/* SS-436/SS-410 house filter -- the cross-house console's top-level
          narrowing, above the floor tabs because a floor only means
          something within one house. Pills carry the household + property
          label ("Strauss Main"), never the bare property name -- asked
          three times. Same pill-strip treatment as the floor tabs below. */}
      {crossHouse && (
        <div className="flex items-center gap-1 bg-mist rounded-full p-1 flex-wrap mb-3 w-fit">
          <button
            onClick={() => setHouse('all')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              house === 'all' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            {t('allHouses')}
          </button>
          {propertyOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setHouse(p.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                house === p.id ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {p.label || p.id}
            </button>
          ))}
        </div>
      )}

      {/* SS-273 floor tabs -- same bg-mist pill-strip treatment Inventory
          already uses for its own floor tabs (InventoryClient.tsx), so the
          two pages read as the same pattern rather than two designs for
          the same idea. Hidden when there is only one real floor value (or
          none), same guard Inventory applies, since a single-option tab row
          filters nothing. */}
      {allFloorNames.length > 1 && (
        <div className="flex items-center gap-1 bg-mist rounded-full p-1 flex-wrap mb-3 w-fit">
          <button
            onClick={() => setFloor('all')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              floor === 'all' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            {t('allFloors')}
          </button>
          {allFloorNames.map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                floor === f ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {floorLabel(f)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="bg-card border border-cardBorder rounded-full px-4 py-2 text-[13px] text-denim placeholder:text-dusk"
        />
        {/* SS-273. Sun-Fri only -- Shabbos (6/Saturday) is never an option,
            by design, not an oversight. Displayed Sunday-first (US-week
            convention), a separate concern from the ISO 1=Mon numbering
            the underlying column and every predicate above use. */}
        <select
          className={pill}
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label={t('filterDay')}
        >
          <option value="all">{t('allDays')}</option>
          {DAY_PICKER_OPTIONS.map(({ iso, key }) => (
            <option key={iso} value={iso}>
              {t(key)}
            </option>
          ))}
        </select>
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

        {/* The way back to retired tasks. Only offered when there are any --
            a toggle that reveals nothing is just a question mark. Sits with
            the other filters because that is what it is: a scope control,
            not a setting. */}
        {retiredCount > 0 && (
          <label className="inline-flex items-center gap-2 text-[12px] text-denim cursor-pointer">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(e) => setShowRetired(e.target.checked)}
              className="h-4 w-4 accent-brass rounded"
            />
            {t('showRetired', { count: retiredCount })}
          </label>
        )}
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
            <div className="space-y-5">
              {sections.map((section) => {
                const sectionCollapsed = collapsedSections.has(section.label);
                return (
                  <div key={section.label}>
                    {/* Denim strip header, room name left, count right, pin
                        dot top-right (D-03). The whole strip is the toggle,
                        matching the Shopping List's tap-the-header pattern
                        rather than introducing a chevron (D-21). */}
                    <button
                      onClick={() => toggleSection(section.label)}
                      aria-expanded={!sectionCollapsed}
                      className="relative w-full flex items-center justify-between gap-3 bg-denim rounded-xl2 py-[11px] pl-5 pr-8 mb-[14px] text-left"
                    >
                      {/* Reopen defect 5: the house is its own eyebrow, the
                          room its own line -- never one concatenated bar. */}
                      <span className="min-w-0">
                        {section.houseLabel && (
                          <span className="block text-[9px] font-semibold tracking-[0.2em] uppercase text-white/60 truncate">
                            {section.houseLabel}
                          </span>
                        )}
                        <span className="block text-[10px] font-semibold tracking-[0.17em] uppercase text-white truncate">
                          {section.roomLabel}
                        </span>
                      </span>
                      <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 shrink-0">
                        {section.items.length}
                      </span>
                      <PinDot />
                    </button>

                    {!sectionCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[14px]">
                        {section.items.map((x) => {
                const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
                const unassigned = isUnassigned(x);
                const sops = sopCounts[x.id] ?? 0;
                const rawTileImage = x.photo_url ?? posterByTask[x.id] ?? null;
                // SS-291: private-bucket URLs must go out signed.
                const tileImage = rawTileImage ? signedByUrl[rawTileImage] ?? rawTileImage : null;
                const linked = sopTextByTask[x.id] ?? null;
                // Falls back to the other language rather than showing an
                // empty panel: English instructions beat no instructions.
                const sopText = linked ? (es ? linked.sopEs ?? linked.sopEn : linked.sopEn ?? linked.sopEs) : null;
                const sopOpen = openSopTaskId === x.id;
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
                        {/* SS-130: the room is editable in place now. Styled
                            to read as the eyebrow it replaces -- no border,
                            no chrome -- so the tile looks unchanged until
                            you interact with it. appearance-none because a
                            native caret here would read as decoration on an
                            uppercase micro-label. */}
                        <span className="flex items-center gap-1 min-w-0">
                          <select
                            value={x.room_id ?? ''}
                            onChange={(e) => setTaskRoom(x.id, e.target.value || null)}
                            aria-label={t('changeRoom')}
                            className="appearance-none bg-transparent cursor-pointer text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate max-w-[120px] hover:underline underline-offset-2"
                          >
                            <option value="">{t('noRoom')}</option>
                            {roomsForProperty(x.property_id).map((r) => (
                              <option key={r.id} value={r.id}>
                                {es ? r.name_es || r.name_en : r.name_en}
                              </option>
                            ))}
                          </select>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass truncate">
                            • {x.job_type ?? '—'}
                          </span>
                        </span>
                        <span className="shrink-0 text-[8px] uppercase tracking-[0.15em] bg-card border border-cardBorder text-dusk px-2 py-0.5 rounded-full">
                          {freqLabel(f)}
                        </span>
                      </div>

                      {/* Task illustration first (what this job is), else
                          the linked SOP's poster (what finished looks
                          like). Different meanings, never conflated -- the
                          task's own photo wins. Nothing renders when there
                          is neither, rather than a grey placeholder on most
                          tiles. Resized: these are full-size images and a
                          grid draws many at once. */}
                      <div className="flex items-start gap-2.5 mt-2">
                        {tileImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={storageThumbnail(tileImage, 96)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="shrink-0 h-12 w-12 rounded-lg object-cover bg-card"
                          />
                        )}
                        <p
                          className="flex-1 min-w-0 font-display text-[15px] text-denim"
                          style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          title={es ? x.task_es : x.task_en}
                        >
                          {es ? x.task_es : x.task_en}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Only ever visible when the retired filter is on,
                            since inactive rows are otherwise out of scope --
                            but then it must be unmistakable which tiles are
                            the retired ones. */}
                        {!x.active && (
                          <>
                            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk border border-cardBorder rounded-full px-2 py-0.5">
                              {t('retiredBadge')}
                            </span>
                            {/* The way back. R21's "deprecate, don't delete"
                                only holds up if un-deprecating is possible
                                from the same screen that hid it. */}
                            <button
                              onClick={() => reactivateTask(x.id)}
                              className="text-[9px] font-semibold uppercase tracking-[0.15em] text-denim underline-offset-2 hover:underline"
                            >
                              {t('reactivate')}
                            </button>
                          </>
                        )}
                        {/* Symmetric with the retired-badge/reactivate pair
                            above: Edit and Retire only make sense on an
                            ACTIVE tile, the same way reactivate only makes
                            sense on a retired one. Retire is a real confirm,
                            not a bare click -- unlike reactivate (reversible
                            in one tap either way), retiring is the one that
                            removes a tile from the view someone is looking
                            at right now. */}
                        {x.active && (
                          <>
                            <button
                              onClick={() => openEditTask(x)}
                              className="text-[9px] font-semibold uppercase tracking-[0.15em] text-denim underline-offset-2 hover:underline"
                            >
                              {t('editTask')}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(t('confirmRetire', { name: es ? x.task_es : x.task_en }))) retireTask(x.id);
                              }}
                              className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk underline-offset-2 hover:underline hover:text-rust"
                            >
                              {t('retireTask')}
                            </button>
                          </>
                        )}
                        {/* Offered only when a supply could actually be
                            created. A supply is a join to an inventory row,
                            so with the module off there is nothing to join
                            to that this property can display, and with zero
                            items there is nothing to pick -- in both cases
                            the button led to a dead end that explained
                            nothing. The reason is stated below instead. */}
                        {x.active && inventoryEnabled && (inventoryItemCount ?? 0) > 0 && (
                          <button
                            onClick={() => setAddSupplyTaskId(x.id)}
                            className="text-[9px] font-semibold uppercase tracking-[0.15em] text-denim underline-offset-2 hover:underline"
                          >
                            {tSupplies('addSupply')}
                          </button>
                        )}
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

                      {/* Always visible, not hidden behind the procedure
                          toggle -- "which products do I need for this job"
                          is a before-you-start question, and burying it one
                          tap deep is how task_supplies stayed invisible in
                          the first place. Renders nothing at all when a task
                          has no supplies, so tiles without them are
                          unchanged. */}
                      <TaskSuppliesList
                        supplies={suppliesByTask.get(x.id) ?? []}
                        onRemove={removeSupply}
                        removingId={removingSupplyId}
                      />

                      {/* Says WHY supplies are unavailable rather than
                          leaving the absence of an Add button unexplained.
                          Two distinct causes, two distinct messages -- and
                          the module-off case is shown even when the task
                          already HAS supplies, because those supplies point
                          at inventory rows this property currently cannot
                          open anywhere. */}
                      {x.active && !inventoryEnabled && (
                        <p className="mt-1.5 text-[10px] text-dusk">{tSupplies('inventoryOff')}</p>
                      )}
                      {x.active && inventoryEnabled && inventoryItemCount === 0 && (
                        <p className="mt-1.5 text-[10px] text-dusk">{tSupplies('noItemsYet')}</p>
                      )}

                      {/* The full procedure, inline. Collapsed by default so
                          the grid stays a grid; open one and it expands in
                          place. No navigation away -- the whole point of
                          SS-300 was that the procedure reaches the person
                          looking at the task. */}
                      {sopText && (
                        <>
                          <button
                            onClick={() => setOpenSopTaskId(sopOpen ? null : x.id)}
                            aria-expanded={sopOpen}
                            className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-brass"
                          >
                            <ClipboardList size={11} strokeWidth={1.75} aria-hidden="true" />
                            {sopOpen ? t('hideProcedure') : t('showProcedure')}
                          </button>
                          {sopOpen && (
                            <div className="mt-2 rounded-xl bg-card border border-cardBorder p-2.5 space-y-2">
                              {/* Authored as multi-step instructions with
                                  real line breaks; collapsing them into one
                                  paragraph makes a procedure unreadable. */}
                              <p className="text-[11px] text-denim whitespace-pre-line leading-relaxed">
                                {sopText}
                              </p>
                              {posterByTask[x.id] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={storageThumbnail(signedByUrl[posterByTask[x.id]] ?? posterByTask[x.id], 640)}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full max-h-48 object-contain rounded-lg bg-mist"
                                />
                              )}
                              {/* Opens the SOP Library scrolled to and
                                  expanded on this exact SOP -- the
                                  ?sop=<id> deep link added for this. New
                                  tab on purpose: the inline text above
                                  exists so nobody loses their place in the
                                  roster, and a same-tab link would undo
                                  that. rel is required with target _blank
                                  so the opened page cannot reach back
                                  through window.opener. */}
                              {linked?.sopId && (
                                <a
                                  href={routes.sops(propertyId, linked.sopId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-[11px] font-medium text-brass underline-offset-2 hover:underline"
                                >
                                  {t('viewFullProcedure')}
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="-mx-[18px] -mb-[14px] mt-2 bg-card px-[18px] py-2 flex justify-between items-center rounded-b-xl2 border-t border-cardBorder">
                      {unassigned ? (
                        <span className="w-5 h-5 rounded-full border border-dashed border-dusk text-dusk text-[10px] flex items-center justify-center shrink-0">
                          ?
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-denim text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {(assigneeDisplay(assignmentByTask.get(x.id)) ?? '?')
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                      <select
                        className="appearance-none bg-white border border-cardBorder rounded-full px-3 py-1.5 text-[11px] text-denim truncate max-w-[110px]"
                        value={assigneeValue(assignmentByTask.get(x.id))}
                        onChange={(e) => assign(x.id, e.target.value)}
                        aria-label={t('assignTo')}
                      >
                        {/* Reads as an action when there is something to
                            remove, and as a placeholder when there isn't --
                            "Unassigned" sitting above a list of names looks
                            like another person rather than a verb. */}
                        <option value="">
                          {unassigned ? t('unassigned') : t('removeAssignment')}
                        </option>
                        {assigneesForProperty(x.property_id).map((a) => (
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit task modal. One form for both -- see the state comment
          above for why. Concept B: bg-card, PinDot, rounded-xl3, the same
          blue-grey shadow every other card in this file uses, Cormorant for
          the title, Inter (the page default) for every field label. */}
      {taskForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeTaskForm}
        >
          <div
            className="relative w-full max-w-md bg-card rounded-xl3 shadow-card p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PinDot />
            <h2 className="font-display text-[22px] text-denim mb-4">
              {taskForm.mode === 'add' ? t('addTaskTitle') : t('editTaskTitle')}
            </h2>

            {formError && (
              <p className="mb-3 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{formError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('formTaskEn')}
                </label>
                <input
                  value={formTaskEn}
                  onChange={(e) => setFormTaskEn(e.target.value)}
                  className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                />
              </div>
              {/* Spanish is required, not optional -- the same
                  trg_enforce_task_bilingual trigger that already guards
                  every insert/update on this table would reject a save
                  without it; this stops that failure here, where the
                  person can actually see and fix it, rather than as a raw
                  Postgres error after clicking Save. */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('formTaskEs')}
                </label>
                <input
                  value={formTaskEs}
                  onChange={(e) => setFormTaskEs(e.target.value)}
                  className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                />
                {!formTaskEs.trim() && (
                  <p className="text-[11px] text-brass mt-1">{t('bothLanguagesRequired')}</p>
                )}
              </div>

              {/* SS-436: which house this task belongs to. Add mode only --
                  moving an existing task between houses is a reconcile-class
                  operation (see 145/146), not an edit-modal dropdown.
                  Changing the house clears the room pick, which belonged to
                  the previous house. */}
              {crossHouse && taskForm?.mode === 'add' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formHouse')}
                  </label>
                  <select
                    value={formPropertyId}
                    onChange={(e) => {
                      setFormPropertyId(e.target.value);
                      setFormRoomId('');
                    }}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim bg-card"
                  >
                    {propertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formRoom')}
                  </label>
                  <select
                    value={formRoomId}
                    onChange={(e) => setFormRoomId(e.target.value)}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim bg-card"
                  >
                    <option value="">{t('noRoom')}</option>
                    {roomsForProperty(formPropertyId).map((r) => (
                      <option key={r.id} value={r.id}>
                        {es ? r.name_es || r.name_en : r.name_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formFrequency')}
                  </label>
                  <select
                    value={formFrequencyId}
                    onChange={(e) => setFormFrequencyId(e.target.value)}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim bg-card"
                  >
                    <option value="">—</option>
                    {frequencies.map((f) => (
                      <option key={f.id} value={f.id}>
                        {es ? f.label_es : f.label_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formJobType')}
                  </label>
                  {/* Free text, matching the column itself -- job_type has
                      13 real distinct values on Main today and no fixed
                      enum, confirmed before choosing a plain input with a
                      datalist over a closed <select> that would have
                      blocked a genuinely new value. */}
                  <input
                    list="job-type-options"
                    value={formJobType}
                    onChange={(e) => setFormJobType(e.target.value)}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                  />
                  <datalist id="job-type-options">
                    {jobOptions.map((j) => (
                      <option key={j} value={j} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formTimeOfDay')}
                  </label>
                  <select
                    value={formTimeOfDay}
                    onChange={(e) => setFormTimeOfDay(e.target.value as '' | 'AM' | 'PM')}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim bg-card"
                  >
                    <option value="">{t('formAnyTime')}</option>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* Not in the brief's own field list -- added because it
                      is the one thing that gives the day-of-week filter
                      built earlier tonight something real to demonstrate.
                      Optional, defaulting to "every day" (NULL), same as
                      every task already in this table today. */}
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formDayOfWeek')}
                  </label>
                  <select
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim bg-card"
                  >
                    <option value="">{t('allDays')}</option>
                    {DAY_PICKER_OPTIONS.map(({ iso, key }) => (
                      <option key={iso} value={iso}>
                        {t(key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                    {t('formMinutes')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formEstimatedMinutes}
                    onChange={(e) => setFormEstimatedMinutes(e.target.value)}
                    className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                  />
                </div>
              </div>

              {/* SS-312: the tile's reference photo -- what this task looks
                  like, shown on the tile itself (see tileImage above). Not
                  the "after" evidence photo staff attach on completion
                  (task_completions.photo_url, a separate field, separate
                  meaning) -- this one identifies the task, that one proves
                  it was done. */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('formPhoto')}
                </label>
                {formPhotoPreview || (formExistingPhotoUrl && !formPhotoRemoved) ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formPhotoPreview ?? storageThumbnail(signedByUrl[formExistingPhotoUrl!] ?? formExistingPhotoUrl!, 96)}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover bg-mist"
                    />
                    <button
                      type="button"
                      onClick={removeTaskPhoto}
                      className="inline-flex items-center gap-1 text-xs font-medium text-rust"
                    >
                      <XIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                      {t('formRemovePhoto')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTaskCamera(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brass underline underline-offset-2"
                    >
                      <CameraIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                      {t('formTakePhoto')}
                    </button>
                    <button
                      type="button"
                      onClick={() => taskGalleryInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brass underline underline-offset-2"
                    >
                      <ImageIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                      {t('formChoosePhoto')}
                    </button>
                    <input
                      ref={taskGalleryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleTaskPhotoFile(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={closeTaskForm}
                disabled={formSaving}
                className="flex-1 py-2.5 rounded-full border border-cardBorder text-denim text-sm disabled:opacity-40"
              >
                {t('formCancel')}
              </button>
              <button
                onClick={saveTask}
                disabled={formSaving || !formTaskEn.trim() || !formTaskEs.trim()}
                className="flex-1 py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
              >
                {formSaving ? t('saving') : t('formSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add room modal -- deliberately minimal (name EN/ES + optional
          floor), same shell as the task modal above. There is no edit/
          deactivate UI here yet; this closes the "zero rooms, zero
          assignable tasks" gap, not a full rooms-management screen. */}
      {showAddRoom && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowAddRoom(false)}
        >
          <div
            className="relative w-full max-w-md bg-card rounded-xl3 shadow-card p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PinDot />
            <h2 className="font-display text-[22px] text-denim mb-4">{t('addRoomTitle')}</h2>

            {newRoomError && (
              <p className="mb-3 text-xs text-rust bg-rust/10 rounded-xl2 px-3 py-2">{newRoomError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('roomNameEn')}
                </label>
                <input
                  value={newRoomEn}
                  onChange={(e) => setNewRoomEn(e.target.value)}
                  className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('roomNameEs')}
                </label>
                <input
                  value={newRoomEs}
                  onChange={(e) => setNewRoomEs(e.target.value)}
                  className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-dusk mb-1">
                  {t('roomFloorOptional')}
                </label>
                <input
                  value={newRoomFloor}
                  onChange={(e) => setNewRoomFloor(e.target.value)}
                  placeholder="Main Floor"
                  className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm text-denim"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAddRoom(false)}
                className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim text-sm font-medium"
              >
                {t('formCancel')}
              </button>
              <button
                onClick={saveRoom}
                disabled={newRoomSaving || !newRoomEn.trim() || !newRoomEs.trim()}
                className="flex-1 py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
              >
                {newRoomSaving ? t('saving') : t('formSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {addSupplyTaskId && (
        <AddSupplyModal
          propertyId={propertyId}
          taskId={addSupplyTaskId}
          existingItemIds={(suppliesByTask.get(addSupplyTaskId) ?? [])
            .map((s) => s.item?.id)
            .filter((id): id is string => !!id)}
          onClose={() => setAddSupplyTaskId(null)}
          onSaved={() => {
            setAddSupplyTaskId(null);
            // Refetch just the supplies, not the whole page.
            fetchSuppliesByTask(supabase, tasks.map((x) => x.id)).then(setSuppliesByTask).catch(() => {});
          }}
        />
      )}

      <CameraCapture open={showTaskCamera} onCapture={handleTaskPhotoFile} onClose={() => setShowTaskCamera(false)} />
    </>
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
