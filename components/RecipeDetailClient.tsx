// components/RecipeDetailClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALE_COOKIE } from '@/i18n/locale-constants';
import { Printer, Share2, History as HistoryIcon, Heart, MoreVertical, Pencil, Copy, Trash2, Timer, Scale, RotateCcw, ListChecks } from 'lucide-react';
import NewRecipeModal from '@/components/NewRecipeModal';
import { createClient } from '@/lib/supabase/client';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import SubstitutionCallout from '@/components/SubstitutionCallout';
import SubstitutionEditor from '@/components/SubstitutionEditor';
import RecipeHistoryModal from '@/components/RecipeHistoryModal';
import RecipeFamilyNotes from '@/components/RecipeFamilyNotes';
import RecipeNotes from '@/components/RecipeNotes';
import RecipeKitchenTools from '@/components/RecipeKitchenTools';
import RecipeBracha from '@/components/RecipeBracha';
import RecipePrepLeadDays from '@/components/RecipePrepLeadDays';
import KitchenOpsToolModal, { type KitchenOpsSlug } from '@/components/KitchenOpsToolModal';
import AddToMealPlanButton from '@/components/AddToMealPlanButton';
import { COURSES, type Course } from '@/lib/course-constants';
import IngredientShoppingLink from '@/components/IngredientShoppingLink';
import { fetchRecipeWithIngredients } from '@/lib/recipe-actions';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { classifyProvenance, PROVENANCE_INFO } from '@/lib/recipe-provenance';
import { addIngredientsToShoppingList } from '@/lib/shopping-list-actions';
import { checkRecipeDeletable } from '@/lib/recipe-delete-guard';
import { bedikasTolaimIngredients, BEDIKAS_TOLAIM_NOTE } from '@/lib/bedikas-tolaim';

// Confirmed each of these has a real page + component before linking to it
// (checked directly against the file system, not assumed) — Kitchen Timer,
// Simcha Guest Scaler, and Reset Checklists were already known-real from
// tonight's Tools Hub work; Prep Timeline specifically was re-verified here
// since it hadn't been checked before.
// Names match the Tools Hub's TOOLS list (app/properties/[id]/tools/page.tsx)
// exactly -- these are two separate hardcoded lists for the same 4 tools, so
// a rename in one and not the other silently produces different labels for
// the same tool depending which page you're on.
// Same 4 tools, same Lucide icons /sitemap already uses for them (Timer,
// Scale, RotateCcw, ListChecks) -- was emoji, a different icon language
// than the rest of the app's real icon-tile system.
const KITCHEN_OPS_LINKS = [
  { slug: 'kitchen-timer', icon: Timer, titleKey: 'kitchenOpsTools.kitchenTimer' },
  { slug: 'guest-scaler', icon: Scale, titleKey: 'kitchenOpsTools.scaleServings' },
  { slug: 'reset-checklist', icon: RotateCcw, titleKey: 'kitchenOpsTools.resetForNext' },
  { slug: 'prep-timeline', icon: ListChecks, titleKey: 'kitchenOpsTools.prepTimeline' },
];
import { formatScaledNumber } from '@/lib/scale-quantity';
import { formatMinutes } from '@/lib/format-time';
import { approxGrams } from '@/lib/metric-conversion';
import { useToast } from '@/components/Toast';
import { SITE_URL } from '@/lib/site-url';

// Same kosher-type color mapping as the Recipes grid card
// (components/recipes/RecipesGridView.tsx) -- kept as its own copy rather
// than a shared import since it's a small, stable 3-entry lookup with only
// these two call sites.
const KOSHER_PILL_COLORS: Record<string, string> = {
  Meat: 'bg-rust/10 text-rust border-rust/20',
  Dairy: 'bg-dairy/10 text-dairy border-dairy/20',
  Parve: 'bg-sage/10 text-sage border-sage/20',
};

function kosherPillClass(kosherType: string) {
  const base = kosherType.startsWith('Parve') ? 'Parve' : kosherType;
  return KOSHER_PILL_COLORS[base] ?? 'bg-mist text-denim border-cardBorder';
}

interface Ingredient {
  id: string;
  name: string;
  name_es?: string | null;
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
  notes: string | null;
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
  const searchParams = useSearchParams();
  const showToast = useToast();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetServings, setTargetServings] = useState<number | null>(null);
  const [view, setView] = useState<'owner' | 'staff'>(role === 'staff' ? 'staff' : 'owner');
  // Reads the same sns_locale cookie the nav's global LocaleToggle writes,
  // so this page's language follows the site-wide toggle instead of always
  // resetting to English on load (the previous bug: local-only state that
  // never read the global locale at all).
  const locale = useLocale();
  const lang = locale as 'en' | 'es';
  function setLang(next: 'en' | 'es') {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    router.refresh();
  }
  // SS-132: "Owner view" / "Staff cook view" / the provenance badges were
  // hardcoded English, rendering unchanged in ES mode. tTags/tKosher use
  // try/catch, not t.has(), so a real tag or kosher_type value that isn't
  // in the map yet degrades to showing the raw value instead of throwing
  // and breaking the whole page (next-intl throws on a missing key, it
  // doesn't return undefined -- same root cause as the nothingOnList bug).
  const t = useTranslations('recipeDetail');
  const tTags = useTranslations('recipeTags');
  const tKosher = useTranslations('kosherType');
  function tagLabel(tag: string): string {
    try {
      return tTags(tag);
    } catch {
      return tag;
    }
  }
  function kosherTypeLabel(value: string): string {
    const key = value.toLowerCase().startsWith('parve') ? 'parve' : value.toLowerCase();
    try {
      return tKosher(key);
    } catch {
      return value;
    }
  }
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [brokenIngredientPhotoIds, setBrokenIngredientPhotoIds] = useState<Set<string>>(new Set());
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
        const { recipe: recipeData, ingredients: ingredientData } = await fetchRecipeWithIngredients(recipeId, propertyId);
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

  // Lets the Recipes grid's mobile card menu jump straight into editing
  // (?edit=1) instead of duplicating this modal's initial* data-fetch there
  // with a partial recipe object -- this component already has the full
  // record loaded, so it's the safe place to own the edit flow.
  useEffect(() => {
    if (searchParams.get('edit') === '1' && recipe && canManage(role)) {
      setShowEditModal(true);
      router.replace(`/properties/${propertyId}/recipes/${recipeId}`, { scroll: false });
    }
  }, [searchParams, recipe, role, propertyId, recipeId, router]);

  // "Pairs well with": Racquel's real meal-completion rule, not a generic
  // "different course, same occasion" grab-bag (the old version could and
  // did surface two proteins and a dressing under a vege recipe -- nothing
  // stopped it). Each course names the exact 3 courses that complete a
  // real meal around it; soup is the one optional 4th add-on everywhere
  // except its own row (a soup recipe doesn't suggest another soup as a
  // bonus). Courses with no defined meal-completion role (dessert, dip,
  // kids_platter) show nothing here rather than a made-up rule.
  const PAIRING_RULES: Partial<Record<Course, Course[]>> = {
    soup: ['protein', 'starch', 'vege'],
    vege: ['protein', 'starch', 'salad'],
    protein: ['starch', 'vege', 'salad'],
    starch: ['protein', 'vege', 'salad'],
    salad: ['protein', 'starch', 'vege'],
  };
  useEffect(() => {
    if (!recipe) return;
    (async () => {
      // Real bug found live: is_pesach doesn't mean "Pesach-seasonal" the
      // way is_shabbos_only means "Shabbos-only" -- it means "kosher/
      // appropriate for Pesach," which a large fraction of ordinary
      // everyday recipes also carry (confirmed live: "Dried Fruit," a
      // plain side dish, is genuinely is_pesach=true, same as "Pesach
      // Chocolate Cupcakes," an actually Pesach-seasonal recipe --
      // occasionSet() can't tell those two cases apart from the boolean
      // alone). Suggesting a seasonal Pesach dessert under a July side dish
      // is wrong regardless of what technically shares the flag. Excluded
      // from the general pool unless Pesach Mode is on for this property,
      // or the real next Pesach (yom_tov_dates, not a new date engine) is
      // within 30 days.
      const [{ data }, { data: propertyRow }, { data: pesachDates }] = await Promise.all([
        supabase
          .from('recipes')
          .select('id, name, photo_url, course, is_shabbos_only, is_yom_tov, is_pesach, recipe_property_links!inner(property_id)')
          .eq('recipe_property_links.property_id', propertyId)
          .neq('id', recipeId),
        supabase.from('properties').select('feature_flags').eq('id', propertyId).single(),
        supabase
          .from('yom_tov_dates')
          .select('date')
          .ilike('holiday_name', 'Pesach%')
          .gte('date', new Date().toISOString().slice(0, 10))
          .order('date')
          .limit(1),
      ]);

      const pesachModeOn = !!(propertyRow?.feature_flags as Record<string, boolean> | null)?.pesach_mode;
      const nextPesach = pesachDates?.[0]?.date ? new Date(pesachDates[0].date) : null;
      const daysToPesach = nextPesach ? (nextPesach.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : Infinity;
      const nearPesach = daysToPesach >= 0 && daysToPesach <= 30;
      const allowPesach = pesachModeOn || nearPesach;

      const rawCandidates = data ?? [];
      const candidates = allowPesach ? rawCandidates : rawCandidates.filter((c) => !c.is_pesach);
      const currentOccasions = occasionSet(recipe);

      const requiredCourses = PAIRING_RULES[recipe.course as Course];
      if (!requiredCourses) {
        // No defined meal-completion role for this recipe's own course
        // (dessert, dip, kids_platter) -- nothing grounded to suggest, so
        // nothing renders, same "no rule, no badge" standard as provenance.
        setPairsWellWith([]);
        return;
      }

      // One random pick per required course, occasion-matched -- HARD rule,
      // no fallback. Previously fell back to any occasion within the same
      // course when no same-occasion match existed, which is exactly what
      // produced the reported bug (a Pesach recipe suggesting a non-Pesach
      // pairing): "far more likely to be filled" was silently filling a
      // slot with a wrong-occasion suggestion. Per audit item [7]: "A
      // Pesach recipe pairs only with Pesach recipes. Same for
      // is_shabbos_only and is_yom_tov" -- no exceptions. A course with no
      // same-occasion candidate now simply has no pick, rather than a wrong one.
      function pickForCourse(course: Course, excludeIds: Set<string>) {
        const inCourse = candidates.filter((c) => c.course === course && !excludeIds.has(c.id));
        const sameOccasion = inCourse.filter((c) => sharesOccasion(occasionSet(c), currentOccasions));
        if (sameOccasion.length === 0) return null;
        return sameOccasion[Math.floor(Math.random() * sameOccasion.length)];
      }

      const usedIds = new Set<string>([recipeId]);
      const picks: NonNullable<ReturnType<typeof pickForCourse>>[] = [];
      for (const course of requiredCourses) {
        const pick = pickForCourse(course, usedIds);
        if (pick) {
          picks.push(pick);
          usedIds.add(pick.id);
        }
      }

      // Soup is the one optional 4th add-on, and only once all 3 required
      // slots are actually filled -- an extra only makes sense once the
      // meal's real requirements are covered. A soup recipe doesn't get a
      // bonus soup suggested under itself.
      if (recipe.course !== 'soup' && picks.length === requiredCourses.length) {
        const soupPick = pickForCourse('soup', usedIds);
        if (soupPick) picks.push(soupPick);
      }

      const courseOrderIndex = new Map(COURSES.map((c, i) => [c.key, i]));
      const ordered = picks.sort(
        (a, b) => (courseOrderIndex.get(a.course as Course) ?? 99) - (courseOrderIndex.get(b.course as Course) ?? 99)
      );
      setPairsWellWith(ordered.map((c) => ({ id: c.id, name: c.name, photo_url: c.photo_url, course: c.course })));
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

  const bedikahIngredients = bedikasTolaimIngredients(ingredients.map((i) => i.name));

  const baseServings = recipe?.servings ?? 4;
  const scaleFactor = targetServings ? targetServings / baseServings : 1;
  const isScaled = targetServings !== null && targetServings !== baseServings;

  function servingsLabel(n: number) {
    if (lang === 'es') return n === 1 ? '1 porción' : `${n} porciones`;
    return `${n} serving${n === 1 ? '' : 's'}`;
  }

  // SS-146: falls back to the English name whenever name_es is null, same
  // convention as the recipe-name/instructions toggles above -- never
  // renders blank. approxGrams() below stays on the raw English i.name
  // deliberately: it's a weight-estimation lookup against English keyword
  // matching (e.g. "egg" -> ~50g), not a display value, so localizing it
  // would silently break the match instead of translating anything a user
  // sees.
  function displayIngredientName(i: Ingredient) {
    return lang === 'es' && i.name_es ? i.name_es : i.name;
  }

  function formatQty(i: Ingredient) {
    if (i.quantity == null) {
      // Nothing to scale — the amount is baked into the name text itself
      // (e.g. "2 segmented grapefruits") or it's a to-taste item.
      return [i.unit, displayIngredientName(i)].filter(Boolean).join(' ');
    }
    const scaledQty = i.quantity * scaleFactor;
    const base = [formatScaledNumber(scaledQty), i.unit, displayIngredientName(i)].filter(Boolean).join(' ');
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
    return <div className="max-w-md mx-auto p-4 text-sm text-dusk">Loading recipe…</div>;
  }

  if (error || !recipe) {
    return (
      <div className="max-w-md mx-auto p-4">
        <p className="text-sm text-rust">{error ?? 'Recipe not found.'}</p>
        <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-denim mt-2 inline-block">
          ← Back to meal plan
        </Link>
      </div>
    );
  }

  const hasSpanish = !!recipe.instructions_es;
  const hasEnglish = !!recipe.instructions_en;

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4 print:max-w-full bg-mist">
      <div className="flex items-center justify-between mb-4 print:hidden gap-2 flex-wrap">
        {/* Recipes is always reachable regardless of entry point (recipe
            grid, meal-plan substitution swap, or the global Command
            Palette search, which can launch from any page) — Meal plan
            stays as a second, always-visible shortcut alongside it rather
            than something that only makes sense from one path in. */}
        <div className="flex items-center gap-3">
          <Link href={`/properties/${propertyId}/recipes`} className="text-sm text-denim font-medium">
            ← Recipes
          </Link>
          <span className="text-dusk" aria-hidden="true">•</span>
          <Link href={`/properties/${propertyId}/meal-plan`} className="text-sm text-dusk font-medium">
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
              <span className="w-9 h-9 flex items-center justify-center rounded-full border border-brass/30 hover:bg-mist transition">
                <Heart
                  className={isFavorite ? 'w-4 h-4 fill-brass text-brass' : 'w-4 h-4 text-dusk'}
                  strokeWidth={1.75}
                />
              </span>
            </button>
          )}
          <button
            onClick={async () => {
              // SITE_URL, not window.location.origin -- a recipe shared from
              // a local dev session would otherwise hand someone a
              // localhost link that fails to open for them.
              const url = `${SITE_URL}/properties/${propertyId}/recipes/${recipeId}`;
              if (navigator.share) {
                await navigator.share({ title: recipe.name, url });
              } else {
                await navigator.clipboard.writeText(url);
              }
            }}
            className="text-sm font-medium bg-denim text-white px-4 py-2 rounded-full hover:opacity-90 transition flex items-center gap-1.5"
          >
            <Share2 size={14} strokeWidth={1.75} /> Share
          </button>
          {canManage(role) && (
            <button
              onClick={() => setShowHistory(true)}
              className="text-sm font-medium border border-brass/30 text-dusk px-4 py-2 rounded-full hover:bg-mist transition flex items-center gap-1.5"
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
              className="w-11 h-11 flex items-center justify-center rounded-full border border-brass/30 hover:bg-mist transition"
            >
              <MoreVertical size={16} strokeWidth={1.75} />
            </button>

            {showMenu && (
              <>
                {/* Click-outside catcher */}
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-12 z-20 bg-card rounded-2xl shadow-cardHover border border-cardBorder w-48 overflow-hidden">
                  {canManage(role) && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowEditModal(true);
                      }}
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-denim hover:bg-mist transition"
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
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-denim hover:bg-mist transition disabled:opacity-40"
                    >
                      <Copy size={14} strokeWidth={1.75} /> {duplicating ? 'Duplicating…' : 'Duplicate'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      window.print();
                    }}
                    className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-denim hover:bg-mist transition"
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
                      className="w-full min-h-11 flex items-center gap-2 px-4 text-sm text-rust hover:bg-rust/5 transition border-t border-cardBorder disabled:opacity-40"
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
          <div className="bg-card w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-denim mb-1">Can't delete this recipe</h2>
            <p className="text-sm text-dusk mb-4">{deleteBlockMessage}</p>
            <button
              onClick={() => setDeleteBlockMessage(null)}
              className="w-full py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4" onClick={() => setConfirmingDelete(false)}>
          <div className="bg-card w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-denim mb-1">Delete this recipe?</h2>
            <p className="text-sm text-dusk mb-4">
              "{recipe.name}" and its ingredient list will be permanently deleted. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
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
            nameEs: i.name_es ?? '',
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
              const { recipe: recipeData, ingredients: ingredientData } = await fetchRecipeWithIngredients(recipeId, propertyId);
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
          className="w-full h-64 sm:h-80 object-cover rounded-3xl border border-cardBorder shadow-sm mb-4 print:h-32"
        />
      ) : (
        <div className="w-full h-64 sm:h-80 rounded-3xl border border-cardBorder bg-mist flex items-center justify-center mb-4 print:hidden">
          {(() => {
            const Icon = getRecipeIcon(recipe.course);
            return <Icon className="w-16 h-16 text-brass/50" strokeWidth={1.25} />;
          })()}
        </div>
      )}

      <h1 className="font-display text-3xl text-denim mb-1">
        {lang === 'es' && recipe.name_es ? recipe.name_es : recipe.name}
      </h1>
      {recipe.name_es && (
        <p className="text-sm italic text-dusk -mt-1 mb-2">
          {lang === 'es' ? recipe.name : recipe.name_es}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        {recipe.kosher_type && (
          <span className={`inline-block text-xs font-medium border px-2.5 py-1 rounded-full ${kosherPillClass(recipe.kosher_type)}`}>
            {kosherIcon(recipe.kosher_type)} {kosherTypeLabel(recipe.kosher_type)}
          </span>
        )}
        {recipe.approx_total_minutes && (
          <span className="text-xs font-medium text-dusk bg-linen border border-cardBorder px-2.5 py-1 rounded-full">
            ⏱ {formatMinutes(recipe.approx_total_minutes, lang)}
          </span>
        )}
        {/* Manager-only: real content provenance, derived from the recipes
            already-populated notes field (see lib/recipe-provenance.ts) --
            not a new audit, just surfacing what real recipe-import work
            already left behind. Staff don't need to see this. */}
        {canManage(role) &&
          (() => {
            const category = classifyProvenance(recipe.notes);
            if (!category) return null;
            const info = PROVENANCE_INFO[category];
            return (
              <span className={`text-xs px-2.5 py-1 rounded-full ${info.badgeClass}`}>{t(info.labelKey)}</span>
            );
          })()}
      </div>
      {recipe.tags && recipe.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className={
                tag === 'NEW'
                  ? 'text-[10px] font-medium text-white bg-denim px-2 py-0.5 rounded-full'
                  : 'text-[10px] font-medium text-brass bg-mist px-2 py-0.5 rounded-full'
              }
            >
              {tagLabel(tag)}
            </span>
          ))}
        </div>
      )}

      <div className="print:hidden mb-4 flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-full border border-cardBorder bg-card p-0.5 text-sm">
          <button
            onClick={() => setView('owner')}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              view === 'owner' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            {t('ownerView')}
          </button>
          <button
            onClick={() => setView('staff')}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              view === 'staff' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            {t('staffCookView')}
          </button>
        </div>
        <div className="inline-flex rounded-full border border-cardBorder bg-card p-0.5 text-sm">
          <button
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              lang === 'en' ? 'bg-denim text-white' : 'text-dusk'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('es')}
            aria-pressed={lang === 'es'}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              lang === 'es' ? 'bg-denim text-white' : 'text-dusk'
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
      <div className="bg-card rounded-xl2 shadow-card p-5 mb-4 print:shadow-none print:border print:border-cardBorder">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg text-denim">
            {lang === 'es' ? 'Ingredientes' : 'Ingredients'}
          </h2>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => setTargetServings((s) => Math.max(1, (s ?? baseServings) - 1))}
              className="w-7 h-7 rounded-full border border-brass/30 text-denim text-sm leading-none"
              aria-label="Fewer servings"
            >
              −
            </button>
            <span className="text-sm text-denim w-24 text-center">
              {servingsLabel(targetServings ?? baseServings)}
            </span>
            <button
              onClick={() => setTargetServings((s) => (s ?? baseServings) + 1)}
              className="w-7 h-7 rounded-full border border-brass/30 text-denim text-sm leading-none"
              aria-label="More servings"
            >
              +
            </button>
          </div>
        </div>
        {isScaled && (
          <p className="text-xs text-brass mb-2 print:hidden">
            Scaled from {baseServings} to {targetServings} servings — amounts rounded to the nearest ¼ for easier measuring.
          </p>
        )}
        <p className="hidden print:block text-xs text-dusk mb-2">
          {lang === 'es' ? 'Rinde' : 'Serves'} {targetServings ?? baseServings}
          {isScaled ? ` (${lang === 'es' ? 'escalado de' : 'scaled from'} ${baseServings})` : ''}
        </p>
        {bedikahIngredients.length > 0 && (
          <div className="bg-sage/10 border border-sage/20 rounded-xl px-3 py-2 mb-3 print:hidden">
            <p className="text-xs font-medium text-denim mb-0.5">
              🔎 Bedikas Tolaim: {bedikahIngredients.join(', ')}
            </p>
            <p className="text-xs text-dusk">{BEDIKAS_TOLAIM_NOTE}</p>
          </div>
        )}
        {ingredients.length === 0 ? (
          <p className="text-sm text-dusk">No ingredients recorded for this recipe.</p>
        ) : (
          <div className="space-y-4">
            {ingredientGroups.map((group, groupIdx) => (
              <div key={group.label ?? `_base_${groupIdx}`}>
                {group.label && (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-brass mb-1.5">
                    {group.label}
                  </h3>
                )}
                <ul className="space-y-2 divide-y divide-cardBorder">
                  {group.items.map((i) => (
                    <li key={i.id} className="text-sm text-denim pt-2 first:pt-0">
                      <div className="flex gap-2 print:hidden items-start">
                        <label className="flex items-center justify-center w-11 h-11 -m-3 -mt-3.5 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!checkedIds[i.id]}
                            onChange={(e) => setCheckedIds((c) => ({ ...c, [i.id]: e.target.checked }))}
                            className={`accent-brass ${view === 'staff' ? 'h-6 w-6' : 'h-4 w-4'}`}
                            aria-label={`Check off ${displayIngredientName(i)}`}
                          />
                        </label>
                        {i.photo_url && !brokenIngredientPhotoIds.has(i.id) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={i.photo_url}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover shrink-0 bg-mist mt-0.5"
                            onError={() => setBrokenIngredientPhotoIds((prev) => new Set(prev).add(i.id))}
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-mist shrink-0 mt-0.5" aria-hidden="true" />
                        )}
                        <div className={`flex-1 ${checkedIds[i.id] ? 'opacity-40 line-through' : ''}`}>
                          <div className={view === 'staff' ? 'text-xl' : ''}>{formatQty(i)}</div>
                          <IngredientShoppingLink
                            ingredient={i}
                            displayName={displayIngredientName(i)}
                            recipeNames={[recipe.name]}
                            onAddToList={canManage(role) ? () => addToShoppingList(i) : undefined}
                            addingToList={!!addingToListIds[i.id]}
                          />
                        </div>
                      </div>
                      <div className="hidden print:flex gap-2">
                        <span className="text-brass shrink-0">•</span>
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
                className={`bg-card rounded-xl2 shadow-card p-5 print:shadow-none print:border print:border-cardBorder ${
                  lang === 'es' && hasSpanish ? 'hidden print:block' : ''
                }`}
              >
                <h2 className="font-display text-lg text-denim mb-2">Instructions</h2>
                <div className="text-sm text-denim space-y-2 leading-relaxed">
                  {recipe.instructions_en!.split(' | ').map((step, idx) => (
                    <p key={idx}>
                      <span className="text-brass font-medium">{idx + 1}.</span> {step}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {hasSpanish && (
              <div
                className={`bg-card rounded-xl2 shadow-card p-5 print:shadow-none print:border print:border-cardBorder ${
                  lang === 'en' && hasEnglish ? 'hidden print:block' : ''
                }`}
              >
                <h2 className="font-display text-lg text-denim mb-2">Instrucciones</h2>
                <div className="text-sm text-denim space-y-2 leading-relaxed">
                  {recipe.instructions_es!.split(' | ').map((step, idx) => (
                    <p key={idx}>
                      <span className="text-brass font-medium">{idx + 1}.</span> {step}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!hasEnglish && !hasSpanish && (
          <p className="text-sm text-dusk text-center mt-4">
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
        <RecipeFamilyNotes recipeId={recipeId} initialNotes={recipe.family_notes} />
        <SubstitutionEditor
          recipeId={recipeId}
          initialNotes={substitutionNotes || ''}
          lastUpdatedBy={substitutionUpdatedBy}
          lastUpdatedAt={substitutionUpdatedAt ? new Date(substitutionUpdatedAt) : undefined}
        />
        <RecipeNotes notes={recipe.notes} />
        <RecipeKitchenTools recipeId={recipeId} propertyId={propertyId} initialEquipment={recipe.equipment ?? []} />
        {canManage(role) && (
          <RecipePrepLeadDays recipeId={recipeId} initialDays={recipe.prep_lead_days} />
        )}
      </div>
      </div>

      <div className="mt-8 print:hidden">
        <h2 className="text-xs font-medium uppercase tracking-wider text-dusk mb-2">{t('kitchenOps')}</h2>
        {/* /sitemap's own tile language (bg-mist, border-brass/30, Lucide
            icon) -- was bg-card with a circular emoji badge, a different
            icon system than the rest of the app's real icon-tile pattern.
            No pin dot (2026-07-20): these 4 are a fixed set of tool
            shortcuts with nothing to collapse -- a decorative pin here
            read as a broken toggle affordance per Racquel's RULE 1
            (pin dot must really act, or be removed where it can't).
            Opens as a modal over this recipe rather than navigating away --
            confirmed live that all 4 previously used a plain <Link> to a
            full page route with no way back except the browser's native
            back button. The Tools Hub page's own versions of these same
            tools (app/properties/[id]/tools/page.tsx) are untouched and
            still navigate normally, since a standalone-page launch has
            nothing to "get back to." Fixed 2-col grid rather than 3-at-sm:
            with exactly 4 items, 3-per-row leaves an awkward 3+1 split;
            2x2 stays clean at every width. */}
        <div className="grid grid-cols-2 gap-2">
          {KITCHEN_OPS_LINKS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.slug}
                onClick={() => setOpenKitchenOpsTool(tool.slug as KitchenOpsSlug)}
                className="flex flex-col items-center text-center gap-1.5 bg-mist border border-brass/30 rounded-xl2 shadow-card px-3 py-4 hover:shadow-cardHover transition-shadow"
              >
                <Icon size={20} className="text-denim" aria-hidden="true" />
                <span className="text-xs font-bold text-denim">{t(tool.titleKey)}</span>
              </button>
            );
          })}
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
          <h2 className="text-xs font-medium uppercase tracking-wider text-dusk mb-2">{t('pairsWellWith')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pairsWellWith.map((s) => (
              <Link
                key={s.id}
                href={`/properties/${propertyId}/recipes/${s.id}`}
                className="shrink-0 w-32 bg-card rounded-xl border border-cardBorder shadow-card overflow-hidden hover:border-brass/40 transition-colors"
              >
                <div className="w-full h-20 bg-mist flex items-center justify-center">
                  {s.photo_url && isDirectImageUrl(s.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-dusk">🍽️</span>
                  )}
                </div>
                <p className="p-2 text-xs font-medium text-denim leading-snug line-clamp-2">{s.name}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
