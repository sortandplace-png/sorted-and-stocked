'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';
import Avatar from '@/components/Avatar';

type Status = 'open' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';

type Member = { id: string; full_name: string | null };

type Task = {
  id: string;
  title: string;
  assigned_to: string | null; // property_members.id
  due_date: string | null;
  status: Status;
  priority: Priority | null;
  category: string | null;
  notes: string | null;
};

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-rust/10 text-rust',
  medium: 'bg-gold-light/40 text-gold-dark',
  low: 'bg-sage/10 text-sage',
};

export default function StaffTasksClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: taskRows }, { data: memberRows }] = await Promise.all([
      supabase
        .from('staff_tasks')
        .select('id, title, assigned_to, due_date, status, priority, category, notes')
        .eq('property_id', propertyId)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('property_members')
        .select('id, profiles(full_name)')
        .eq('property_id', propertyId),
    ]);
    setTasks((taskRows as Task[]) ?? []);
    setMembers(
      (memberRows ?? []).map((m) => ({
        id: m.id,
        full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.full_name ?? 'Unnamed' : null);

  async function addTask() {
    if (!title.trim()) return;
    setSaving(true);

    const result = await resilientInsert(supabase, 'staff_tasks', {
      property_id: propertyId,
      title: title.trim(),
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
      priority: priority || null,
      category: category.trim() || null,
      status: 'open',
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Task added.', { variant: 'success' });
    setTitle('');
    setAssignedTo('');
    setDueDate('');
    setPriority('');
    setCategory('');
    load();
  }

  async function setStatus(task: Task, status: Status) {
    const result = await resilientUpdate(supabase, 'staff_tasks', { id: task.id }, { status });
    if (!result.ok) {
      showToast('Failed to update.', { variant: 'error' });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
  }

  async function removeTask(id: string) {
    const result = await resilientDelete(supabase, 'staff_tasks', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) return <SkeletonList />;

  const today = new Date().toISOString().slice(0, 10);

  function renderCard(task: Task) {
    const overdue = !!task.due_date && task.due_date < today && task.status !== 'done';
    return (
      <li key={task.id} className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm text-charcoal flex-1">{task.title}</p>
          {canManage(role) && (
            <button
              onClick={() => removeTask(task.id)}
              className="text-xs text-charcoal/30 hover:text-rust shrink-0"
              aria-label="Delete task"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {task.assigned_to && (
            <span className="inline-flex items-center gap-1 text-xs text-charcoal/70">
              <Avatar fullName={memberName(task.assigned_to)} size="sm" />
              {memberName(task.assigned_to)}
            </span>
          )}
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
        </div>

        {task.due_date && (
          <p className={`text-xs ${overdue ? 'text-rust font-medium' : 'text-charcoal/50'}`}>
            Due {task.due_date}
            {overdue ? ' (overdue)' : ''}
          </p>
        )}

        <select
          value={task.status}
          onChange={(e) => setStatus(task, e.target.value as Status)}
          className="w-full text-xs border border-gold-light/60 rounded-full px-2 py-1 bg-cream/40"
        >
          {COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </li>
    );
  }

  return (
    <div className="max-w-md lg:max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Staff Task Center</h1>
      <p className="text-sm text-charcoal/50 mb-4">What needs doing, and by whom.</p>

      <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
        <h2 className="font-display text-lg text-charcoal mb-1">Add a task</h2>
        <div>
          <FieldLabel>Task</FieldLabel>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Restock paper goods"
            className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Assigned to</FieldLabel>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? 'Unnamed user'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Due date</FieldLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Priority</FieldLabel>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority | '')}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white"
            >
              <option value="">None</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Cleaning"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={addTask}
          disabled={saving || !title.trim()}
          className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">
                {col.label} ({colTasks.length})
              </h2>
              {colTasks.length === 0 ? (
                <p className="text-sm text-charcoal/40">Nothing here.</p>
              ) : (
                <ul className="space-y-2">{colTasks.map(renderCard)}</ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
