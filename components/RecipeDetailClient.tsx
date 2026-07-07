// components/RecipeDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { kosherIcon } from '@/lib/icon-maps';
import SubstitutionCallout from '@/components/SubstitutionCallout';
import SubstitutionEditor from '@/components/SubstitutionEditor';
import IngredientShoppingLink from '@/components/IngredientShoppingLink';
import { fetchRecipeWithIngredients } from '@/lib/recipe-actions';

interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  reorder_link?: string | null;
  primary_store?: string | null;
  alternative_stores?: string[] | null;
  is_strictly_kosher?: boolean | null;
  photo_url?: string | null;
}

interface Recipe {
  id: string;
  name: string;
  name_es: string | null;
  photo_url: string | null;
  instructions_en: string | null;
  instructions_es: string | null;
  kosher_type: string | null;
  course: string | null;
  servings: number | null;
}

// Kitchen-friendly fraction display — nobody wants to measure "0.33 cups."
// Rounds to the nearest 1/4 (close enough for cooking) and renders common
// fractions as glyphs; falls back to a decimal for anything unusual.
const FRACTION_GLYPHS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
  '0.33': '⅓',
  '0.67': '⅔',
};

function formatScaledNumber(n: number): string {
  const rounded = Math.round(n * 4) / 4; // nearest quarter
  const whole = Math.floor(rounded);
  const frac = +(rounded - whole).toFixed(2);
  if (frac === 0) return String(whole);
  const glyph = FRACTION_GLYPHS[frac.toFixed(2)];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

// Google Drive's "file/d/.../view" links can't be embedded as images, but
// the thumbnail endpoint can be. App-local paths (starting with /) always
// work since they're same-origin.
function isDirectImageUrl(url: string) {
  if (url.startsWith('/')) return true;
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

export default function RecipeDetailClient({
  propertyId,
  recipeId,
  recipeName,
  substitutionNotes,
  substitutionUpdatedAt,
  substitutionUpdatedBy,
}: {
  propertyId: string;
  recipeId: string;
  recipeName?: string;
  substitutionNotes?: string | null;
  substitutionUpdatedAt?: string;
  substitutionUpdatedBy?: string;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetServings, setTargetServings] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { recipe: recipeData, ingredients: ingredientData } = await fetchRecipeWithIngredients(recipeId);
        setRecipe(recipeData);
        setIngredients(ingredientData);
        setTargetServings(recipeData?.servings ?? 4);
      } catch (err) {
        setError('Could not load this recipe.');
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId]);

  const baseServings = recipe?.servings ?? 4;
  const scaleFactor = targetServings ? targetServings / baseServings : 1;
  const isScaled = targetServings !== null && targetServings !== baseServings;

  function formatQty(i: Ingredient) {
    if (i.quantity == null) {
      // Nothing to scale — the amount is baked into the name text itself
      // (e.g. "2 segmented grapefruits") or it's a to-taste item.
      return [i.unit, i.name].filter(Boolean).join(' ');
    }
    const scaledQty = i.quantity * scaleFactor;
    return [formatScaledNumber(scaledQty), i.unit, i.name].filter(Boolean).join(' ');
  }

  if (loading) {
    return <div className="max-w-md mx-auto p-4 text-sm text-ink/40">Loading recipe…</div>;
  }

  if (error || !recipe) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-rust">{error ?? 'Recipe not found.'}</p>
        <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-aubergine mt-2 inline-block">
          ← Back to meal plan
        </Link>
      </div>
    );
  }

  const hasSpanish = !!recipe.instructions_es;
  const hasEnglish = !!recipe.instructions_en;

  return (
    <div className="max-w-md mx-auto p-4 print:max-w-full">
      <div className="flex items-center justify-between mb-4 print:hidden gap-2 flex-wrap">
        <Link
          href={`/properties/${propertyId}/meal-plan`}
          className="text-sm text-aubergine font-medium"
        >
          ← Meal plan
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const text = `Check out ${recipe.name} - ${recipe.instructions_en ? 'Serves ' + (recipe.servings || 4) : ''}\n\nIngredients:\n${ingredients.map(i => `• ${formatQty(i)}`).join('\n')}\n\nMeal planning with Sorted & Stocked`;
              const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(url, '_blank');
            }}
            className="text-sm font-medium bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition"
          >
            💬 Share
          </button>
          <button
            onClick={() => window.print()}
            className="text-sm font-medium bg-aubergine text-cream px-4 py-2 rounded-full hover:opacity-90 transition"
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {recipe.photo_url && isDirectImageUrl(recipe.photo_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.photo_url}
          alt=""
          className="w-full h-48 object-cover rounded-2xl mb-4 print:h-32"
        />
      )}

      <h1 className="font-display text-2xl text-aubergine mb-1">{recipe.name}</h1>
      {recipe.name_es && (
        <p className="text-sm italic text-ink/50 -mt-1 mb-2">{recipe.name_es}</p>
      )}
      {recipe.kosher_type && (
        <span className="inline-block text-xs font-medium text-aubergine bg-gold-light/30 px-2.5 py-1 rounded-full mb-4">
          {kosherIcon(recipe.kosher_type)} {recipe.kosher_type}
        </span>
      )}

      <SubstitutionCallout
        recipeName={recipeName || recipe.name}
        substitutionNotes={substitutionNotes}
      />

      <div className="bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4 mb-4 print:shadow-none print:border print:border-gold-light">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg text-aubergine">
            Ingredients <span className="text-ink/40 text-sm font-sans">/ Ingredientes</span>
          </h2>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => setTargetServings((s) => Math.max(1, (s ?? baseServings) - 1))}
              className="w-7 h-7 rounded-full border border-gold-light/60 text-aubergine text-sm leading-none"
              aria-label="Fewer servings"
            >
              −
            </button>
            <span className="text-sm text-ink w-20 text-center">
              {targetServings ?? baseServings} serving{(targetServings ?? baseServings) === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setTargetServings((s) => (s ?? baseServings) + 1)}
              className="w-7 h-7 rounded-full border border-gold-light/60 text-aubergine text-sm leading-none"
              aria-label="More servings"
            >
              +
            </button>
          </div>
        </div>
        {isScaled && (
          <p className="text-xs text-gold mb-2 print:hidden">
            Scaled from {baseServings} to {targetServings} servings — amounts rounded to the nearest ¼ for easier measuring.
          </p>
        )}
        <p className="hidden print:block text-xs text-ink/50 mb-2">
          Serves {targetServings ?? baseServings}
          {isScaled ? ` (scaled from ${baseServings})` : ''}
        </p>
        {ingredients.length === 0 ? (
          <p className="text-sm text-ink/40">No ingredients recorded for this recipe.</p>
        ) : (
          <ul className="space-y-2">
            {ingredients.map((i) => (
              <li key={i.id} className="text-sm text-ink">
                <div className="flex gap-2 print:hidden">
                  <span className="text-gold shrink-0">•</span>
                  <div className="flex-1">
                    <div>{formatQty(i)}</div>
                    <IngredientShoppingLink
                      ingredient={i}
                      recipeNames={[recipe.name]}
                    />
                  </div>
                </div>
                <div className="hidden print:flex gap-2">
                  <span className="text-gold shrink-0">•</span>
                  {formatQty(i)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(hasEnglish || hasSpanish) && (
        <div className="grid grid-cols-1 print:grid-cols-2 gap-4">
          {hasEnglish && (
            <div className="bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4 print:shadow-none print:border print:border-gold-light">
              <h2 className="font-display text-lg text-aubergine mb-2">Instructions</h2>
              <div className="text-sm text-ink space-y-2 leading-relaxed">
                {recipe.instructions_en!.split(' | ').map((step, idx) => (
                  <p key={idx}>
                    <span className="text-gold font-medium">{idx + 1}.</span> {step}
                  </p>
                ))}
              </div>
            </div>
          )}
          {hasSpanish && (
            <div className="bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4 print:shadow-none print:border print:border-gold-light">
              <h2 className="font-display text-lg text-aubergine mb-2">Instrucciones</h2>
              <div className="text-sm text-ink space-y-2 leading-relaxed">
                {recipe.instructions_es!.split(' | ').map((step, idx) => (
                  <p key={idx}>
                    <span className="text-gold font-medium">{idx + 1}.</span> {step}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hasEnglish && !hasSpanish && (
        <p className="text-sm text-ink/40 text-center mt-4">
          No written instructions on file for this recipe yet.
        </p>
      )}

      <div className="mt-8 print:hidden">
        <SubstitutionEditor
          recipeId={recipeId}
          initialNotes={substitutionNotes || ''}
          lastUpdatedBy={substitutionUpdatedBy}
          lastUpdatedAt={substitutionUpdatedAt ? new Date(substitutionUpdatedAt) : undefined}
        />
      </div>
    </div>
  );
}
