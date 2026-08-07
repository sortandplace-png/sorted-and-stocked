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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Days between occurrences. NULL on the Hebrew-calendar and as_needed
   *  rows, which have no fixed interval. Load-bearing for BULK_DAY_MAX_
   *  INTERVAL below -- see there. */
  interval_days: number | null;
};

// --- WHICH TASKS CAN CARRY A WEEKDAY -------------------------------------
// A weekday only means something for work that recurs at least weekly.
// "Descale the kettle, quarterly" on a Tuesday is not a schedule, it is a
// coin flip about which Tuesday.
//
// DERIVED FROM interval_days, NEVER FROM A CODE LIST. Rule 1 at the top of
// this file exists because an earlier spec hardcoded ten frequency labels
// and hid 47 of 141 tasks. A hardcoded exclusion list (monthly, quarterly,
// seasonal, ...) has the same failure mode in reverse: the day 19th
// frequency row is added, nobody updates the array, and it silently
// becomes day-editable. interval_days <= 7 is the actual rule.
//
// NULL interval_days is INELIGIBLE, and that is the correct reading, not a
// null-safety accident: as_needed, pre_pesach, elul, kislev, adar and
// post_sukkos all have no interval, and none of them wants a weekday.
//
// NO COUNT IS KEPT HERE ANY MORE. Two separate snapshots (6 Aug: daily
// 111 + weekly 806 = 922 admitted; 7 Aug, less than an hour later: 153 +
// 526 = 684) both went stale before this comment was next read, because
// Racquel actively reclassifies tasks between frequencies as houses
// change -- that IS the editor's job, not a bug in the count. A hardcoded
// number here is a number someone will "fix" again next week. To see the
// real figure right now:
//   select f.label_en, count(*), count(*) filter (where mt.days_of_week
//     is not null and array_length(mt.days_of_week,1)>0) as dayed
//   from master_tasks mt join frequencies f on f.id=mt.frequency_id
//   where mt.active and f.interval_days::numeric <= 7 group by f.label_en;
// This rule's LOGIC is stable even though the counts it produces never
// are: admit daily/weekly/erev_shabbos (interval_days <= 7), exclude
// everything else, always derived from interval_days, never a list.
const BULK_DAY_MAX_INTERVAL = 7;
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

// DISPLAY covers all seven; the PICKER above covers six. That asymmetry is
// deliberate and necessary, not an oversight repeated: Saturday cannot be
// OFFERED (see the picker's comment), but it is already STORED -- the 111
// daily tasks were set to all seven days, so 6 is live data right now.
// Rendering a stored Saturday as a blank would make a real schedule look
// like an empty one.
// SHORT forms, not the full dayMon/daySun labels the picker uses. A task can
// carry all seven, and seven chips reading "Wednesday" wrap a tile into
// uselessness. The picker keeps the full names -- six buttons have room.
const DAY_LABEL_KEY: Record<number, string> = {
  1: 'dayShortMon',
  2: 'dayShortTue',
  3: 'dayShortWed',
  4: 'dayShortThu',
  5: 'dayShortFri',
  6: 'dayShortSat',
  7: 'dayShortSun',
};
// SS-131 said assignment is to a PERSON; SS-429 (Racquel's ruling, option B)
// widened that: an assignment targets a person (member_id) OR a staff slot
// (slot_id), never both -- the DB check task_assignments_one_target enforces
// it. Assigning to a slot works with zero staff accounts, and whoever is
// later invited into the slot inherits its tasks via is_assigned_to_task(),
// which now matches on either link.
type Member = { id: string; user_id: string; full_name: string | null; property_id: string };
type Slot = { id: string; label_en: string; label_es: string; user_id: string | null; active: boolean; property_id: string };
/** SS-677 item 7, migration 193. Same shape as frequencies, deliberately. */
type WorkSection = { id: string; code: string; label_en: string; label_es: string; sort_order: number };
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
  /** ISO 1..7, migration 191. NULL means every day. Replaces day_of_week. */
  days_of_week: number[] | null;
  work_section_id: string | null;
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
  // SS-677 item 3: THE TOP-LEFT SELECTOR WINS, so this defaults to the
  // property the selector is on, not to 'all'.
  //
  // The defect: the selector read "Lax" while these pills read "All
  // Houses", the room dropdown obeyed the pills, and she was shown 100
  // rooms from every house on a screen whose own header said Lax. Two
  // controls, two answers, and the quieter one was winning.
  //
  // The selector is app-wide context every other page honours; these pills
  // are local to this screen. Local loses.
  const [house, setHouse] = useState<string>(propertyId);

  // "All Houses" is offered ONLY when the selector itself has no single
  // house in context. On the console it always does, so the cross-house
  // pill is not rendered there: it is the control that used to disagree
  // with the selector. Every individual house pill stays, so switching
  // houses on this screen is still one tap.
  const selectorIsCrossHouse = !propertyId;

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
  // SS-677 item 5 and item 7.
  const [duration, setDuration] = useState<'all' | '5' | '15' | '30' | '30plus'>('all');
  const [workSection, setWorkSection] = useState<string>('all');
  const [workSections, setWorkSections] = useState<WorkSection[]>([]);
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
        .select('id, task_number, property_id, room_id, frequency_id, task_en, task_es, job_type, assigned_role, sop_id, source_area_en, source_area_es, photo_url, active, sort_order, day_of_week, days_of_week, work_section_id, time_of_day, estimated_minutes')
        .in('property_id', propertyIds)
        .order('sort_order'),
      supabase.from('frequencies').select('id, code, label_en, label_es, recurrence_kind, sort_order, interval_days').order('sort_order'),
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
      // SS-677 item 7, migration 193. A lookup table rather than a CHECK,
      // so the filter renders label_es without hardcoding Spanish here.
      // APPENDED AT THE END on purpose: rows[] is read positionally
      // (rows[3] members, rows[4] sops, rows[5] assignments, rows[6]
      // slots), so inserting anywhere earlier silently renumbers four
      // other setters.
      supabase.from('work_sections').select('id, code, label_en, label_es, sort_order').order('sort_order'),
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
    setWorkSections(rows[7] as WorkSection[]);
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

  // Colour-codes the frequency badge by CADENCE, derived from
  // interval_days and recurrence_kind -- never from a list of codes, for
  // the same reason rule 1 at the top of this file exists. A new frequency
  // row lands in the right band on its interval alone.
  //
  // The bands are the ones that matter to the person reading a wall of
  // tiles: what happens every day, what happens weekly (the band this
  // editor exists for -- no count kept here, see the WHICH TASKS CAN
  // CARRY A WEEKDAY comment near the top of this file for why), what is
  // on the Hebrew calendar, and what is rare
  // enough that a weekday is meaningless for it -- that last band is
  // exactly the set the day editor refuses, so the colour and the
  // disabled checkbox say the same thing.
  // PALETTE CONSTRAINTS, both real and both easy to trip:
  //   - sage/rust/dairy are the FUNCTIONAL kashrut triple and mean meat,
  //     dairy and pareve. A green "weekly" badge would collide with that
  //     vocabulary on a screen that also renders kitchen tasks.
  //   - R9: brass is never a FILL outside kosher badges. It is used here as
  //     a border only, which is what the token's own comment allows.
  // So the bands are separated by border and ground within the aesthetic
  // palette (denim / denimBlue / mist / dusk), not by hue-coding.
  const freqTone = (f: Frequency | undefined) => {
    if (!f) return 'bg-card border-cardBorder text-dusk';
    if (f.recurrence_kind === 'hebrew') return 'bg-card border-brass text-denim';
    const iv = f.interval_days === null || f.interval_days === undefined ? null : Number(f.interval_days);
    if (iv === null || !Number.isFinite(iv)) return 'bg-card border-cardBorder text-dusk';
    if (iv <= 1) return 'bg-denim/10 border-denim/35 text-denim';
    if (iv <= BULK_DAY_MAX_INTERVAL) return 'bg-mist border-denimBlue/55 text-denim';
    return 'bg-card border-cardBorder text-dusk';
  };

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
  // SS-677 item 6. Reads days_of_week (the ISO 1..7 array from migration
  // 191), not the scalar. Array containment, so a task set to Monday AND
  // Thursday matches both.
  //
  // NO "OR days_of_week IS NULL" FALLBACK, and that is the point of the
  // change. The old predicate had exactly that, so picking Tuesday
  // returned all 1000 tasks and the filter meant nothing while appearing
  // to work. 996 of 1000 tasks have no day; a filter that silently
  // includes them is not a filter. Tasks with no day now simply do not
  // match a specific day, and the empty state says so in words.
  const matchDay = (x: Task) =>
    dayFilter === 'all' || (x.days_of_week ?? []).includes(dayFilter);

  // SS-677 item 5. Duration buckets over estimated_minutes, which covers
  // 810 of 998. NULL is EXCLUDED from a specific bucket and stays visible
  // under All: "I have 15 minutes" cannot honestly include a task nobody
  // has timed. The 188 untimed tasks are a content gap, not a filter
  // behaviour, and hiding that behind a permissive predicate is the same
  // mistake as the day fallback above.
  const matchDuration = (x: Task) => {
    if (duration === 'all') return true;
    const m = x.estimated_minutes;
    if (m === null || m === undefined) return false;
    if (duration === '5') return m <= 5;
    if (duration === '15') return m > 5 && m <= 15;
    if (duration === '30') return m > 15 && m <= 30;
    return m > 30;
  };

  // SS-677 item 7. A different axis from job_type: which part of the
  // house's life the task belongs to, not which trade it is.
  const matchWorkSection = (x: Task) =>
    workSection === 'all' || x.work_section_id === workSection;
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
        .filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && matchJob(x) && matchAssignment(x) && matchDuration(x) && matchWorkSection(x) && matchSearch(x))
        .map((x) => x.frequency_id)
    );
    return frequencies.filter((f) => present.has(f.id));
  }, [scopedTasks, frequencies, dayFilter, floor, room, job, assignment, duration, workSection, search]);

  // SS-677 item 2. DISPLAY ONLY. No room is renamed, here or anywhere.
  //
  // 21 of 100 room names are duplicated: Low and Lax both have a Kitchen, a
  // Master Bedroom and a Whole House, so three quarters of the way down an
  // undifferentiated list there were five "Whole House" entries and no way
  // to tell them apart. Options now read "House • Room" and are grouped by
  // house.
  //
  // The list is already SCOPED, and that is a consequence of the pills now
  // following the selector rather than a second mechanism: this derives
  // from scopedTasks, which is filtered by `house`. On one house you get
  // that house's rooms and nothing else.
  //
  // KNOWN AND OUT OF SCOPE: the same physical room is named differently
  // between houses (Office / Study / Supply; Basement Bath vs Basement Bath
  // 1,2,3; Living Room vs Living Area; Hall Bath vs Bathroom). Not
  // reconciled here, deliberately. Showing the house is what makes them
  // pickable; making them identical is a content decision.
  const roomOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchDuration(x) && matchWorkSection(x) && matchSearch(x));
    const ids = new Set(pool.map((x) => x.room_id));
    const list = rooms.filter((r) => ids.has(r.id));

    // Grouped by house, houses alphabetical, rooms alphabetical inside each
    // (locale-aware: accented room names must collate for the reader).
    const byHouse = new Map<string, { houseLabel: string; rooms: Room[] }>();
    for (const r of list) {
      const houseLabel = labelByProperty.get(r.property_id) ?? '';
      const entry = byHouse.get(r.property_id);
      if (entry) entry.rooms.push(r);
      else byHouse.set(r.property_id, { houseLabel, rooms: [r] });
    }
    const groups = [...byHouse.values()]
      .map((g) => ({
        ...g,
        rooms: [...g.rooms].sort((a, b) =>
          (es ? a.name_es || a.name_en : a.name_en).localeCompare(
            es ? b.name_es || b.name_en : b.name_en,
            locale
          )
        ),
      }))
      .sort((a, b) => a.houseLabel.localeCompare(b.houseLabel, locale));

    return { hasNull: ids.has(null), list, groups };
  }, [scopedTasks, rooms, dayFilter, floor, job, freq, assignment, duration, workSection, search, passesFrequency, labelByProperty, es, locale]);

  const jobOptions = useMemo(() => {
    const pool = scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && passesFrequency(x) && matchAssignment(x) && matchDuration(x) && matchWorkSection(x) && matchSearch(x));
    return [...new Set(pool.map((x) => x.job_type).filter(Boolean))].sort() as string[];
  }, [scopedTasks, dayFilter, floor, room, freq, assignment, duration, workSection, search, passesFrequency]);

  const filtered = useMemo(
    () => scopedTasks.filter((x) => matchDay(x) && matchFloor(x) && matchRoom(x) && matchJob(x) && passesFrequency(x) && matchAssignment(x) && matchDuration(x) && matchWorkSection(x) && matchSearch(x)),
    [scopedTasks, dayFilter, floor, room, job, freq, assignment, duration, workSection, search, passesFrequency]
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
  // SS-672 sibling ticket, 5 Aug: SLOTS FIRST, and returned as two named
  // groups rather than one flat list, so the control reads slot-first
  // instead of burying four positions under a list of people.
  //
  // A slot is now the default target. It works with zero staff accounts,
  // and whoever is later linked into the slot inherits every task on it
  // through the assign_read policy that already resolves slot_id to a
  // user -- a path that is live and has never been exercised. Person
  // assignment stays reachable in its own group: the existing member_id
  // rows are still valid and still editable, and nothing migrates.
  const assignTargetsForProperty = useCallback(
    (pid: string) => ({
      // `slots` arrives ordered by sort_order from the query and filter
      // preserves that order, so the four positions read 1, 2, 3, 4.
      slots: slots
        .filter((s) => s.property_id === pid && s.active)
        .map((s) => ({
          id: `${SLOT_PREFIX}${s.id}`,
          label: locale === 'es' ? s.label_es || s.label_en : s.label_en,
        })),
      members: members
        .filter((m) => m.property_id === pid)
        .map((m) => ({ id: `${MEMBER_PREFIX}${m.id}`, label: m.full_name ?? t('unnamedMember') })),
    }),
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

  // HOUSE TOTALS, NOT FILTERED TOTALS. This REVERSES the earlier decision
  // recorded here, which derived the tiles from `filtered` so they answered
  // "of what I am looking at right now".
  //
  // Why it was wrong: with Low selected and the day filter on Wednesday the
  // tiles read Total Tasks 0, while Low holds 260. A tile showing 0 next to
  // a list showing nothing tells you nothing twice. The tiles are the
  // REFERENCE POINT you read the filtered list against, so they have to
  // stay still while the list moves. That is the whole job of a stat card,
  // and it is why 0 was not a display bug so much as the tiles having been
  // given the list's job.
  //
  // Derived from `scopedTasks`: the house scope and the show-retired view
  // mode apply, every filter pill does not. Those two are not filters, they
  // are which set of tasks this screen is about; day, room, job, frequency,
  // assignment, duration, work section and search are.
  //
  // SS-517 note on "Total" still stands: this counts the properties this
  // page is mounted for, so QA Demo's rows are deliberately absent and a
  // global count will read slightly higher.
  const stats = useMemo(
    () => ({
      total: scopedTasks.length,
      unassigned: scopedTasks.filter(isUnassigned).length,
      // SS-517: count the sop_id FK on the task, not the sopCounts join
      // map -- the join (master_task_sops) links only 160 tasks while 642
      // carry sop_id, and Racquel's chat-side resolution ruled sop_id IS
      // the definition of "has a procedure".
      withSop: scopedTasks.filter((x) => x.sop_id !== null).length,
      roomsMissing: scopedTasks.filter(
        (x) => x.room_id === null && !NON_ROOM_JOB_TYPES.includes(x.job_type ?? '')
      ).length,
    }),
    // assignmentByTask (memoized), not isUnassigned (recreated per render):
    // the closure the unassigned count actually varies with.
    [scopedTasks, assignmentByTask]
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
  //
  // SS-677: duration and workSection join the set. A filter that Clear
  // does not clear is worse than no Clear button, because the screen
  // stays filtered while claiming to have been reset. dayFilter stays
  // OUT, matching its existing treatment: it has its own empty state now
  // (item 6) whose whole job is to explain that no tasks carry a day, and
  // clearing it would hide that the moment it appeared.
  const filtersActive =
    search.trim() !== '' ||
    room !== 'all' ||
    job !== 'all' ||
    freq !== 'all' ||
    assignment !== 'all' ||
    duration !== 'all' ||
    workSection !== 'all';

  function clearFilters() {
    setSearch('');
    setRoom('all');
    setJob('all');
    setFreq('all');
    setAssignment('all');
    setDuration('all');
    setWorkSection('all');
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

  // BULK ASSIGN AT THE ROOM HEADER. This is the point of the ticket.
  //
  // 930 active master_tasks, 852 of them with no active assignment. At one
  // select per tile that is 852 interactions, which is not a workflow, and
  // no amount of list-view polish changes the arithmetic. Selecting a slot
  // on a room header puts every task under that header on it.
  //
  // TWO REQUESTS, NOT N. One UPDATE closes out whatever those tasks
  // currently carry, one INSERT opens the new rows as a single array. Both
  // are constant in the number of tasks: assigning a 60 task room costs
  // the same two round trips as assigning a 2 task room. The acceptance
  // criterion is "one room header assign produces one write, not N", and N
  // here is the row count inside those two statements, never the request
  // count.
  //
  // Deliberately NOT an upsert: task_assignments has no unique key on
  // task_id (a task can carry closed historical rows), so the close-then-
  // open shape is what keeps history intact. task_assignments_one_target
  // only constrains ACTIVE rows, so the closed ones stay legal.
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  async function assignSection(sectionLabel: string, items: Task[], target: string) {
    if (items.length === 0) return;

    // Every section is single-house by construction (houseLabel is part of
    // the grouping key), but the write is scoped to one property anyway:
    // a slot belongs to exactly one property and the FK would reject a
    // cross-house row on the last task in the list, after the others had
    // already been written.
    const pid = items[0].property_id;
    const scoped = items.filter((x) => x.property_id === pid);
    const taskIds = scoped.map((x) => x.id);

    setBulkBusy(sectionLabel);
    const today = new Date().toISOString().slice(0, 10);

    const { error: closeError } = await supabase
      .from('task_assignments')
      .update({ active: false, effective_to: today })
      .in('task_id', taskIds)
      .eq('active', true);

    if (closeError) {
      setBulkBusy(null);
      setLoadError(t('saveFailed'));
      return;
    }

    // Empty selection is "clear this room": the old rows are closed above
    // and nothing new opens.
    if (!target) {
      setAssignments((prev) => prev.filter((a) => !taskIds.includes(a.task_id)));
      setBulkBusy(null);
      return;
    }

    const isSlot = target.startsWith(SLOT_PREFIX);
    const targetId = isSlot ? target.slice(SLOT_PREFIX.length) : target.slice(MEMBER_PREFIX.length);
    const rows = taskIds.map((task_id) => ({
      task_id,
      member_id: isSlot ? null : targetId,
      slot_id: isSlot ? targetId : null,
    }));

    const { data, error } = await supabase
      .from('task_assignments')
      .insert(rows)
      .select('id, task_id, member_id, slot_id');

    setBulkBusy(null);

    if (error || !data) {
      setLoadError(t('saveFailed'));
      load(); // never leave the screen claiming a save that failed
      return;
    }

    setAssignments((prev) => [
      ...prev.filter((a) => !taskIds.includes(a.task_id)),
      ...(data as Assignment[]),
    ]);
  }

  // --- BULK EDITOR: ONE SELECTION, DAYS AND STAFF -------------------------
  // SS-772. Built 6 Aug against several hundred weekly tasks with no
  // weekday and roughly a thousand with no assignment. NO COUNT IS KEPT
  // HERE -- the no-weekday figure alone was corrected twice in the first
  // 24 hours (Racquel actively reclassifies tasks between frequencies;
  // that reclassifying IS the ongoing use of this editor, not a one-time
  // cleanup that finishes), and a third stale number is not worth writing
  // down. Query master_tasks/frequencies directly for the current split;
  // see the WHICH TASKS CAN CARRY A WEEKDAY comment near the top of this
  // file for the exact query. Both counts were the same interaction
  // problem either way -- a per-tile control
  // is fine for correcting one row and useless for populating a house -- so
  // they share one selection rather than being two features that each
  // require their own pass over the same tiles.
  //
  // THREE REQUESTS MAXIMUM, whatever the selection size: one UPDATE for the
  // days, then the close-then-open pair for the assignment, exactly the
  // shape assignSection already proved. Selecting hundreds of tasks costs
  // the same round trips as selecting two.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDays, setBulkDays] = useState<Set<number>>(new Set());
  // Days are TRI-STATE and that is not over-engineering. With a plain "set
  // of days" an empty set is ambiguous between "leave them alone" and
  // "clear them", and those differ across hundreds of rows. 'skip' is the
  // default so that an Apply aimed only at staff cannot silently wipe a
  // schedule.
  const [daysMode, setDaysMode] = useState<'skip' | 'set' | 'clear'>('skip');
  // '' means LEAVE THE ASSIGNEE ALONE. Unassigning is the explicit sentinel
  // below. This is deliberately NOT assignSection's convention, where ''
  // means unassign -- there '' is a one-shot action on a room, here the
  // control persists across an Apply that may be about days only.
  const CLEAR_ASSIGNEE = '__clear__';
  const [bulkTarget, setBulkTarget] = useState<string>('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [view, setView] = useState<'tiles' | 'table'>('tiles');
  // Only one overflow menu is ever open, so this is an id and not a set.
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);

  // interval_days arrives from PostgREST as a string on a numeric column,
  // so "30" < 7 would be false but "30" <= 7 is a string compare waiting to
  // happen. Coerced once, here.
  const isDayEligible = useCallback(
    (x: Task) => {
      const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
      if (!f || f.interval_days === null || f.interval_days === undefined) return false;
      const iv = Number(f.interval_days);
      return Number.isFinite(iv) && iv <= BULK_DAY_MAX_INTERVAL;
    },
    [freqById]
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // DERIVED FROM `filtered`, NOT FROM `selected` ALONE. A task that is
  // selected and then filtered out of view must not be written to: the
  // count on the Apply button is the promise, and a hidden row changing
  // would break it. Intersecting here makes the count and the write the
  // same set by construction rather than by remembering to prune.
  const selectedTasks = useMemo(() => filtered.filter((x) => selected.has(x.id)), [filtered, selected]);
  const selectedDayEligible = useMemo(() => selectedTasks.filter(isDayEligible), [selectedTasks, isDayEligible]);
  const dayExcludedCount = selectedTasks.length - selectedDayEligible.length;

  // A slot or member belongs to exactly one property, so a cross-house
  // selection has no single valid assignee. Days have no such constraint.
  const selectionProperties = useMemo(
    () => new Set(selectedTasks.map((x) => x.property_id)),
    [selectedTasks]
  );
  const canAssignSelection = selectionProperties.size === 1;

  function toggleBulkDay(iso: number) {
    setDaysMode('set');
    setBulkDays((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkDays(new Set());
    setDaysMode('skip');
    setBulkTarget('');
    setApplyNote(null);
  }

  async function applyBulk() {
    if (selectedTasks.length === 0 || applyBusy) return;
    // 'set' with nothing ticked would write an empty array, which
    // master_tasks_days_of_week_check rejects outright (migration 191:
    // NULL or cardinality > 0). Clearing is the explicit Clear control.
    const writingDays = daysMode === 'clear' || (daysMode === 'set' && bulkDays.size > 0);
    const writingStaff = bulkTarget !== '';
    if (!writingDays && !writingStaff) return;

    setApplyBusy(true);
    setApplyNote(null);
    const previousTasks = tasks;

    if (writingDays && selectedDayEligible.length > 0) {
      const ids = selectedDayEligible.map((x) => x.id);
      // NULL, never '{}'. One state, one encoding -- the row itself is
      // untouched, which is what "never delete" asks for here.
      const value = daysMode === 'clear' ? null : [...bulkDays].sort((a, b) => a - b);
      setTasks((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, days_of_week: value } : x)));
      const { error } = await supabase.from('master_tasks').update({ days_of_week: value }).in('id', ids);
      if (error) {
        setTasks(previousTasks);
        setApplyBusy(false);
        setLoadError(t('saveFailed'));
        return;
      }
    }

    if (writingStaff && canAssignSelection) {
      const ids = selectedTasks.map((x) => x.id);
      const today = new Date().toISOString().slice(0, 10);
      const { error: closeError } = await supabase
        .from('task_assignments')
        .update({ active: false, effective_to: today })
        .in('task_id', ids)
        .eq('active', true);
      if (closeError) {
        setApplyBusy(false);
        setLoadError(t('saveFailed'));
        load();
        return;
      }

      if (bulkTarget === CLEAR_ASSIGNEE) {
        setAssignments((prev) => prev.filter((a) => !ids.includes(a.task_id)));
      } else {
        const isSlot = bulkTarget.startsWith(SLOT_PREFIX);
        const targetId = isSlot ? bulkTarget.slice(SLOT_PREFIX.length) : bulkTarget.slice(MEMBER_PREFIX.length);
        const rows = ids.map((task_id) => ({
          task_id,
          member_id: isSlot ? null : targetId,
          slot_id: isSlot ? targetId : null,
        }));
        const { data, error } = await supabase
          .from('task_assignments')
          .insert(rows)
          .select('id, task_id, member_id, slot_id');
        if (error || !data) {
          setApplyBusy(false);
          setLoadError(t('saveFailed'));
          load();
          return;
        }
        setAssignments((prev) => [...prev.filter((a) => !ids.includes(a.task_id)), ...(data as Assignment[])]);
      }
    }

    setApplyBusy(false);
    setApplyNote(
      t('bulkApplied', {
        days: writingDays ? selectedDayEligible.length : 0,
        staff: writingStaff && canAssignSelection ? selectedTasks.length : 0,
      })
    );
    clearSelection();
  }

  // Edit / Retire / Add Supply, collapsed behind one control. On a tile
  // these were three competing underlined links in the same row as the SOP
  // count and the scoping warning; at four-across they wrapped. Retire in
  // particular is destructive-shaped and sat one pixel from Edit.
  //
  // Retire keeps its confirm INSIDE the menu item rather than becoming a
  // quiet menu row: burying it made it easier to reach, not safer, and the
  // confirm is the only thing standing between a click and a tile leaving
  // the view someone is looking at.
  function TaskOverflowMenu({
    task: x,
    open,
    onToggle,
  }: {
    task: Task;
    open: boolean;
    onToggle: () => void;
  }) {
    const canAddSupply = x.active && inventoryEnabled && (inventoryItemCount ?? 0) > 0;
    return (
      <span className="relative inline-block">
        <button
          onClick={onToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('moreActions')}
          className="rounded-full px-1.5 py-0.5 text-[13px] leading-none text-dusk hover:text-denim hover:bg-mist"
        >
          &#8943;
        </button>
        {open && (
          <span
            role="menu"
            className="absolute right-0 top-full z-40 mt-1 min-w-[150px] rounded-xl bg-card border border-cardBorder shadow-card py-1 flex flex-col text-left"
          >
            {x.active && (
              <button
                role="menuitem"
                onClick={() => {
                  onToggle();
                  openEditTask(x);
                }}
                className="px-3 py-1.5 text-[11px] text-denim hover:bg-mist text-left"
              >
                {t('editTask')}
              </button>
            )}
            {canAddSupply && (
              <button
                role="menuitem"
                onClick={() => {
                  onToggle();
                  setAddSupplyTaskId(x.id);
                }}
                className="px-3 py-1.5 text-[11px] text-denim hover:bg-mist text-left"
              >
                {tSupplies('addSupply')}
              </button>
            )}
            {!x.active && (
              <button
                role="menuitem"
                onClick={() => {
                  onToggle();
                  reactivateTask(x.id);
                }}
                className="px-3 py-1.5 text-[11px] text-denim hover:bg-mist text-left"
              >
                {t('reactivate')}
              </button>
            )}
            {x.active && (
              <button
                role="menuitem"
                onClick={() => {
                  onToggle();
                  if (confirm(t('confirmRetire', { name: es ? x.task_es : x.task_en }))) retireTask(x.id);
                }}
                className="px-3 py-1.5 text-[11px] text-dusk hover:bg-mist hover:text-rust text-left"
              >
                {t('retireTask')}
              </button>
            )}
          </span>
        )}
      </span>
    );
  }

  // (The flat cross-property assignee list was replaced by
  // assignTargetsForProperty above -- SS-436 scopes every tile's options to
  // the task's own house. R17 and the SS-429 B slot rules carry over.)

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
          {/* SS-677 item 3: rendered only when the selector is itself
              cross-house. See selectorIsCrossHouse above. */}
          {selectorIsCrossHouse && (
            <button
              onClick={() => setHouse('all')}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                house === 'all' ? 'bg-denim text-white' : 'text-dusk'
              }`}
            >
              {t('allHouses')}
            </button>
          )}
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
          {/* SS-677 item 2. Grouped by house, and each option still carries
              its own house prefix: an optgroup label alone is not enough,
              because the CLOSED select shows only the chosen option, and
              "Whole House" on its own is exactly the ambiguity being
              fixed. Skipped when a single house is in view, where the
              prefix would repeat on every line and say nothing. */}
          {roomOptions.groups.map((g) => {
            const options = g.rooms.map((r) => {
              const name = (es ? r.name_es || r.name_en : r.name_en) || '';
              return (
                <option key={r.id} value={r.id}>
                  {roomOptions.groups.length > 1 && g.houseLabel
                    ? `${g.houseLabel} • ${name}`
                    : name}
                </option>
              );
            });
            return roomOptions.groups.length > 1 && g.houseLabel ? (
              <optgroup key={g.houseLabel} label={g.houseLabel}>
                {options}
              </optgroup>
            ) : (
              <Fragment key={g.houseLabel || 'single'}>{options}</Fragment>
            );
          })}
        </select>
        {/* SS-677 item 5. "I have 15 minutes." Buckets match the live
            spread: 199 tasks at 5 or under, 447 at 6 to 15, 29 at 16 to
            30, 38 above 30. */}
        <select
          className={pill}
          value={duration}
          onChange={(e) => setDuration(e.target.value as typeof duration)}
          aria-label={t('filterDuration')}
        >
          <option value="all">{t('allDurations')}</option>
          <option value="5">{t('duration5')}</option>
          <option value="15">{t('duration15')}</option>
          <option value="30">{t('duration30')}</option>
          <option value="30plus">{t('duration30plus')}</option>
        </select>
        {/* SS-677 item 7. Which part of the house's life, not which trade.
            Rendered from the work_sections table so the Spanish label
            comes from the row, never from a hardcoded map here. */}
        {workSections.length > 0 && (
          <select
            className={pill}
            value={workSection}
            onChange={(e) => setWorkSection(e.target.value)}
            aria-label={t('filterWorkSection')}
          >
            <option value="all">{t('allWorkSections')}</option>
            {workSections.map((w) => (
              <option key={w.id} value={w.id}>
                {es ? w.label_es : w.label_en}
              </option>
            ))}
          </select>
        )}
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
        <div className="bg-denim py-[11px] px-5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white">
            {t('stripSummary', {
              count: filtered.length,
              scope: freq === 'all' ? t('allFrequencies') : freqLabel(frequencies.find((f) => f.id === freq)),
            })}
          </span>
          {/* Tiles stay the default. The table is for the bulk pass: hundreds
              of weekly rows read as a wall of tiles, and the job here is
              scanning a room's worth of names, not looking at photos. */}
          <span className="shrink-0 flex items-center gap-1 rounded-full bg-white/10 border border-white/25 p-0.5">
            {(['tiles', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors ${
                  view === v ? 'bg-white text-denim' : 'text-white/80 hover:text-white'
                }`}
              >
                {t(v === 'tiles' ? 'viewTiles' : 'viewTable')}
              </button>
            ))}
          </span>
        </div>

        {/* --- THE BULK BAR ------------------------------------------------
            Sticky, because the selection is built by scrolling and a control
            that scrolls away with it is a control you cannot reach when you
            have finished choosing.

            SHOWS THE COUNT BEFORE IT WRITES, and shows it split: the day
            write and the staff write do not cover the same rows whenever a
            selection includes anything longer than weekly. One number would
            have to be wrong about one of them. */}
        {selectedTasks.length > 0 && (
          <div className="sticky top-0 z-30 bg-mist border-y border-denimBlue/40 px-5 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-denim">
                {t('bulkSelected', { count: selectedTasks.length })}
              </span>
              <button
                onClick={clearSelection}
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-dusk underline-offset-2 hover:underline"
              >
                {t('bulkClearSelection')}
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-dusk mr-1">
                {t('bulkDaysLabel')}
              </span>
              {/* DAY_PICKER_OPTIONS, not a fresh seven-day list: Saturday is
                  deliberately absent from it (see the constant). Flagged to
                  Racquel rather than silently reintroduced here. */}
              {DAY_PICKER_OPTIONS.map(({ iso, key }) => {
                const on = daysMode === 'set' && bulkDays.has(iso);
                return (
                  <button
                    key={iso}
                    onClick={() => toggleBulkDay(iso)}
                    aria-pressed={on}
                    disabled={selectedDayEligible.length === 0}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-40 ${
                      on ? 'bg-denim border-denim text-white' : 'bg-card border-cardBorder text-denim hover:border-denimBlue'
                    }`}
                  >
                    {t(key)}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  setDaysMode('clear');
                  setBulkDays(new Set());
                }}
                aria-pressed={daysMode === 'clear'}
                disabled={selectedDayEligible.length === 0}
                className={`ml-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] disabled:opacity-40 ${
                  daysMode === 'clear' ? 'bg-denim border-denim text-white' : 'bg-card border-cardBorder text-dusk hover:border-denimBlue'
                }`}
              >
                {t('bulkClearDays')}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-dusk">
                {t('bulkStaffLabel')}
              </span>
              {(() => {
                const targets = canAssignSelection
                  ? assignTargetsForProperty(selectedTasks[0].property_id)
                  : { slots: [], members: [] };
                return (
                  <select
                    value={bulkTarget}
                    disabled={!canAssignSelection}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    aria-label={t('bulkStaffLabel')}
                    className="rounded-full bg-card border border-cardBorder px-3 py-1 text-[11px] text-denim disabled:opacity-40"
                  >
                    <option value="">{t('bulkStaffNoChange')}</option>
                    <option value={CLEAR_ASSIGNEE}>{t('bulkStaffUnassign')}</option>
                    {targets.slots.length > 0 && (
                      <optgroup label={t('positionsGroup')}>
                        {targets.slots.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {targets.members.length > 0 && (
                      <optgroup label={t('peopleGroup')}>
                        {targets.members.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                );
              })()}
              {!canAssignSelection && (
                <span className="text-[10px] text-dusk">{t('bulkCrossHouse')}</span>
              )}
            </div>

            {/* The promise on the button, stated in rows. dayExcludedCount is
                shown whenever it is non-zero rather than only on hover: a
                selection of 40 that writes days to 31 is not a detail. */}
            <div className="flex items-center gap-3 flex-wrap pt-0.5">
              <button
                onClick={applyBulk}
                disabled={
                  applyBusy ||
                  (!(daysMode === 'clear' || (daysMode === 'set' && bulkDays.size > 0)) && bulkTarget === '')
                }
                className="bg-denim text-white text-[12px] font-semibold rounded-full px-4 py-2 shadow-card disabled:opacity-40"
              >
                {applyBusy ? t('bulkApplying') : t('bulkApply')}
              </button>
              <span className="text-[11px] text-dusk">
                {t('bulkWillChange', {
                  days:
                    daysMode === 'clear' || (daysMode === 'set' && bulkDays.size > 0)
                      ? selectedDayEligible.length
                      : 0,
                  staff: bulkTarget !== '' && canAssignSelection ? selectedTasks.length : 0,
                })}
              </span>
              {dayExcludedCount > 0 && (
                <span className="text-[11px] text-dusk border border-cardBorder rounded-full px-2.5 py-1">
                  {t('bulkDayExcluded', { count: dayExcludedCount })}
                </span>
              )}
            </div>
          </div>
        )}

        {applyNote && (
          <p className="px-5 pt-3 text-[11px] text-denim">{applyNote}</p>
        )}

        <div className="p-5">
          {loading ? (
            <p className="text-center py-14 text-[13px] text-dusk">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              {/* Two distinct empty states, never one. Country has 0 tasks and
                  will hit the second on day one -- it must read as intentional.
                  SS-677 item 6 adds a THIRD, and it is the honest one: when a
                  day is selected and nothing matches, say why. 996 of 1000
                  tasks have no day set. The two rejected alternatives were
                  hiding the filter, which conceals that fact, and adding an
                  "OR no day set" fallback, which returns everything so the
                  filter silently means nothing. */}
              <p className="font-display text-[18px] text-denim">
                {dayFilter !== 'all'
                  ? t('emptyNoDayForHouse')
                  : filtersActive
                    ? t('emptyFiltered')
                    : t('emptyNoDuties')}
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
                    {/* The strip is no longer a single <button>: it now
                        carries the bulk assign control, and a <select>
                        inside a <button> is invalid HTML that browsers
                        resolve by breaking one of the two. So the toggle is
                        an inner button that owns the label and the count,
                        and the select is its sibling. Tapping the strip
                        still collapses the section, which is the Shopping
                        List pattern D-21 asks for. */}
                    <div className="sticky top-0 z-20 relative w-full flex items-stretch gap-2 bg-denim rounded-xl2 pl-4 pr-8 mb-[14px]">
                      {/* Select-all for the room. The whole point of the
                          room grouping is that a room is the unit someone
                          actually decides about ("the Kitchen's weeklies are
                          Tuesday"), so selecting one is one tap, not N. */}
                      {(() => {
                        const ids = section.items.map((i) => i.id);
                        const allOn = ids.every((id) => selected.has(id));
                        return (
                          <label className="self-center shrink-0 flex items-center cursor-pointer pr-1">
                            <input
                              type="checkbox"
                              checked={allOn}
                              onChange={() =>
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (allOn) ids.forEach((id) => next.delete(id));
                                  else ids.forEach((id) => next.add(id));
                                  return next;
                                })
                              }
                              aria-label={t('selectRoom', { room: section.roomLabel })}
                              className="h-4 w-4 accent-white cursor-pointer"
                            />
                          </label>
                        );
                      })()}
                      <button
                        onClick={() => toggleSection(section.label)}
                        aria-expanded={!sectionCollapsed}
                        className="flex-1 min-w-0 flex items-center justify-between gap-3 py-[11px] text-left"
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
                      </button>

                      {/* Assigns every task under this header in one go.
                          Value is always '' so it reads as an action rather
                          than as the room's current state: the tasks below
                          can be on four different targets and no single
                          value would be honest about that. */}
                      {(() => {
                        const targets = assignTargetsForProperty(section.items[0].property_id);
                        const busy = bulkBusy === section.label;
                        return (
                          <select
                            value=""
                            disabled={busy}
                            onChange={(e) => assignSection(section.label, section.items, e.target.value)}
                            aria-label={t('assignWholeRoom', { room: section.roomLabel })}
                            className="self-center shrink-0 appearance-none bg-white/10 border border-white/25 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-white disabled:opacity-50"
                          >
                            <option value="" disabled>
                              {busy ? t('assigningRoom') : t('assignRoom')}
                            </option>
                            {targets.slots.length > 0 && (
                              <optgroup label={t('positionsGroup')}>
                                {targets.slots.map((a) => (
                                  <option key={a.id} value={a.id} className="text-denim">
                                    {a.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {targets.members.length > 0 && (
                              <optgroup label={t('peopleGroup')}>
                                {targets.members.map((a) => (
                                  <option key={a.id} value={a.id} className="text-denim">
                                    {a.label}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        );
                      })()}
                      <PinDot />
                    </div>

                    {/* COMPACT TABLE. Same data, same actions, one row per
                        task -- for the pass where you are reading forty task
                        names in a room and deciding which are Tuesday.
                        Scrolls inside its own container so a long task name
                        cannot make the whole page scroll sideways. */}
                    {!sectionCollapsed && view === 'table' && (
                      <div className="overflow-x-auto -mx-1 px-1">
                        <table className="w-full min-w-[560px] border-collapse">
                          <thead>
                            <tr className="text-left">
                              <th className="w-8 pb-2" />
                              <th className="pb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                                {t('colTask')}
                              </th>
                              <th className="pb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                                {t('colFrequency')}
                              </th>
                              <th className="pb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                                {t('colDays')}
                              </th>
                              <th className="pb-2 text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                                {t('colAssignee')}
                              </th>
                              <th className="w-8 pb-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((x) => {
                              const f = x.frequency_id ? freqById.get(x.frequency_id) : undefined;
                              const on = selected.has(x.id);
                              const eligible = isDayEligible(x);
                              const days = x.days_of_week ?? [];
                              return (
                                <tr
                                  key={x.id}
                                  className={`border-t border-cardBorder ${on ? 'bg-mist' : ''}`}
                                >
                                  <td className="py-2 align-middle">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleSelected(x.id)}
                                      aria-label={es ? x.task_es : x.task_en}
                                      className="h-4 w-4 accent-denim cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2 pr-3 align-middle">
                                    <span className="block text-[13px] text-denim leading-snug">
                                      {es ? x.task_es : x.task_en}
                                    </span>
                                    {!x.active && (
                                      <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                                        {t('retiredBadge')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 align-middle">
                                    <span
                                      className={`inline-block whitespace-nowrap text-[8px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-full ${freqTone(f)}`}
                                    >
                                      {freqLabel(f)}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-3 align-middle">
                                    {/* An ineligible row says so, rather than
                                        showing an empty cell that reads as
                                        "nobody has got to this one yet". */}
                                    {!eligible ? (
                                      <span className="text-[10px] text-dusk">{t('daysNotApplicable')}</span>
                                    ) : days.length === 0 ? (
                                      <span className="text-[10px] text-dusk">{t('daysEveryDay')}</span>
                                    ) : (
                                      <span className="flex flex-wrap gap-1">
                                        {days.map((d) => (
                                          <span
                                            key={d}
                                            className="text-[9px] font-semibold uppercase tracking-[0.1em] bg-mist border border-denimBlue/40 text-denim rounded-full px-1.5 py-0.5"
                                          >
                                            {DAY_LABEL_KEY[d] ? t(DAY_LABEL_KEY[d]) : d}
                                          </span>
                                        ))}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 align-middle">
                                    <span className="text-[11px] text-denim">
                                      {assigneeDisplay(assignmentByTask.get(x.id)) || t('unassigned')}
                                    </span>
                                  </td>
                                  <td className="py-2 align-middle">
                                    <TaskOverflowMenu
                                      task={x}
                                      open={menuTaskId === x.id}
                                      onToggle={() => setMenuTaskId(menuTaskId === x.id ? null : x.id)}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!sectionCollapsed && view === 'tiles' && (
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
                          {/* Same selection as the table's, same Set -- a
                              tile ticked here is still ticked after the view
                              toggle, because neither view owns the state. */}
                          <input
                            type="checkbox"
                            checked={selected.has(x.id)}
                            onChange={() => toggleSelected(x.id)}
                            aria-label={es ? x.task_es : x.task_en}
                            className="shrink-0 h-4 w-4 accent-denim cursor-pointer mr-0.5"
                          />
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
                        <span className="shrink-0 flex items-center gap-1">
                          <span
                            className={`text-[8px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-full ${freqTone(f)}`}
                          >
                            {freqLabel(f)}
                          </span>
                          <TaskOverflowMenu
                            task={x}
                            open={menuTaskId === x.id}
                            onToggle={() => setMenuTaskId(menuTaskId === x.id ? null : x.id)}
                          />
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
                                from the same screen that hid it -- it now
                                lives in this tile's overflow menu, one tap
                                away, rather than as a bare link here. */}
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
                        {/* Edit, Retire and Add Supply now live in the tile's
                            overflow menu (top right, beside the frequency
                            badge). They were four underlined links competing
                            with the SOP count and the scoping warning in this
                            one row, and at four-across they wrapped.

                            WHAT REPLACES THEM HERE IS THE SCHEDULE, which is
                            what this screen is now for: a tile has to show
                            what day it carries or the bulk pass is blind in
                            tile view. */}
                        {isDayEligible(x) ? (
                          (x.days_of_week ?? []).length > 0 ? (
                            (x.days_of_week ?? []).map((d) => (
                              <span
                                key={d}
                                className="text-[9px] font-semibold uppercase tracking-[0.1em] bg-mist border border-denimBlue/40 text-denim rounded-full px-1.5 py-0.5"
                              >
                                {DAY_LABEL_KEY[d] ? t(DAY_LABEL_KEY[d]) : d}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-dusk">
                              {t('daysEveryDay')}
                            </span>
                          )
                        ) : null}
                        {/* Offered only when a supply could actually be
                            created. A supply is a join to an inventory row,
                            so with the module off there is nothing to join
                            to that this property can display, and with zero
                            items there is nothing to pick -- in both cases
                            the button led to a dead end that explained
                            nothing. The reason is stated below instead. */}
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
                        {/* Positions before people, in their own groups.
                            Slot is the default target now; person
                            assignment stays one scroll away rather than
                            being removed. */}
                        {(() => {
                          const targets = assignTargetsForProperty(x.property_id);
                          return (
                            <>
                              {targets.slots.length > 0 && (
                                <optgroup label={t('positionsGroup')}>
                                  {targets.slots.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {targets.members.length > 0 && (
                                <optgroup label={t('peopleGroup')}>
                                  {targets.members.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.label}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
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
