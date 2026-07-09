// components/ResetChecklistClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';

type Template = {
  id: string;
  template_name: string;
  tasks: string[];
};

// Checkboxes are session-only, by design — this is a repeating checklist
// (run fresh every week), not a record that needs to persist across visits
// like a one-off task list would. Reloading resets it, same as a paper copy.
export default function ResetChecklistClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('task_templates')
      .select('id, template_name, tasks')
      .eq('property_id', propertyId)
      .order('template_name');
    setTemplates(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function resetTemplate(templateId: string, tasks: string[]) {
    setChecked((prev) => {
      const next = { ...prev };
      tasks.forEach((_, i) => delete next[`${templateId}:${i}`]);
      return next;
    });
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Reset Checklists</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Run through after Shabbos or Yom Tov. Checks clear when you leave — start fresh each time.
      </p>

      {templates.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">No checklist templates yet.</p>
      )}

      <div className="space-y-6">
        {templates.map((template) => {
          const total = template.tasks.length;
          const doneCount = template.tasks.filter((_, i) => checked[`${template.id}:${i}`]).length;
          return (
            <div key={template.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg text-charcoal">{template.template_name}</h2>
                <button
                  onClick={() => resetTemplate(template.id, template.tasks)}
                  className="text-xs text-charcoal/40 hover:text-charcoal underline"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-gold-dark mb-3">
                {doneCount} of {total} done
              </p>
              <ul className="space-y-2">
                {template.tasks.map((task, i) => {
                  const key = `${template.id}:${i}`;
                  return (
                    <li key={key}>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!checked[key]}
                          onChange={() => toggle(key)}
                          className="mt-0.5 h-4 w-4 accent-gold shrink-0"
                        />
                        <span className={`text-sm text-charcoal ${checked[key] ? 'line-through opacity-40' : ''}`}>
                          {task}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
