// components/MyDayClient.tsx
// Staff's dedicated landing page — built around what staff are actually
// permitted to do (view inventory/recipes/meal plans/shopping lists,
// update quantities, check off shopping list items, update their own task
// status). Owner/manager keep landing on the existing property-picker flow
// unchanged; only staff get routed here (see app/properties/page.tsx and
// app/dashboard/page.tsx).
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import ShiftHandoverClient from '@/components/ShiftHandoverClient';
import StaffDutyChecklist from '@/components/StaffDutyChecklist';
import ToolModal from '@/components/ToolModal';
import KitchenOpsToolModal from '@/components/KitchenOpsToolModal';
import { Camera, ShoppingCart, Timer, Info } from 'lucide-react';

type Status = 'open' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  status: Status;
  priority: Priority | null;
  category: string | null;
};

type DutyTask = { id: string; taskEn: string; taskEs: string; completed: boolean };
type DutyArea = { areaEn: string; areaEs: string; tasks: DutyTask[] };

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-rust/10 text-rust',
  medium: 'bg-brass/15 text-brass',
  low: 'bg-sage/10 text-sage',
};

export default function MyDayClient({
  propertyId,
  staffNote,
  isStaff,
  hasRosterKey,
  dutyAreas,
  todayStr,
}: {
  propertyId: string;
  staffNote: string | null;
  isStaff: boolean;
  hasRosterKey: boolean;
  dutyAreas: DutyArea[];
  todayStr: string;
}) {
  const t = useTranslations('myDay');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCapture, setShowCapture] = useState(false);
  const [showKitchenTimer, setShowKitchenTimer] = useState(false);
  const supabase = createClient();
  const showToast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // staff_tasks.assigned_to is a FK to property_members(id), not
    // auth.uid() directly (same real gotcha as the RLS/trigger work) —
    // resolve this user's own membership row first.
    const { data: membership } = await supabase
      .from('property_members')
      .select('id')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('staff_tasks')
      .select('id, title, due_date, status, priority, category')
      .eq('property_id', propertyId)
      .eq('assigned_to', membership.id)
      .neq('status', 'done')
      .lte('due_date', today)
      .order('due_date', { ascending: true });

    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(task: Task, status: Status) {
    const result = await resilientUpdate(supabase, 'staff_tasks', { id: task.id }, { status });
    if (!result.ok) {
      showToast('Failed to update.', { variant: 'error' });
      return;
    }
    // RLS/trigger only lets a staff member touch their own assigned task's
    // status, so a done task simply drops out of this list on next load.
    if (status === 'done') {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">My Day</h1>
      <p className="text-sm text-dusk mb-4">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {/* Calendar-driven staff notice -- plain, high-contrast, instructional
          copy for people who may not know the Jewish calendar at all, not a
          reflection/spiritual note (that's the separate Dashboard tip).
          Only rendered when calendar_content actually has a staff_note for
          today's resolved trigger_type (server-computed, general/omer
          always excluded) -- absent entirely otherwise, no empty-state box. */}
      {staffNote && (
        <div className="bg-denim text-white rounded-xl2 p-4 mb-5 flex gap-3 items-start">
          <Info size={18} className="text-brass shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brass mb-1">{t('staffNoteHeading')}</p>
            <p className="text-sm leading-relaxed">{staffNote}</p>
          </div>
        </div>
      )}

      {/* Today's Tasks, Capture, Shopping List, Kitchen Timer -- the whole
          staff home view. Capture and Kitchen Timer open as modals right
          here (same ToolModal every other simple tool uses) rather than
          navigating away, since both are quick, in-and-out actions.
          SS-179 tile formula (2026-07-20): was a plain flex row of compact
          icon+label buttons -- brought in line with the dashboard's own
          tile row (brass eyebrow, centered icon, display title, one-line
          subtitle, mist fill) rather than a one-off smaller pattern just
          for this page. */}
      <div className="grid grid-cols-3 gap-[14px] mb-6">
        <button
          onClick={() => setShowCapture(true)}
          className="flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('captureTile')}</span>
          <Camera size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('captureTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('captureSubtitle')}</span>
        </button>
        <Link
          href={`/properties/${propertyId}/shopping-list`}
          className="flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('shoppingTile')}</span>
          <ShoppingCart size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('shoppingTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('shoppingSubtitle')}</span>
        </Link>
        <button
          onClick={() => setShowKitchenTimer(true)}
          className="flex flex-col items-center justify-center gap-[6px] rounded-xl2 bg-mist border border-brass/30 py-[14px] px-2 shadow-card hover:shadow-cardHover transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-denim"
        >
          <span className="text-[9px] tracking-[0.2em] uppercase font-semibold text-brass">{t('timerTile')}</span>
          <Timer size={28} className="text-denim" aria-hidden="true" />
          <span className="font-display font-normal text-sm text-denim text-center">{t('timerTile')}</span>
          <span className="text-[10px] text-dusk text-center">{t('timerSubtitle')}</span>
        </button>
      </div>

      {showCapture && (
        <ToolModal slug="capture-photo" propertyId={propertyId} onClose={() => setShowCapture(false)} />
      )}
      {showKitchenTimer && (
        <KitchenOpsToolModal slug="kitchen-timer" propertyId={propertyId} onClose={() => setShowKitchenTimer(false)} />
      )}

      {/* Recurring daily duty checklist (staff_duty_templates, grouped by
          area) -- distinct from the one-off assigned Today's Tasks list
          below it. Staff-only: owner/manager visiting this page directly
          see everything else here unchanged, just not this section. */}
      {isStaff && <StaffDutyChecklist areas={dutyAreas} hasRosterKey={hasRosterKey} todayStr={todayStr} />}

      <h2 className="font-display text-lg text-denim mb-2">Today's Tasks</h2>
      {loading ? (
        <SkeletonList rows={2} />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-dusk text-center py-4 mb-6 bg-card rounded-xl2 shadow-card">
          Nothing due today.
        </p>
      ) : (
        <ul className="space-y-2 mb-6">
          {tasks.map((task) => {
            const overdue = !!task.due_date && task.due_date < today;
            return (
              <li key={task.id} className="bg-card rounded-xl2 shadow-card p-4 space-y-2">
                <p className="font-medium text-sm text-denim">{task.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.priority && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLE[task.priority]}`}>
                      {task.priority}
                    </span>
                  )}
                  {task.category && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-mist text-dusk">
                      {task.category}
                    </span>
                  )}
                  {task.due_date && (
                    <span className={`text-[10px] font-medium ${overdue ? 'text-rust' : 'text-dusk'}`}>
                      {overdue ? 'Overdue' : 'Due today'}
                    </span>
                  )}
                </div>
                <select
                  value={task.status}
                  onChange={(e) => setStatus(task, e.target.value as Status)}
                  className="w-full text-xs border border-brass/30 rounded-full px-3 py-2 min-h-[44px] bg-mist text-denim"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}

      <div className="-mx-4 border-t border-cardBorder pt-2">
        <ShiftHandoverClient propertyId={propertyId} />
      </div>
    </div>
  );
}
