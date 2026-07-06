// components/RecipeDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Ingredient {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
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
}: {
  propertyId: string;
  recipeId: string;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: recipeData, error: recipeError }, { data: ingredientData }] =
        await Promise.all([
          supabase
            .from('recipes')
            .select('id, name, name_es, photo_url, instructions_en, instructions_es, kosher_type, course')
            .eq('id', recipeId)
            .single(),
          supabase
            .from('recipe_ingredients')
            .select('id, name, quantity, unit, category')
            .eq('recipe_id', recipeId)
            .order('category'),
        ]);

      if (recipeError) {
        setError('Could not load this recipe.');
      } else {
        setRecipe(recipeData);
        setIngredients(ingredientData ?? []);
      }
      setLoading(false);
    })();
  }, [recipeId]);

  function formatQty(i: Ingredient) {
    return [i.quantity, i.unit, i.name].filter(Boolean).join(' ');
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
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/properties/${propertyId}/meal-plan`}
          className="text-sm text-aubergine font-medium"
        >
          ← Meal plan
        </Link>
        <button
          onClick={() => window.print()}
          className="text-sm font-medium bg-aubergine text-cream px-4 py-2 rounded-full"
        >
          🖨️ Print
        </button>
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
          {recipe.kosher_type}
        </span>
      )}

      <div className="bg-white rounded-2xl shadow-sm shadow-aubergine/5 p-4 mb-4 print:shadow-none print:border print:border-gold-light">
        <h2 className="font-display text-lg text-aubergine mb-2">
          Ingredients <span className="text-ink/40 text-sm font-sans">/ Ingredientes</span>
        </h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-ink/40">No ingredients recorded for this recipe.</p>
        ) : (
          <ul className="space-y-1.5">
            {ingredients.map((i) => (
              <li key={i.id} className="text-sm text-ink flex gap-2">
                <span className="text-gold shrink-0">•</span>
                {formatQty(i)}
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
    </div>
  );
}
