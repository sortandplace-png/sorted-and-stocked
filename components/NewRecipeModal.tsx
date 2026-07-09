'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { COURSES, type Course } from '@/lib/course-constants';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';

type IngredientRow = { name: string; quantity: string; unit: string; category: string };

type RecipeDraft = {
  name: string;
  servings: string;
  course: Course;
  ingredientRows: IngredientRow[];
};

export default function NewRecipeModal({
  propertyId,
  onClose,
  onSaved,
  defaultCourse = 'protein',
}: {
  propertyId: string;
  onClose: () => void;
  onSaved: () => void;
  defaultCourse?: Course;
}) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [course, setCourse] = useState<Course>(defaultCourse);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { name: '', quantity: '', unit: '', category: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const showToast = useToast();

  const { existingDraft, resumeDraft, discardDraft, clearDraft, queueSave } = useDraftAutosave<RecipeDraft>({
    propertyId,
    formType: 'new_recipe',
    isEmpty: (d) => !d.name.trim() && d.ingredientRows.every((r) => !r.name.trim()),
  });

  useEffect(() => {
    queueSave({ name, servings, course, ingredientRows });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, servings, course, ingredientRows]);

  function applyDraft(draft: RecipeDraft) {
    setName(draft.name);
    setServings(draft.servings);
    setCourse(draft.course);
    setIngredientRows(draft.ingredientRows);
  }

  function addIngredientRow() {
    setIngredientRows((prev) => [...prev, { name: '', quantity: '', unit: '', category: '' }]);
  }

  function updateIngredientRow(index: number, field: keyof IngredientRow, value: string) {
    setIngredientRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveNewRecipe() {
    if (!name.trim()) return;
    setSaving(true);

    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        property_id: propertyId,
        name: name.trim(),
        servings: Number(servings) || 4,
        course,
      })
      .select('id')
      .single();

    if (recipeError || !recipe) {
      setSaving(false);
      showToast('Failed to save recipe.', { variant: 'error' });
      return;
    }

    const validRows = ingredientRows.filter((r) => r.name.trim());
    if (validRows.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        validRows.map((r) => {
          const parsed = r.quantity ? parseFloat(r.quantity) : NaN;
          return {
            recipe_id: recipe.id,
            name: r.name.trim(),
            quantity: Number.isFinite(parsed) ? parsed : null,
            unit: r.unit.trim() || null,
            category: r.category.trim() || null,
          };
        })
      );
    }

    setSaving(false);
    showToast('Recipe saved.', { variant: 'success' });
    await clearDraft();
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-charcoal mb-3">New recipe</h2>

        {existingDraft && (
          <div className="bg-gold-light/20 border border-gold-light rounded-2xl p-3 mb-3 text-sm">
            <p className="text-charcoal mb-2">You have an unsaved draft of a recipe.</p>
            <div className="flex gap-2">
              <button
                onClick={() => applyDraft(resumeDraft() as RecipeDraft)}
                className="flex-1 py-2 rounded-full bg-charcoal text-cream font-medium text-xs"
              >
                Resume draft
              </button>
              <button
                onClick={() => discardDraft()}
                className="flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-xs"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name"
            className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
            autoFocus
          />
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value as Course)}
            className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
          >
            {COURSES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="Servings"
            className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
          />
        </div>

        <p className="text-sm font-medium text-charcoal mb-2">Ingredients</p>
        <div className="space-y-2 mb-2">
          {ingredientRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.name}
                onChange={(e) => updateIngredientRow(i, 'name', e.target.value)}
                placeholder="Ingredient"
                className="w-2/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.quantity}
                onChange={(e) => updateIngredientRow(i, 'quantity', e.target.value)}
                placeholder="Qty"
                className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.unit}
                onChange={(e) => updateIngredientRow(i, 'unit', e.target.value)}
                placeholder="Unit"
                className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.category}
                onChange={(e) => updateIngredientRow(i, 'category', e.target.value)}
                placeholder="Aisle"
                className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
            </div>
          ))}
        </div>
        <button onClick={addIngredientRow} className="text-sm text-charcoal underline mb-4">
          + Add ingredient
        </button>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full border border-charcoal/30 text-charcoal"
          >
            Cancel
          </button>
          <button
            onClick={saveNewRecipe}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
