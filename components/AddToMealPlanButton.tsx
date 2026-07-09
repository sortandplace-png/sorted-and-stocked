// components/AddToMealPlanButton.tsx
'use client';

import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert } from '@/lib/resilient-write';
import { COURSES, type Course } from '@/lib/course-constants';
import { useToast } from '@/components/Toast';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddToMealPlanButton({
  propertyId,
  recipeId,
  defaultCourse,
}: {
  propertyId: string;
  recipeId: string;
  defaultCourse: Course | null;
}) {
  const supabase = createClient();
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [course, setCourse] = useState<Course>(defaultCourse ?? 'protein');
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    // Replace whatever's already in that slot, same as the meal-plan picker does.
    await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('property_id', propertyId)
      .eq('plan_date', date)
      .eq('course', course);

    const result = await resilientInsert(supabase, 'meal_plan_entries', {
      property_id: propertyId,
      plan_date: date,
      course,
      recipe_id: recipeId,
      meal_slot: 'dinner',
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to add to meal plan.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added to meal plan.', {
      variant: 'success',
    });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium border border-gold-light/60 text-charcoal/60 px-4 py-2 rounded-full hover:bg-gold-light/10 transition flex items-center gap-1.5"
      >
        <CalendarPlus size={14} strokeWidth={1.75} /> Add to Meal Plan
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-charcoal/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg text-charcoal mb-3">Add to Meal Plan</h2>
            <label className="text-xs text-charcoal/50 block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm mb-3"
            />
            <label className="text-xs text-charcoal/50 block mb-1">Course</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value as Course)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm bg-white mb-4"
            >
              {COURSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-charcoal/40 mb-3">
              Replaces whatever's already planned for that day and course.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm"
              >
                Cancel
              </button>
              <button
                onClick={add}
                disabled={saving}
                className="flex-1 py-2 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
