// components/ResetChecklistClient.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Section = { name: string; tasks: string[] };

type Template = {
  id: string;
  template_name: string;
  tasks: string[];
  sections: Section[] | null;
  sections_es: Section[] | null;
};

type Member = { user_id: string; full_name: string | null };

// Section + assignee + completion, keyed by `${section}:${task}` so it
// matches reset_checklist_progress's (property_id, template_id, section,
// task) uniqueness. Local edits are unsaved until "Save Draft" — the
// button exists specifically because someone might check off a dozen
// things then get pulled away before finishing.
type TaskState = { completed: boolean; assigneeId: string | null };

export default function ResetChecklistClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const showToast = useToast();
  const locale = useLocale();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [state, setState] = useState<Record<string, TaskState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [templatesRes, membersRes] = await Promise.all([
      supabase
        .from('task_templates')
        .select('id, template_name, tasks, sections, sections_es')
        .eq('property_id', propertyId)
        .order('template_name'),
      supabase
        .from('property_members')
        .select('user_id, profiles(full_name)')
        .eq('property_id', propertyId),
    ]);

    const loadedTemplates = (templatesRes.data ?? []) as Template[];
    setTemplates(loadedTemplates);
    setMembers(
      (membersRes.data ?? []).map((m) => ({
        user_id: m.user_id,
        full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );

    const templateIds = loadedTemplates.map((t) => t.id);
    if (templateIds.length > 0) {
      const { data: progress } = await supabase
        .from('reset_checklist_progress')
        .select('template_id, section, task, completed, assignee_id')
        .in('template_id', templateIds);

      const next: Record<string, TaskState> = {};
      for (const row of progress ?? []) {
        next[`${row.template_id}:${row.section}:${row.task}`] = {
          completed: row.completed,
          assigneeId: row.assignee_id,
        };
      }
      setState(next);
    }

    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Only 1 of 5 templates has real sections_es content so far (Erev Shabbos
  // Prep) -- the other 4 fall through to the English sections until those
  // get translated too, same "render the translation when it exists,
  // fall back to English rather than blank" rule used everywhere else.
  function sectionsFor(template: Template): Section[] {
    const localized = locale === 'es' && template.sections_es && template.sections_es.length > 0
      ? template.sections_es
      : template.sections;
    return localized && localized.length > 0
      ? localized
      : [{ name: template.template_name, tasks: template.tasks }];
  }

  function taskState(templateId: string, section: string, task: string): TaskState {
    return state[`${templateId}:${section}:${task}`] ?? { completed: false, assigneeId: null };
  }

  function setTaskState(templateId: string, section: string, task: string, patch: Partial<TaskState>) {
    const key = `${templateId}:${section}:${task}`;
    setState((prev) => ({ ...prev, [key]: { ...taskState(templateId, section, task), ...patch } }));
  }

  async function persist(templateId: string, rows: { section: string; task: string; state: TaskState }[]) {
    const payload = rows.map(({ section, task, state: s }) => ({
      property_id: propertyId,
      template_id: templateId,
      section,
      task,
      completed: s.completed,
      assignee_id: s.assigneeId,
    }));
    const { error } = await supabase
      .from('reset_checklist_progress')
      .upsert(payload, { onConflict: 'property_id,template_id,section,task' });
    return !error;
  }

  async function saveDraft(template: Template) {
    setSaving(true);
    const rows = sectionsFor(template).flatMap((s) =>
      s.tasks.map((task) => ({ section: s.name, task, state: taskState(template.id, s.name, task) }))
    );
    const ok = await persist(template.id, rows);
    setSaving(false);
    showToast(ok ? 'Draft saved.' : 'Failed to save.', { variant: ok ? 'success' : 'error' });
  }

  async function markAllComplete(template: Template) {
    setSaving(true);
    // Build the "all completed" payload directly rather than reading it
    // back from `state` right after setState — React batches state
    // updates, so a read-back here could still see the pre-update values.
    const rows = sectionsFor(template).flatMap((s) =>
      s.tasks.map((task) => ({
        section: s.name,
        task,
        state: { ...taskState(template.id, s.name, task), completed: true },
      }))
    );
    setState((prev) => {
      const next = { ...prev };
      for (const { section, task, state: s } of rows) {
        next[`${template.id}:${section}:${task}`] = s;
      }
      return next;
    });
    const ok = await persist(template.id, rows);
    setSaving(false);
    showToast(ok ? 'All tasks marked complete.' : 'Failed to save.', { variant: ok ? 'success' : 'error' });
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Reset Checklists</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Run through after Shabbos or Yom Tov. Progress is saved — pick up where you left off.
      </p>

      {templates.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          No checklist templates set up yet — these are configured by a household admin.
        </p>
      )}

      <div className="space-y-6">
        {templates.map((template) => (
          <ChecklistCard
            key={template.id}
            template={template}
            sections={sectionsFor(template)}
            members={members}
            taskState={(section, task) => taskState(template.id, section, task)}
            onToggle={(section, task) =>
              setTaskState(template.id, section, task, {
                completed: !taskState(template.id, section, task).completed,
              })
            }
            onAssign={(section, task, assigneeId) => setTaskState(template.id, section, task, { assigneeId })}
            onSaveDraft={() => saveDraft(template)}
            onMarkAllComplete={() => markAllComplete(template)}
            saving={saving}
          />
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({
  template,
  sections,
  members,
  taskState,
  onToggle,
  onAssign,
  onSaveDraft,
  onMarkAllComplete,
  saving,
}: {
  template: Template;
  sections: Section[];
  members: Member[];
  taskState: (section: string, task: string) => TaskState;
  onToggle: (section: string, task: string) => void;
  onAssign: (section: string, task: string, assigneeId: string | null) => void;
  onSaveDraft: () => void;
  onMarkAllComplete: () => void;
  saving: boolean;
}) {
  const { total, done, pct } = useMemo(() => {
    const allTasks = sections.flatMap((s) => s.tasks.map((task) => taskState(s.name, task)));
    const doneCount = allTasks.filter((t) => t.completed).length;
    return {
      total: allTasks.length,
      done: doneCount,
      pct: allTasks.length === 0 ? 0 : Math.round((doneCount / allTasks.length) * 100),
    };
  }, [sections, taskState]);

  return (
    <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg text-charcoal">{template.template_name}</h2>
      </div>
      <p className="text-xs text-gold-dark mb-1.5">
        {done} of {total} tasks completed, {pct}%
      </p>
      <div className="w-full bg-gold-light/30 h-2 rounded-full mb-4 overflow-hidden">
        <div className="bg-sage h-2 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.name}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-gold-dark mb-2">{section.name}</h3>
            <ul className="space-y-2.5">
              {section.tasks.map((task) => {
                const s = taskState(section.name, task);
                return (
                  <li key={task} className="flex items-start gap-2.5">
                    <label className="flex items-center justify-center w-11 h-11 -m-3 -mt-3.5 shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.completed}
                        onChange={() => onToggle(section.name, task)}
                        className="h-4 w-4 accent-gold-dark"
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <span className={`block text-sm text-charcoal ${s.completed ? 'line-through opacity-40' : ''}`}>
                        {task}
                      </span>
                      <select
                        value={s.assigneeId ?? ''}
                        onChange={(e) => onAssign(section.name, task, e.target.value || null)}
                        className="mt-1 text-xs border border-gold-light/50 rounded-full px-2 py-0.5 bg-cream/40 text-charcoal/70"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name ?? 'Unnamed'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={onSaveDraft}
          disabled={saving}
          className="flex-1 py-2 rounded-full border border-gold-light/60 text-charcoal text-sm font-medium disabled:opacity-40"
        >
          Save Draft
        </button>
        <button
          onClick={onMarkAllComplete}
          disabled={saving}
          className="flex-1 py-2 rounded-full bg-gold-dark text-white text-sm font-medium disabled:opacity-40"
        >
          Mark All Complete
        </button>
      </div>
    </div>
  );
}
