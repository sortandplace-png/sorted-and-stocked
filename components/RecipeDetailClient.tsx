// components/RecipeDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, Share2, History as HistoryIcon, Heart, MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react';
import NewRecipeModal from '@/components/NewRecipeModal';
import { createClient } from '@/lib/supabase/client';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import SubstitutionCallout from '@/components/SubstitutionCallout';
import SubstitutionEditor from '@/components/SubstitutionEditor';
import RecipeHistoryModal from '@/components/RecipeHistoryModal';
import RecipeFamilyNotes from '@/components/RecipeFamilyNotes';
import RecipeKitchenTools from '@/components/RecipeKitchenTools';
import RecipeBracha from '@/components/RecipeBracha';
import RecipePrepLeadDays from '@/components/RecipePrepLeadDays';
import KitchenOpsToolModal, { type KitchenOpsSlug } from '@/components/KitchenOpsToolModal';
import AddToMealPlanButton from '@/components/AddToMealPlanButton';
import type { Course } from '@/lib/course-constants';
import IngredientShoppingLink from '@/components/IngredientShoppingLink';
import { fetchRecipeWithIngredients } from '@/lib/recipe-actions';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { checkRecipeDeletable } from '@/lib/recipe-delete-guard';

// Confirmed each of these has a real page + component before linking to it
// (checked directly against the file system, not assumed) — Kitchen Timer,
// Simcha Guest Scaler, and Reset Checklists were already known-real from
// tonight's Tools Hub work; Prep Timeline specifically was re-verified here
// since it hadn't been checked before.
// Names match the Tools Hub's TOOLS list (app/properties/[id]/tools/page.tsx)
// exactly -- these are two separate hardcoded lists for the same 4 tools, so
// a rename in one and not the other silently produces different labels for
// the same tool depending which page you're on.
const KITCHEN_OPS_LINKS = [
  { slug: 'kitchen-timer', icon: '⏱️', title: 'Kitchen Timer' },
  { slug: 'guest-scaler', icon: '🎉', title: 'Scale Servings' },
  { slug: 'reset-checklist', icon: '🧹', title: 'Reset for Next' },
  { slug: 'prep-timeline', icon: '⏳', title: 'Prep Timeline' },
];
import { formatScaledNumber } from '@/lib/scale-quantity';
import { approxGrams } from '@/lib/metric-conversion';
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
  equipment: string[] | null;
  bracha_category: string | null;
  bracha_achrona: string | null;
  bracha_achrona_note: string | null;
  bracha_needs_sourcing: boolean | null;
  tags: string[] | null;
  approx_total_minutes: number | null;
  prep_lead_days: number | null;
  is_shabbos_only: boolean | null;
  is_yom_tov: boolean | null;
  is_pesach: boolean | null;
}

type Occasion = 'shabbos' | 'yomtov' | 'pesach' | 'weekday';

// Same occasion definition RecipesGridView.tsx's filter pills use — a
// recipe can carry more than one flag at once (e.g. Pesach + Shabbos), so
// this returns a set, not a single value; "weekday" only applies when none
// of the three real flags are set.
function occasionSet(r: { is_shabbos_only?: boolean | null; is_yom_tov?: boolean | null; is_pesach?: boolean | null }): Set<Occasion> {
  const set = new Set<Occasion>();
  if (r.is_shabbos_only) set.add('shabbos');
  if (r.is_yom_tov) set.add('yomtov');
  if (r.is_pesach) set.add('pesach');
  if (set.size === 0) set.add('weekday');
  return set;
}

function sharesOccasion(a: Set<Occasion>, b: Set<Occasion>): boolean {
  for (const o of a) if (b.has(o)) return true;
  return false;
}

interface PairSuggestion {
  id: string;
  name: string;
  photo_url: string | null;
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
  const router = useRouter();
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
  const [openKitchenOpsTool, setOpenKitchenOpsTool] = useState<KitchenOpsSlug | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pairsWellWith, setPairsWellWith] = useState<PairSuggestion[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const [deleteBlockMessage, setDeleteBlockMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { recipe: recipeData, ingredients: ingredientData } = await fetchRecipeWithIngredients(recipeId);
        setRecipe(recipeData);
        setIngredients(ingredientData);
        setTargetServings(recipeData?.servings ?? 4);
      } catch (err) {
        // Was previously swallowed entirely -- couldn't diagnose past
        // reports of this error with nothing in the console to go on.
        console.error('Failed to load recipe:', err);
        setError('Could not load this recipe.');
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId]);

  // "Pairs well with": recipes from a DIFFERENT course that share at least
  // one occasion with this one (both Shabbos, both Weekday, etc.) --
  // approximates what would actually go on the same table. Falls back to
  // same-occasion regardless of course if that first pass comes up short,
  // rather than showing nothing. Verified against a real Shabbos soup
  // recipe before considering this done (36 real Shabbos mains/sides/
  // desserts came back, not other soups).
  useEffect(() => {
    if (!recipe) return;
    (async () => {
      const { data } = await supabase
        .from('recipes')
        .select('id, name, photo_url, course, is_shabbos_only, is_yom_tov, is_pesach, recipe_property_links!inner(property_id)')
        .eq('recipe_property_links.property_id', propertyId)
        .neq('id', recipeId);

      const candidates = data ?? [];
      const currentOccasions = occasionSet(recipe);

      const differentCourseMatches = candidates.filter(
        (c) => c.course !== recipe.course && sharesOccasion(occasionSet(c), currentOccasions)
      );

      let pool = differentCourseMatches;
      if (pool.length < 2) {
        const anyOccasionMatches = candidates.filter((c) => sharesOccasion(occasionSet(c), currentOccasions));
        const seen = new Set(pool.map((p) => p.id));
        for (const c of anyOccasionMatches) {
          if (!seen.has(c.id)) {
            pool.push(c);
            seen.add(c.id);
          }
        }
      }

      // Shuffle so repeat visits surface variety instead of always the
      // same alphabetically-first 4 (e.g. desserts) out of a larger pool.
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      setPairsWellWith(
        shuffled.slice(0, 4).map((c) => ({ id: c.id, name: c.name, photo_url: c.photo_url, course: c.course }))
      );
    })();
  }, [recipe, recipeId, propertyId, supabase]);

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

  async function duplicateRecipe() {
    if (!recipe) return;
    setDuplicating(true);

    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        property_id: propertyId,
        name: `${recipe.name} (Copy)`,
        name_es: recipe.name_es,
        servings: recipe.servings,
        course: recipe.course,
        kosher_type: recipe.kosher_type,
        instructions_en: recipe.instructions_en,
        instructions_es: recipe.instructions_es,
        tags: recipe.tags,
        approx_total_minutes: recipe.approx_total_minutes,
      })
      .select('id')
      .single();

    if (recipeError || !newRecipe) {
      setDuplicating(false);
      showToast('Failed to duplicate recipe.', { variant: 'error' });
      return;
    }

    if (ingredients.length > 0) {
      await supabase.from('recipe_ingredients').insert(
        ingredients.map((i) => ({
          recipe_id: newRecipe.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          section_label: i.section_label ?? null,
        }))
      );
    }

    setDuplicating(false);
    showToast('Recipe duplicated.', { variant: 'success' });
    router.push(`/properties/${propertyId}/recipes/${newRecipe.id}`);
  }

  async function deleteRecipeConfirmed() {
    setDeleting(true);
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    const { error: deleteError } = await supabase.from('recipes').delete().eq('id', recipeId);

    if (deleteError) {
      setDeleting(false);
      showToast('Failed to delete recipe.', { variant: 'error' });
      return;
    }

    showToast('Recipe deleted.', { variant: 'success' });
    router.push(`/properties/${propertyId}/recipes`);
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
    const base = [formatScaledNumber(scaledQty), i.unit, i.name].filter(Boolean).join(' ');
    const grams = approxGrams(scaledQty, i.unit, i.name);
    return grams != null ? `${base} (approx ${grams}g)` : base;
  }

  async function addToShoppingList(i: Ingredient) {
    setAddingToListIds((prev) => ({ ...prev, [i.id]: true }));
    // Same scaling formatQty() already applies for display -- without this,
    // scaling a recipe to 8 servings and adding an ingredient still queued
    // the original 4-serving amount, silently discarding the scale-up.
    const scaledQuantity = i.quantity == null ? null : i.quantity * scaleFactor;
    const result = await addIngredientsToShoppingList(supabase, propertyId, [
      {
        name: i.name,
        category: i.category,
        quantity: scaledQuantity,
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
    <div className="max-w-md lg:max-w-6xl mx-auto p-4 print:max-w-full">
      <div className="flex items-center justify-between mb-4 print:hidden gap-2 flex-wrap">
        {/* Recipes is always reachable regardless of entry point (recipe
            grid, meal-plan substitution swap, or the global Command
            Palette search, which can launch from any page) — Meal plan
            stays as a second, always-visible shortcut alongside it rather
            than something that only makes sense from one path in. */}
        <div className="flex items-center gap-3">
          <Link href={`/properties/${propertyId}/recipes`} className="text-sm text-charcoal font-medium">
            ← Recipes
          </Link>
          <span className="text-charcoal/20" aria-hidden="true">•</span>
          <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-charcoal/60 font-medium">
            Meal plan
          </Link>
        </div>
        <div className="flex gap-2">
          {currentUserId && (
            <button
              onClick={toggleFavorite}
              className="w-11 h-11 -m-1 flex items-center justify-center"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <span className="w-9 h-9 flex items-center justify-center rounded-full border border-gold-light/60 hover:bg-gold-light/10 transition">
                <Heart
                  className={isFavorite ? 'w-4 h-4 fill-gold text-gold' : 'w-4 h-4 text-charcoal/40'}
                  strokeWidth={1.75}
                />
              </span>
            </button>
          )}
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

          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              aria-label="More actions"
              aria-expanded={showMenu}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-gold-light/60 hover:bg-gold-light/10 transition"
            >
              <MoreVertical size={16} strokeWidth={1.75} />
            </button>

            {showMenu && (
              <>
                {/* Click-outside catcher */}
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-12 z-20 bg-white rounded-2xl shadow-lg shadow-charcoal/10 border border-gold-light/40 w-48 overflow-hidden">
                  {canManage(role) && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowEditModal(true);
                      }}
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-charcoal hover:bg-gold-light/10 transition"
                    >
                      <Pencil size={14} strokeWidth={1.75} /> Edit
                    </button>
                  )}
                  {canManage(role) && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        duplicateRecipe();
                      }}
                      disabled={duplicating}
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-charcoal hover:bg-gold-light/10 transition disabled:opacity-40"
                    >
                      <Copy size={14} strokeWidth={1.75} /> {duplicating ? 'Duplicating…' : 'Duplicate'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      window.print();
                    }}
                    className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-charcoal hover:bg-gold-light/10 transition"
                  >
                    <Printer size={14} strokeWidth={1.75} /> Print
                  </button>
                  {canManage(role) && (
                    <button
                      onClick={async () => {
                        setShowMenu(false);
                        setCheckingDelete(true);
                        const check = await checkRecipeDeletable(supabase, recipeId);
                        setCheckingDelete(false);
                        if (!check.deletable) {
                          setDeleteBlockMessage(check.message);
                        } else {
                          setConfirmingDelete(true);
                        }
                      }}
                      disabled={checkingDelete}
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-rust hover:bg-rust/5 transition border-t border-gold-light/40 disabled:opacity-40"
                    >
                      <Trash2 size={14} strokeWidth={1.75} /> {checkingDelete ? 'Checking…' : 'Delete'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {deleteBlockMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setDeleteBlockMessage(null)}>
          <div className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-charcoal mb-1">Can't delete this recipe</h2>
            <p className="text-sm text-charcoal/60 mb-4">{deleteBlockMessage}</p>
            <button
              onClick={() => setDeleteBlockMessage(null)}
              className="w-full py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setConfirmingDelete(false)}>
          <div className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-charcoal mb-1">Delete this recipe?</h2>
            <p className="text-sm text-charcoal/60 mb-4">
              "{recipe.name}" and its ingredient list will be permanently deleted. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2.5 rounded-full bg-cream border border-charcoal/30 text-charcoal"
              >
                Cancel
              </button>
              <button
                onClick={deleteRecipeConfirmed}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-rust text-white disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <NewRecipeModal
          propertyId={propertyId}
          editRecipeId={recipeId}
          initialName={recipe.name}
          initialServings={recipe.servings}
          initialCourse={(recipe.course as Course) ?? undefined}
          initialIngredients={ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity != null ? String(i.quantity) : '',
            unit: i.unit ?? '',
            category: i.category ?? '',
          }))}
          initialNameEs={recipe.name_es}
          initialKosherType={recipe.kosher_type}
          initialInstructionsEn={recipe.instructions_en}
          initialTags={recipe.tags}
          initialEquipment={recipe.equipment}
          initialApproxTotalMinutes={recipe.approx_total_minutes}
          initialPrepLeadDays={recipe.prep_lead_days}
          initialIsShabbosOnly={recipe.is_shabbos_only}
          initialIsYomTov={recipe.is_yom_tov}
          initialIsPesach={recipe.is_pesach}
          initialPhotoUrl={recipe.photo_url}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            router.refresh();
            // Re-fetch so the on-page ingredient list/details reflect edits
            // immediately instead of waiting on the next full navigation.
            (async () => {
              const { recipe: recipeData, ingredients: ingredientData } = await fetchRecipeWithIngredients(recipeId);
              setRecipe(recipeData);
              setIngredients(ingredientData);
            })();
          }}
        />
      )}

      {showHistory && <RecipeHistoryModal recipeId={recipeId} onClose={() => setShowHistory(false)} />}

      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      <div className="lg:col-span-2">
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
            <span
              key={tag}
              className={
                tag === 'NEW'
                  ? 'text-[10px] font-medium text-cream bg-gold px-2 py-0.5 rounded-full'
                  : 'text-[10px] font-medium text-gold-dark bg-gold/10 px-2 py-0.5 rounded-full'
              }
            >
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
      <div className="bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 mb-4 print:shadow-none print:border print:border-gold-light">
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
                        <label className="flex items-center justify-center w-11 h-11 -m-3 -mt-3.5 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!checkedIds[i.id]}
                            onChange={(e) => setCheckedIds((c) => ({ ...c, [i.id]: e.target.checked }))}
                            className={`accent-gold ${view === 'staff' ? 'h-6 w-6' : 'h-4 w-4'}`}
                            aria-label={`Check off ${i.name}`}
                          />
                        </label>
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
                className={`bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:shadow-none print:border print:border-gold-light ${
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
                className={`bg-white rounded-xl2 shadow-sm shadow-charcoal/5 p-5 print:shadow-none print:border print:border-gold-light ${
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
      </div>

      <div className="lg:col-span-1 space-y-4 mt-8 lg:mt-0 print:hidden">
        <RecipeBracha
          recipeId={recipeId}
          initialCategory={recipe.bracha_category}
          achrona={recipe.bracha_achrona}
          achronaNote={recipe.bracha_achrona_note}
          needsSourcing={!!recipe.bracha_needs_sourcing}
        />
        <RecipeFamilyNotes recipeId={recipeId} propertyId={propertyId} />
        <RecipeKitchenTools recipeId={recipeId} propertyId={propertyId} initialEquipment={recipe.equipment ?? []} />
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

      <div className="mt-8 print:hidden">
        <h2 className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-2">Kitchen Ops</h2>
        {/* Same real tokens as the Tools Hub redesign (white card, rounded-xl2,
            gold-dark circular badge, charcoal heading), sized down for a
            footer dock living inside an already-long recipe page rather than
            a full page of its own -- not extracted as a shared component
            with Tools Hub's card since the two contexts genuinely need
            different sizing, and there are only these two call sites. Fixed
            2-col grid rather than 3-at-sm: with exactly 4 items, 3-per-row
            leaves an awkward 3+1 split; 2x2 stays clean at every width. */}
        {/* Opens as a modal over this recipe rather than navigating away --
            confirmed live that all 4 previously used a plain <Link> to a
            full page route with no way back except the browser's native
            back button. The Tools Hub page's own versions of these same
            tools (app/properties/[id]/tools/page.tsx) are untouched and
            still navigate normally, since a standalone-page launch has
            nothing to "get back to." */}
        <div className="grid grid-cols-2 gap-2">
          {KITCHEN_OPS_LINKS.map((tool) => (
            <button
              key={tool.slug}
              onClick={() => setOpenKitchenOpsTool(tool.slug as KitchenOpsSlug)}
              className="flex flex-col items-center text-center gap-2 bg-white rounded-xl2 shadow-sm shadow-charcoal/5 px-3 py-4 hover:shadow-md hover:shadow-charcoal/10 transition-shadow"
            >
              <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-gold/15 text-lg" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="text-xs font-bold text-charcoal">{tool.title}</span>
            </button>
          ))}
        </div>
      </div>

      {openKitchenOpsTool && (
        <KitchenOpsToolModal
          slug={openKitchenOpsTool}
          propertyId={propertyId}
          onClose={() => setOpenKitchenOpsTool(null)}
          recipeName={recipe.name}
          recipeMinutes={recipe.approx_total_minutes}
        />
      )}

      {pairsWellWith.length > 0 && (
        <div className="mt-8 print:hidden">
          <h2 className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-2">Pairs well with</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pairsWellWith.map((s) => (
              <Link
                key={s.id}
                href={`/properties/${propertyId}/recipes/${s.id}`}
                className="shrink-0 w-32 bg-white rounded-xl border border-gold-light/40 shadow-sm shadow-charcoal/5 overflow-hidden hover:border-gold transition-colors"
              >
                <div className="w-full h-20 bg-cream flex items-center justify-center">
                  {s.photo_url && isDirectImageUrl(s.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-charcoal/20">🍽️</span>
                  )}
                </div>
                <p className="p-2 text-xs font-medium text-charcoal leading-snug line-clamp-2">{s.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
