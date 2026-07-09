// components/StaffTasksClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';

type Task = {
  id: string;
  title: string;
  assigned_to: string | null;
  due_date: string | null;
  completed: boolean;
  notes: string | null;
};

export default function StaffTasksClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('staff_tasks')
      .select('id, title, assigned_to, due_date, completed, notes')
      .eq('property_id', propertyId)
      .order('completed')
      .order('due_date', { ascending: true, nullsFirst: false });
    setTasks(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const result = await resilientInsert(supabase, 'staff_tasks', {
      property_id: propertyId,
      title: title.trim(),
      assigned_to: assignedTo.trim() || null,
      due_date: dueDate || null,
      completed: false,
      created_by: user?.id ?? null,
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
    load();
  }

  async function toggleComplete(task: Task) {
    const completed = !task.completed;
    const result = await resilientUpdate(
      supabase,
      'staff_tasks',
      { id: task.id },
      { completed, completed_at: completed ? new Date().toISOString() : null }
    );
    if (!result.ok) {
      showToast('Failed to update.', { variant: 'error' });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed } : t)));
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

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Staff Task Center</h1>
      <p className="text-sm text-charcoal/50 mb-4">What needs doing, and by whom.</p>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
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
        <div className="flex gap-2">
          <div className="flex-1">
            <FieldLabel>Assigned to (optional)</FieldLabel>
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Assigned to (optional)"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <FieldLabel>Due date</FieldLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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

      <h2 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">Open ({open.length})</h2>
      {open.length === 0 && <p className="text-sm text-charcoal/40 mb-4">All caught up.</p>}
      <ul className="space-y-2 mb-6">
        {open.map((task) => {
          const overdue = !!task.due_date && task.due_date < today;
          return (
            <li key={task.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3 flex items-start gap-3">
              <label className="flex items-center justify-center w-11 h-11 -m-3 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleComplete(task)}
                  className="h-5 w-5 accent-gold"
                  aria-label={`Mark "${task.title}" complete`}
                />
              </label>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-charcoal">{task.title}</p>
                <p className={`text-xs ${overdue ? 'text-rust font-medium' : 'text-charcoal/50'}`}>
                  {task.assigned_to && `${task.assigned_to} · `}
                  {task.due_date ? `Due ${task.due_date}${overdue ? ' (overdue)' : ''}` : 'No due date'}
                </p>
              </div>
              {canManage(role) && (
                <button
                  onClick={() => removeTask(task.id)}
                  className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                  aria-label="Delete task"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-2">
            Completed ({done.length})
          </h2>
          <ul className="space-y-2 opacity-60">
            {done.map((task) => (
              <li key={task.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3 flex items-start gap-3">
                <label className="flex items-center justify-center w-11 h-11 -m-3 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleComplete(task)}
                    className="h-5 w-5 accent-gold"
                    aria-label={`Reopen "${task.title}"`}
                  />
                </label>
                <p className="flex-1 text-sm text-charcoal line-through">{task.title}</p>
                {canManage(role) && (
                  <button
                    onClick={() => removeTask(task.id)}
                    className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                    aria-label="Delete task"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
