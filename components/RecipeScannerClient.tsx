// components/RecipeScannerClient.tsx
// Recipe Scanner's editable result + save step. Wraps the shared
// PhotoToolClient (which still owns camera/gallery/text capture) and supplies
// its own renderer for the structured response from /api/tools/recipe-stealer.
//
// Saves a pending 'recipe' row to capture_staging -- the same two-gate pattern
// identify-item uses -- never a direct write to `recipes`. capture_staging has
// no columns of its own for this; the whole recipe rides in raw_payload jsonb,
// so there's no migration.
//
// kosher_type is deliberately absent, and the API prompt is instructed not to
// state or guess it. A person sets it at review. Same hard rule as
// identify-item: a wrong kashrut label is a real failure, not a cosmetic one.
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import PhotoToolClient from '@/components/PhotoToolClient';

type ScannedIngredient = { name: string; name_es: string; quantity: string };
type ScannedRecipe = {
  name: string;
  name_es: string;
  ingredients: ScannedIngredient[];
  instructions_en: string;
  instructions_es: string;
  uncertain: boolean;
};

const FIELD =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-3 py-2.5 text-sm text-denim';
const LABEL = 'block text-xs font-medium uppercase tracking-wider text-brass mb-1';

function ResultEditor({
  propertyId,
  scanned,
  reset,
}: {
  propertyId: string;
  scanned: ScannedRecipe;
  reset: () => void;
}) {
  const supabase = createClient();
  const showToast = useToast();
  const [draft, setDraft] = useState<ScannedRecipe>(scanned);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // A new scan of a different dish must replace the draft -- otherwise the
  // previous dish's edits would silently carry over onto it.
  useEffect(() => {
    setDraft(scanned);
    setSaved(false);
  }, [scanned]);

  function setIngredient(idx: number, patch: Partial<ScannedIngredient>) {
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)),
    }));
  }

  async function handleSave() {
    // Spanish is a hard requirement, enforced by the database: `recipes` has
    // a BEFORE INSERT trigger (trg_require_spanish) that raises when name_es
    // is blank. Saving without it here would only defer the failure to the
    // Capture Inbox, where approval would fail with a raw Postgres error.
    if (!draft.name.trim() || !draft.name_es.trim()) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('capture_staging').insert({
        property_id: propertyId,
        submitted_by: user?.id ?? null,
        capture_type: 'recipe',
        raw_payload: {
          name: draft.name.trim(),
          name_es: draft.name_es.trim(),
          ingredients: draft.ingredients
            .filter((i) => i.name.trim() || i.name_es.trim())
            .map((i) => ({
              name: i.name.trim(),
              name_es: i.name_es.trim() || null,
              quantity: i.quantity.trim() || null,
            })),
          instructions_en: draft.instructions_en.trim() || null,
          instructions_es: draft.instructions_es.trim() || null,
          source: 'recipe-scanner',
        },
      });
      if (error) throw error;
      setSaved(true);
      showToast('Sent to Capture Inbox for review.', { variant: 'success' });
    } catch {
      showToast("Couldn't save this — try again.", { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-5 text-center">
        <p className="text-sm text-denim mb-1">Sent for review.</p>
        <p className="text-xs text-dusk mb-4">
          It becomes a real recipe once someone approves it in the Capture Inbox.
        </p>
        <button
          onClick={reset}
          className="w-full py-2.5 rounded-full bg-card border border-brass/30 text-denim text-sm font-medium"
        >
          Scan another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-5 space-y-3">
      {draft.uncertain && (
        <p className="text-xs text-brass bg-linen rounded-xl2 px-3 py-2">
          Low-confidence reconstruction — read it over before saving.
        </p>
      )}

      <div>
        <label className={LABEL}>Recipe name (English)</label>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>Nombre en español</label>
        <input
          value={draft.name_es}
          onChange={(e) => setDraft({ ...draft, name_es: e.target.value })}
          placeholder="Nombre de la receta"
          className={FIELD}
        />
        {!draft.name_es.trim() && (
          <p className="text-[11px] text-brass mt-1">Required — staff cook from the Spanish version.</p>
        )}
      </div>

      {draft.ingredients.length > 0 && (
        <div>
          <label className={LABEL}>Ingredients</label>
          <div className="space-y-2">
            {draft.ingredients.map((ing, idx) => (
              <div key={idx} className="grid grid-cols-[4rem_1fr_1fr] gap-1.5">
                <input
                  value={ing.quantity}
                  onChange={(e) => setIngredient(idx, { quantity: e.target.value })}
                  placeholder="Qty"
                  className={FIELD}
                />
                <input
                  value={ing.name}
                  onChange={(e) => setIngredient(idx, { name: e.target.value })}
                  placeholder="Ingredient"
                  className={FIELD}
                />
                <input
                  value={ing.name_es}
                  onChange={(e) => setIngredient(idx, { name_es: e.target.value })}
                  placeholder="En español"
                  className={FIELD}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>Method (English)</label>
        <textarea
          value={draft.instructions_en}
          onChange={(e) => setDraft({ ...draft, instructions_en: e.target.value })}
          rows={6}
          className={`${FIELD} resize-y`}
        />
      </div>
      <div>
        <label className={LABEL}>Método en español</label>
        <textarea
          value={draft.instructions_es}
          onChange={(e) => setDraft({ ...draft, instructions_es: e.target.value })}
          rows={6}
          className={`${FIELD} resize-y`}
        />
      </div>

      <p className="text-[11px] text-dusk">
        Kosher type, course, and tags get set when this is reviewed in the Capture Inbox — they&apos;re never guessed
        from a photo.
      </p>

      <div className="flex gap-2">
        <button
          onClick={reset}
          disabled={saving}
          className="flex-1 py-2.5 rounded-full border border-cardBorder text-denim text-sm disabled:opacity-40"
        >
          Try another
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !draft.name.trim() || !draft.name_es.trim()}
          className="flex-1 py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save for review'}
        </button>
      </div>
    </div>
  );
}

export default function RecipeScannerClient({ propertyId }: { propertyId: string }) {
  return (
    <PhotoToolClient
      propertyId={propertyId}
      title="Recipe Scanner"
      description="Photograph or describe a dish to get a home-cookable version."
      apiRoute="/api/tools/recipe-stealer"
      actionLabel="Take or upload a photo of a dish"
      textPlaceholder="e.g. Cheesecake Factory's Louisiana chicken pasta"
      renderResult={(body, reset) => {
        const recipe = body.recipe as ScannedRecipe | undefined;
        if (!recipe) return null;
        return <ResultEditor propertyId={propertyId} scanned={recipe} reset={reset} />;
      }}
    />
  );
}
