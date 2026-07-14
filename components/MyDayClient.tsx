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
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import ShiftHandoverClient from '@/components/ShiftHandoverClient';
import { Package, ShoppingCart } from 'lucide-react';

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

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-rust/10 text-rust',
  medium: 'bg-gold-light/40 text-gold-dark',
  low: 'bg-sage/10 text-sage',
};

export default function MyDayClient({ propertyId }: { propertyId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
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
      <h1 className="text-2xl font-display text-charcoal mb-1">My Day</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      <div className="flex gap-2 mb-6">
        <Link
          href={`/properties/${propertyId}/inventory`}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gold-dark text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
        >
          <Package size={16} aria-hidden="true" /> Update Inventory
        </Link>
        <Link
          href={`/properties/${propertyId}/shopping-list`}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gold-light/60 text-charcoal px-4 py-2.5 text-sm font-medium hover:bg-gold-light/10 transition"
        >
          <ShoppingCart size={16} className="text-gold-dark" aria-hidden="true" /> Shopping List
        </Link>
      </div>

      <h2 className="font-display text-lg text-charcoal mb-2">Today's Tasks</h2>
      {loading ? (
        <SkeletonList rows={2} />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-charcoal/40 text-center py-4 mb-6 bg-white rounded-2xl shadow-sm shadow-charcoal/5">
          Nothing due today.
        </p>
      ) : (
        <ul className="space-y-2 mb-6">
          {tasks.map((task) => {
            const overdue = !!task.due_date && task.due_date < today;
            return (
              <li key={task.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 space-y-2">
                <p className="font-medium text-sm text-charcoal">{task.title}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {task.priority && (
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLE[task.priority]}`}>
                      {task.priority}
                    </span>
                  )}
                  {task.category && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gold-light/20 text-charcoal/60">
                      {task.category}
                    </span>
                  )}
                  {task.due_date && (
                    <span className={`text-[10px] font-medium ${overdue ? 'text-rust' : 'text-charcoal/40'}`}>
                      {overdue ? 'Overdue' : 'Due today'}
                    </span>
                  )}
                </div>
                <select
                  value={task.status}
                  onChange={(e) => setStatus(task, e.target.value as Status)}
                  className="w-full text-xs border border-gold-light/60 rounded-full px-2 py-1 bg-cream/40"
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

      <div className="-mx-4 border-t border-gold-light/30 pt-2">
        <ShiftHandoverClient propertyId={propertyId} />
      </div>
    </div>
  );
}
