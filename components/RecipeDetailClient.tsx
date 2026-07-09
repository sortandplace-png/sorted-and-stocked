// components/RecipeDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Printer, Share2, History as HistoryIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import SubstitutionCallout from '@/components/SubstitutionCallout';
import SubstitutionEditor from '@/components/SubstitutionEditor';
import RecipeHistoryModal from '@/components/RecipeHistoryModal';
import RecipeFamilyNotes from '@/components/RecipeFamilyNotes';
import RecipePrepLeadDays from '@/components/RecipePrepLeadDays';
import AddToMealPlanButton from '@/components/AddToMealPlanButton';
import type { Course } from '@/lib/course-constants';
import IngredientShoppingLink from '@/components/IngredientShoppingLink';
import { fetchRecipeWithIngredients } from '@/lib/recipe-actions';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { formatScaledNumber } from '@/lib/scale-quantity';
import { useToast } from '@/components/Toast';

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
  section_label?: string | null;
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
  family_notes: string | null;
  tags: string[] | null;
  approx_total_minutes: number | null;
  prep_lead_days: number | null;
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
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [view, setView] = useState<'owner' | 'staff'>(role === 'staff' ? 'staff' : 'owner');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [addingToListIds, setAddingToListIds] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  // Per-person favorite (recipe_favorites.user_id) — not shared across the
  // household, same convention as inventory_item_favorites.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      if (!user) return;

      const { data } = await supabase
        .from('recipe_favorites')
        .select('id')
        .eq('recipe_id', recipeId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsFavorite(!!data);
    })();
  }, [recipeId, supabase]);

  async function toggleFavorite() {
    if (!currentUserId) return;
    const next = !isFavorite;
    setIsFavorite(next);

    if (next) {
      await supabase
        .from('recipe_favorites')
        .insert({ property_id: propertyId, recipe_id: recipeId, user_id: currentUserId });
    } else {
      await supabase
        .from('recipe_favorites')
        .delete()
        .eq('property_id', propertyId)
        .eq('recipe_id', recipeId)
        .eq('user_id', currentUserId);
    }
  }

  // Ingredients arrive pre-sorted with unlabeled rows first, then grouped by
  // section_label — cluster consecutive same-label rows into display groups.
  const ingredientGroups: { label: string | null; items: Ingredient[] }[] = [];
  for (const ing of ingredients) {
    const label = ing.section_label ?? null;
    const lastGroup = ingredientGroups[ingredientGroups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(ing);
    } else {
      ingredientGroups.push({ label, items: [ing] });
    }
  }

  const baseServings = recipe?.servings ?? 4;
  const scaleFactor = targetServings ? targetServings / baseServings : 1;
  const isScaled = targetServings !== null && targetServings !== baseServings;

  function servingsLabel(n: number) {
    if (lang === 'es') return `${n} porción${n === 1 ? '' : 'es'}`;
    return `${n} serving${n === 1 ? '' : 's'}`;
  }

  function formatQty(i: Ingredient) {
    if (i.quantity == null) {
      // Nothing to scale — the amount is baked into the name text itself
      // (e.g. "2 segmented grapefruits") or it's a to-taste item.
      return [i.unit, i.name].filter(Boolean).join(' ');
    }
    const scaledQty = i.quantity * scaleFactor;
    return [formatScaledNumber(scaledQty), i.unit, i.name].filter(Boolean).join(' ');
  }

  async function addToShoppingList(i: Ingredient) {
    setAddingToListIds((prev) => ({ ...prev, [i.id]: true }));
    const result = await addIngredientsToShoppingList(supabase, propertyId, [
      {
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        recipe_id: recipeId,
      },
    ]);
    setAddingToListIds((prev) => ({ ...prev, [i.id]: false }));

    if (!result.ok) {
      showToast(result.error, { variant: 'error' });
      return;
    }
    showToast(`Added ${i.name} to shopping list.`, { variant: 'success' });
  }

  if (loading) {
    return <div className="max-w-md mx-auto p-4 text-sm text-charcoal/40">Loading recipe…</div>;
  }

  if (error || !recipe) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-rust">{error ?? 'Recipe not found.'}</p>
        <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-charcoal mt-2 inline-block">
          ← Back to meal plan
        </Link>
      </div>
    );
  }

  const hasSpanish = !!recipe.instructions_es;
  const hasEnglish = !!recipe.instructions_en;

  return (
    <div className="max-w-md lg:max-w-5xl mx-auto p-4 print:max-w-full">
      <div className="flex items-center justify-between mb-4 print:hidden gap-2 flex-wrap">
        <Link
          href={`/properties/${propertyId}/meal-plan`}
          className="text-sm text-charcoal font-medium"
        >
          ← Meal plan
        </Link>
        <div className="flex gap-2">
          {currentUserId && (
            <button
              onClick={toggleFavorite}
              className="text-xl w-9 h-9 flex items-center justify-center rounded-full border border-gold-light/60 hover:bg-gold-light/10 transition"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '⭐' : '☆'}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="text-sm font-medium bg-charcoal text-cream px-4 py-2 rounded-full hover:opacity-90 transition flex items-center gap-1.5"
          >
            <Printer size={14} strokeWidth={1.75} /> Print
          </button>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/properties/${propertyId}/recipes/${recipeId}`;
              if (navigator.share) {
                await navigator.share({ title: recipe.name, url });
              } else {
                await navigator.clipboard.writeText(url);
              }
            }}
            className="text-sm font-medium border border-gold text-gold-dark px-4 py-2 rounded-full hover:bg-gold/5 transition flex items-center gap-1.5"
          >
            <Share2 size={14} strokeWidth={1.75} /> Share
          </button>
          {canManage(role) && (
            <button
              onClick={() => setShowHistory(true)}
              className="text-sm font-medium border border-gold-light/60 text-charcoal/60 px-4 py-2 rounded-full hover:bg-gold-light/10 transition flex items-center gap-1.5"
            >
              <HistoryIcon size={14} strokeWidth={1.75} /> History
            </button>
          )}
          {canManage(role) && (
            <AddToMealPlanButton
              propertyId={propertyId}
              recipeId={recipeId}
              defaultCourse={(recipe.course as Course) ?? null}
            />
          )}
        </div>
      </div>

      {showHistory && <RecipeHistoryModal recipeId={recipeId} onClose={() => setShowHistory(false)} />}

      {recipe.photo_url && isDirectImageUrl(recipe.photo_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.photo_url}
          alt=""
          className="w-full h-64 sm:h-80 object-cover rounded-3xl border border-gold-light/40 shadow-sm mb-4 print:h-32"
        />
      ) : (
        <div className="w-full h-64 sm:h-80 rounded-3xl border border-gold-light/40 bg-gold-light/10 flex items-center justify-center mb-4 print:hidden">
          {(() => {
            const Icon = getRecipeIcon(recipe.course);
            return <Icon className="w-16 h-16 text-gold-dark/50" strokeWidth={1.25} />;
          })()}
        </div>
      )}

      <h1 className="font-display text-3xl text-charcoal mb-1">
        {lang === 'es' && recipe.name_es ? recipe.name_es : recipe.name}
      </h1>
      {recipe.name_es && (
        <p className="text-sm italic text-charcoal/50 -mt-1 mb-2">
          {lang === 'es' ? recipe.name : recipe.name_es}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {recipe.kosher_type && (
          <span className="inline-block text-xs font-medium text-charcoal bg-gold-light/30 border border-gold-light/50 px-2.5 py-1 rounded-full">
            {kosherIcon(recipe.kosher_type)} {recipe.kosher_type}
          </span>
        )}
        {recipe.approx_total_minutes && (
          <span className="text-xs font-medium text-charcoal/60 bg-cream border border-gold-light/40 px-2.5 py-1 rounded-full">
            ⏱ {recipe.approx_total_minutes} min
          </span>
        )}
      </div>
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {recipe.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium text-gold-dark bg-gold/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="print:hidden mb-4 flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-full border border-gold-light/60 bg-white p-0.5 text-sm">
          <button
            onClick={() => setView('owner')}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              view === 'owner' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
            }`}
          >
            Owner view
          </button>
          <button
            onClick={() => setView('staff')}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              view === 'staff' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
            }`}
          >
            Staff cook view
          </button>
        </div>
        <div className="inline-flex rounded-full border border-gold-light/60 bg-white p-0.5 text-sm">
          <button
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              lang === 'en' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('es')}
            aria-pressed={lang === 'es'}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              lang === 'es' ? 'bg-gold-dark text-white' : 'text-charcoal/60'
            }`}
          >
            ES
          </button>
        </div>
      </div>

      <SubstitutionCallout
        recipeName={recipeName || recipe.name}
        substitutionNotes={substitutionNotes}
      />

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">
      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-4 print:shadow-none print:border print:border-gold-light">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg text-charcoal">
            {lang === 'es' ? 'Ingredientes' : 'Ingredients'}
          </h2>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => setTargetServings((s) => Math.max(1, (s ?? baseServings) - 1))}
              className="w-7 h-7 rounded-full border border-gold-light/60 text-charcoal text-sm leading-none"
              aria-label="Fewer servings"
            >
              −
            </button>
            <span className="text-sm text-charcoal w-24 text-center">
              {servingsLabel(targetServings ?? baseServings)}
            </span>
            <button
              onClick={() => setTargetServings((s) => (s ?? baseServings) + 1)}
              className="w-7 h-7 rounded-full border border-gold-light/60 text-charcoal text-sm leading-none"
              aria-label="More servings"
            >
              +
            </button>
          </div>
        </div>
        {isScaled && (
          <p className="text-xs text-gold-dark mb-2 print:hidden">
            Scaled from {baseServings} to {targetServings} servings — amounts rounded to the nearest ¼ for easier measuring.
          </p>
        )}
        <p className="hidden print:block text-xs text-charcoal/50 mb-2">
          {lang === 'es' ? 'Rinde' : 'Serves'} {targetServings ?? baseServings}
          {isScaled ? ` (${lang === 'es' ? 'escalado de' : 'scaled from'} ${baseServings})` : ''}
        </p>
        {ingredients.length === 0 ? (
          <p className="text-sm text-charcoal/40">No ingredients recorded for this recipe.</p>
        ) : (
          <div className="space-y-4">
            {ingredientGroups.map((group, groupIdx) => (
              <div key={group.label ?? `_base_${groupIdx}`}>
                {group.label && (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gold-dark mb-1.5">
                    {group.label}
                  </h3>
                )}
                <ul className="space-y-2 divide-y divide-gold-light/15">
                  {group.items.map((i) => (
                    <li key={i.id} className="text-sm text-charcoal pt-2 first:pt-0">
                      <div className="flex gap-2 print:hidden items-start">
                        <input
                          type="checkbox"
                          checked={!!checkedIds[i.id]}
                          onChange={(e) => setCheckedIds((c) => ({ ...c, [i.id]: e.target.checked }))}
                          className={`shrink-0 mt-0.5 accent-gold ${view === 'staff' ? 'h-6 w-6' : 'h-4 w-4'}`}
                          aria-label={`Check off ${i.name}`}
                        />
                        <div className={`flex-1 ${checkedIds[i.id] ? 'opacity-40 line-through' : ''}`}>
                          <div className={view === 'staff' ? 'text-xl' : ''}>{formatQty(i)}</div>
                          <IngredientShoppingLink
                            ingredient={i}
                            recipeNames={[recipe.name]}
                            onAddToList={canManage(role) ? () => addToShoppingList(i) : undefined}
                            addingToList={!!addingToListIds[i.id]}
                          />
                        </div>
                      </div>
                      <div className="hidden print:flex gap-2">
                        <span className="text-gold-dark shrink-0">•</span>
                        {formatQty(i)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        {(hasEnglish || hasSpanish) && (
          <div className="grid grid-cols-1 print:grid-cols-2 gap-4">
            {hasEnglish && (
              <div
                className={`bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 print:shadow-none print:border print:border-gold-light ${
                  lang === 'es' && hasSpanish ? 'hidden print:block' : ''
                }`}
              >
                <h2 className="font-display text-lg text-charcoal mb-2">Instructions</h2>
                <div className="text-sm text-charcoal space-y-2 leading-relaxed">
                  {recipe.instructions_en!.split(' | ').map((step, idx) => (
                    <p key={idx}>
                      <span className="text-gold-dark font-medium">{idx + 1}.</span> {step}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {hasSpanish && (
              <div
                className={`bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 print:shadow-none print:border print:border-gold-light ${
                  lang === 'en' && hasEnglish ? 'hidden print:block' : ''
                }`}
              >
                <h2 className="font-display text-lg text-charcoal mb-2">Instrucciones</h2>
                <div className="text-sm text-charcoal space-y-2 leading-relaxed">
                  {recipe.instructions_es!.split(' | ').map((step, idx) => (
                    <p key={idx}>
                      <span className="text-gold-dark font-medium">{idx + 1}.</span> {step}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!hasEnglish && !hasSpanish && (
          <p className="text-sm text-charcoal/40 text-center mt-4">
            No written instructions on file for this recipe yet.
          </p>
        )}
      </div>
      </div>

      <div className="mt-8 print:hidden space-y-4">
        <RecipeFamilyNotes recipeId={recipeId} initialNotes={recipe.family_notes ?? ''} />
        {canManage(role) && (
          <RecipePrepLeadDays recipeId={recipeId} initialDays={recipe.prep_lead_days} />
        )}
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
