'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { COURSES, type Course } from '@/lib/course-constants';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import { findAutoLinkMatch } from '@/lib/inventory-matching';
import { compressImageToBlob } from '@/lib/compress-image';
import FieldLabel from '@/components/FieldLabel';

type IngredientRow = { name: string; quantity: string; unit: string; category: string };

type RecipeDraft = {
  name: string;
  servings: string;
  course: Course;
  ingredientRows: IngredientRow[];
};

// "Parve (Fish)" used to be a separate fourth value here but was merged
// into plain "Parve" -- fish is halachically parve, and nothing in the app
// depended on the distinction beyond a cosmetic icon.
const KOSHER_TYPES = ['Meat', 'Dairy', 'Parve'];

export default function NewRecipeModal({
  propertyId,
  onClose,
  onSaved,
  defaultCourse = 'protein',
  editRecipeId,
  initialName,
  initialServings,
  initialCourse,
  initialIngredients,
  initialNameEs,
  initialKosherType,
  initialInstructionsEn,
  initialTags,
  initialEquipment,
  initialApproxTotalMinutes,
  initialPrepLeadDays,
  initialIsShabbosOnly,
  initialIsYomTov,
  initialIsPesach,
  initialPhotoUrl,
}: {
  propertyId: string;
  onClose: () => void;
  onSaved: () => void;
  defaultCourse?: Course;
  // When set, the modal edits this existing recipe instead of creating a
  // new one — same form, reused rather than building a second editor.
  editRecipeId?: string;
  initialName?: string;
  initialServings?: number | null;
  initialCourse?: Course;
  initialIngredients?: IngredientRow[];
  initialNameEs?: string | null;
  initialKosherType?: string | null;
  initialInstructionsEn?: string | null;
  initialTags?: string[] | null;
  initialEquipment?: string[] | null;
  initialApproxTotalMinutes?: number | null;
  initialPrepLeadDays?: number | null;
  initialIsShabbosOnly?: boolean | null;
  initialIsYomTov?: boolean | null;
  initialIsPesach?: boolean | null;
  initialPhotoUrl?: string | null;
}) {
  const isEditing = !!editRecipeId;
  const [name, setName] = useState(initialName ?? '');
  const [servings, setServings] = useState(initialServings ? String(initialServings) : '4');
  const [course, setCourse] = useState<Course>(initialCourse ?? defaultCourse);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(
    initialIngredients && initialIngredients.length > 0
      ? initialIngredients
      : [{ name: '', quantity: '', unit: '', category: '' }]
  );
  const [nameEs, setNameEs] = useState(initialNameEs ?? '');
  const [kosherType, setKosherType] = useState(initialKosherType ?? '');
  const [instructionsEn, setInstructionsEn] = useState(initialInstructionsEn ?? '');
  const [tagsText, setTagsText] = useState((initialTags ?? []).join(', '));
  const [equipmentText, setEquipmentText] = useState((initialEquipment ?? []).join(', '));
  const [approxTotalMinutes, setApproxTotalMinutes] = useState(
    initialApproxTotalMinutes != null ? String(initialApproxTotalMinutes) : ''
  );
  const [prepLeadDays, setPrepLeadDays] = useState(initialPrepLeadDays != null ? String(initialPrepLeadDays) : '');
  const [isShabbosOnly, setIsShabbosOnly] = useState(!!initialIsShabbosOnly);
  const [isYomTov, setIsYomTov] = useState(!!initialIsYomTov);
  const [isPesach, setIsPesach] = useState(!!initialIsPesach);

  const [photoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const showToast = useToast();

  // Draft autosave only makes sense for the create flow — editing an
  // existing recipe already has a persisted row, there's nothing to
  // "resume" if the tab closes mid-edit the way there is for a brand new,
  // not-yet-saved recipe.
  const { existingDraft, resumeDraft, discardDraft, clearDraft, queueSave } = useDraftAutosave<RecipeDraft>({
    propertyId,
    formType: 'new_recipe',
    isEmpty: (d) => !d.name.trim() && d.ingredientRows.every((r) => !r.name.trim()),
  });

  useEffect(() => {
    if (isEditing) return;
    queueSave({ name, servings, course, ingredientRows });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, servings, course, ingredientRows, isEditing]);

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

  function handlePhotoSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoRemoved(false);
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoRemoved(true);
  }

  function parseCommaList(text: string): string[] {
    return text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function saveNewRecipe() {
    if (!name.trim()) return;
    setSaving(true);

    let recipeId: string;

    const sharedFields = {
      name: name.trim(),
      servings: Number(servings) || 4,
      course,
      name_es: nameEs.trim() || null,
      kosher_type: kosherType || null,
      instructions_en: instructionsEn.trim() || null,
      tags: parseCommaList(tagsText),
      equipment: parseCommaList(equipmentText),
      approx_total_minutes: approxTotalMinutes ? Number(approxTotalMinutes) || null : null,
      prep_lead_days: prepLeadDays ? Number(prepLeadDays) || null : null,
      is_shabbos_only: isShabbosOnly,
      is_yom_tov: isYomTov,
      is_pesach: isPesach,
    };

    if (isEditing) {
      const { error: updateError } = await supabase.from('recipes').update(sharedFields).eq('id', editRecipeId);

      if (updateError) {
        setSaving(false);
        showToast('Failed to save recipe.', { variant: 'error' });
        return;
      }
      recipeId = editRecipeId!;

      // Simplest correct approach for edited ingredients: replace the full
      // set rather than diffing row-by-row against what changed.
      await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    } else {
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({ property_id: propertyId, ...sharedFields })
        .select('id')
        .single();

      if (recipeError || !recipe) {
        setSaving(false);
        showToast('Failed to save recipe.', { variant: 'error' });
        return;
      }
      recipeId = recipe.id;
    }

    // Photo upload happens after we have a real recipeId — a brand-new
    // recipe doesn't have one until the insert above completes.
    if (photoFile) {
      const path = `${propertyId}/${recipeId}-${Date.now()}.jpg`;
      try {
        const compressed = await compressImageToBlob(photoFile);
        const { error: uploadError } = await supabase.storage
          .from('recipe-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (!uploadError) {
          const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
          await supabase.from('recipes').update({ photo_url: data.publicUrl }).eq('id', recipeId);
        } else {
          showToast('Recipe saved, but the photo failed to upload.', { variant: 'error' });
        }
      } catch {
        showToast('Recipe saved, but the photo failed to upload.', { variant: 'error' });
      }
    } else if (photoRemoved) {
      await supabase.from('recipes').update({ photo_url: null }).eq('id', recipeId);
    }

    const validRows = ingredientRows.filter((r) => r.name.trim());
    if (validRows.length > 0) {
      // Same confidence bar as the Needs Linking auto-link pass
      // (lib/inventory-matching.ts) — a genuinely confident, unambiguous
      // match links immediately instead of joining the manual-review
      // backlog. Anything less certain is left unlinked, same as before.
      const matches = await Promise.all(
        validRows.map((r) => findAutoLinkMatch(supabase, propertyId, r.name.trim()))
      );
      await supabase.from('recipe_ingredients').insert(
        validRows.map((r, i) => {
          const parsed = r.quantity ? parseFloat(r.quantity) : NaN;
          return {
            recipe_id: recipeId,
            name: r.name.trim(),
            quantity: Number.isFinite(parsed) ? parsed : null,
            unit: r.unit.trim() || null,
            category: r.category.trim() || null,
            inventory_item_id: matches[i]?.id ?? null,
          };
        })
      );
    }

    setSaving(false);
    showToast(isEditing ? 'Recipe updated.' : 'Recipe saved.', { variant: 'success' });
    if (!isEditing) await clearDraft();
    onSaved();
  }

  const displayedPhoto = photoPreview ?? (photoRemoved ? null : photoUrl);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-charcoal mb-3">{isEditing ? 'Edit recipe' : 'New recipe'}</h2>

        {!isEditing && existingDraft && (
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
                className="flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-xs"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <div className="mb-3">
          <FieldLabel>Photo</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoSelected(e.target.files)}
          />
          {displayedPhoto ? (
            <div>
              <img
                src={displayedPhoto}
                alt=""
                className="w-full h-40 object-cover rounded-2xl border border-gold-light/60"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 rounded-full bg-cream border border-charcoal/30 text-charcoal text-xs font-medium"
                >
                  Replace photo
                </button>
                <button
                  onClick={removePhoto}
                  className="flex-1 py-2 rounded-full bg-cream border border-rust/40 text-rust text-xs font-medium"
                >
                  Remove photo
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 rounded-2xl border-2 border-dashed border-gold-light/60 text-charcoal/50 text-sm font-medium hover:bg-gold-light/10 transition"
            >
              + Add a photo
            </button>
          )}
        </div>

        <div className="space-y-3 mb-3">
          <div>
            <FieldLabel>Recipe name</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe name"
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Spanish name</FieldLabel>
            <input
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              placeholder="Optional"
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Course</FieldLabel>
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
            </div>
            <div className="flex-1">
              <FieldLabel>Kosher type</FieldLabel>
              <select
                value={kosherType}
                onChange={(e) => setKosherType(e.target.value)}
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              >
                <option value="">Not set</option>
                {KOSHER_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Servings</FieldLabel>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="Servings"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Total minutes</FieldLabel>
              <input
                type="number"
                value={approxTotalMinutes}
                onChange={(e) => setApproxTotalMinutes(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Prep lead days</FieldLabel>
              <input
                type="number"
                value={prepLeadDays}
                onChange={(e) => setPrepLeadDays(e.target.value)}
                placeholder="Optional"
                className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Instructions</FieldLabel>
            <textarea
              value={instructionsEn}
              onChange={(e) => setInstructionsEn(e.target.value)}
              placeholder="Step-by-step instructions"
              rows={5}
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 text-sm"
            />
          </div>
          <div>
            <FieldLabel>Tags</FieldLabel>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Comma-separated, e.g. quick-easy, oven, freezer-friendly"
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 text-sm"
            />
          </div>
          <div>
            <FieldLabel>Equipment</FieldLabel>
            <input
              value={equipmentText}
              onChange={(e) => setEquipmentText(e.target.value)}
              placeholder="Comma-separated, e.g. 9x13 pan, immersion blender"
              className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 text-sm"
            />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isShabbosOnly} onChange={(e) => setIsShabbosOnly(e.target.checked)} />
              Shabbos
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isYomTov} onChange={(e) => setIsYomTov(e.target.checked)} />
              Yom Tov
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isPesach} onChange={(e) => setIsPesach(e.target.checked)} />
              Pesach
            </label>
          </div>
        </div>

        <p className="text-sm font-medium text-charcoal mb-2">Ingredients</p>
        <div className="flex gap-2 mb-1 px-1">
          <span className="w-2/5 text-xs font-medium text-charcoal/60">Ingredient</span>
          <span className="w-1/5 text-xs font-medium text-charcoal/60">Qty</span>
          <span className="w-1/5 text-xs font-medium text-charcoal/60">Unit</span>
          <span className="w-1/5 text-xs font-medium text-charcoal/60">Aisle</span>
        </div>
        <div className="space-y-2 mb-2">
          {ingredientRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.name}
                onChange={(e) => updateIngredientRow(i, 'name', e.target.value)}
                placeholder="Ingredient"
                aria-label="Ingredient"
                className="w-2/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.quantity}
                onChange={(e) => updateIngredientRow(i, 'quantity', e.target.value)}
                placeholder="Qty"
                aria-label="Quantity"
                className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.unit}
                onChange={(e) => updateIngredientRow(i, 'unit', e.target.value)}
                placeholder="Unit"
                aria-label="Unit"
                className="w-1/5 border border-gold-light/60 rounded-xl px-3 py-2 bg-cream/40 text-sm"
              />
              <input
                value={row.category}
                onChange={(e) => updateIngredientRow(i, 'category', e.target.value)}
                placeholder="Aisle"
                aria-label="Aisle"
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
            className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
          >
            Cancel
          </button>
          <button
            onClick={saveNewRecipe}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-full bg-charcoal text-cream disabled:opacity-40"
          >
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
