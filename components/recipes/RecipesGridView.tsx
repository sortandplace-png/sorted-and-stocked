'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import Pin from '@/components/PinAccent';
import {
  Timer,
  Soup,
  Beef,
  Wheat,
  Carrot,
  Salad as SaladIcon,
  IceCreamCone,
  Apple,
  Droplet,
  Milk,
  Leaf,
  Flame,
  Wine,
  Calendar as CalendarIcon,
  Clock,
  CookingPot,
  Square,
  Grid3x3,
  LayoutGrid,
  ChefHat,
  BookOpen,
  ChevronDown,
  Heart,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import { COURSES, type Course } from '@/lib/course-constants';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { createClient } from '@/lib/supabase/client';
import { checkRecipeDeletable } from '@/lib/recipe-delete-guard';
import NewRecipeModal from '@/components/NewRecipeModal';
import FloatingKitchenTimerButton from '@/components/FloatingKitchenTimerButton';
import { useToast } from '@/components/Toast';
import { FilterPill, FilterPillRow } from '@/components/recipes/FilterPill';
import { formatMinutes } from '@/lib/format-time';

// Meat/Dairy/Parve as color-coded status pills, reusing the app's existing
// kashrut-indicator tokens (tailwind.config.ts already documents rust/dairy/
// sage as "third kashrut-indicator color" etc.) rather than inventing new
// colors -- no mapping like this existed anywhere before this pass.
const KOSHER_PILL_COLORS: Record<string, string> = {
  Meat: 'bg-rust/10 text-rust border-rust/20',
  Dairy: 'bg-dairy/10 text-dairy border-dairy/20',
  Parve: 'bg-sage/10 text-sage border-sage/20',
};

function kosherPillClass(kosherType: string) {
  const base = kosherType.startsWith('Parve') ? 'Parve' : kosherType;
  return KOSHER_PILL_COLORS[base] ?? 'bg-mist text-denim border-cardBorder';
}

interface Recipe {
  id: string;
  name: string;
  name_es?: string | null;
  photo_url: string | null;
  kosher_type: string | null;
  course: string | null;
  tags: string[] | null;
  is_pesach: boolean | null;
  is_yom_tov: boolean | null;
  is_shabbos_only: boolean | null;
  approx_total_minutes: number | null;
  created_at: string;
}

// Weekday isn't a stored value — it's the default state where none of the
// three occasion flags are set. Computed here, not a redundant DB column.
type Occasion = 'shabbos' | 'yomtov' | 'pesach' | 'weekday';

function matchesOccasion(r: Recipe, occasion: Occasion): boolean {
  if (occasion === 'shabbos') return !!r.is_shabbos_only;
  if (occasion === 'yomtov') return !!r.is_yom_tov;
  if (occasion === 'pesach') return !!r.is_pesach;
  return !r.is_shabbos_only && !r.is_yom_tov && !r.is_pesach;
}

interface ExpiringSoonRecipe {
  recipe_id: string;
  recipe_name: string;
  recipe_name_es?: string | null;
  photo_url: string | null;
  expiring_count: number;
  expiring_ingredient_names: string[];
}

const EXPIRING_WINDOW_OPTIONS = [3, 4, 5];

// One "Parve" filter pill covers both the "Parve" and "Parve (Fish)" real
// kosher_type values — fish is halachically parve, and both already showed
// the same פרווה Hebrew subtitle before this merge. The underlying data
// still distinguishes them (kosher_type keeps its real specific value on
// each recipe, e.g. for its own card badge) — this only merges the filter
// pill and its matching logic, not the data. Matches the same
// kt.startsWith('Parve') convention already used in
// lib/shopping-link-builder.ts for the same "any kind of parve" grouping.
const KOSHER_TYPES = ['Meat', 'Dairy', 'Parve'];

function matchesKosherFilter(r: Recipe, filter: string): boolean {
  if (filter === 'Parve') return !!r.kosher_type?.startsWith('Parve');
  return r.kosher_type === filter;
}

// Matches the Hebrew-alongside-English convention already used for calendar
// content (e.g. MealPlanView.tsx's month-grid Hebrew dates) — always shown,
// not locale-gated, distinct from the app's separate EN/ES UI-string system.
const OCCASION_HEBREW: Record<Occasion, string | null> = {
  shabbos: 'שבת',
  yomtov: 'יו״ט',
  pesach: 'פסח',
  weekday: null,
};

const KOSHER_HEBREW: Record<string, string> = {
  Meat: 'בשרי',
  Dairy: 'חלבי',
  Parve: 'פרווה',
};

// Monochrome line-icon set for this page's filter pills specifically —
// matches an approved visual reference (uniform icon color, not each
// emoji's own inherent color). Deliberately local to this file rather than
// changing course-constants.ts / lib/icon-maps.ts's shared string fields,
// since those are also rendered as plain inline text elsewhere (recipe
// cards, meal-plan badges) where switching to components would ripple out
// well beyond this page.
const COURSE_PILL_ICONS: Record<Course, LucideIcon> = {
  soup: Soup,
  protein: Beef,
  starch: Wheat,
  vege: Carrot,
  salad: SaladIcon,
  dessert: IceCreamCone,
  kids_platter: Apple,
  dip: Droplet,
};

const KOSHER_PILL_ICONS: Record<string, LucideIcon> = {
  Meat: Beef,
  Dairy: Milk,
  Parve: Leaf,
};

const OCCASION_PILL_ICONS: Record<Occasion, LucideIcon> = {
  shabbos: Flame,
  yomtov: Wine,
  pesach: Grid3x3,
  weekday: CalendarIcon,
};

const PREP_PILL_ICONS: Record<PrepKey, LucideIcon> = {
  quick: Clock,
  'slow-cooker': CookingPot,
  '9x13': Square,
  'one-pot': ChefHat,
  basics: BookOpen,
};

// Only pills with a real, checkable backing field — confirmed live against
// recipes.tags before building. "9x13" and "slow-cooker" are real tags in
// use today (21 and 8 recipes respectively). "Quick & Easy" has no tag but
// is computable from the existing approx_total_minutes field (already
// partially populated and already used elsewhere on this page's cards).
// "one-pot" and "basics" are real tags too now. "one-pot" covers 6 recipes
// whose own instructions confirm single-vessel cooking (seared/sautéed/
// braised in the same pot, or a single sheet pan/9x13). "basics" covers 9
// foundational/staple recipes Racquel confirmed (broths, rice sides,
// simple dressings) — "Simple and Delicious Corned Beef" was deliberately
// excluded despite matching the name search, since it's a full dish, not
// a staple building block.
type PrepKey = 'quick' | 'slow-cooker' | '9x13' | 'one-pot' | 'basics';
const PREP_FILTERS: { key: PrepKey; label: string }[] = [
  { key: 'quick', label: 'Quick & Easy' },
  { key: 'slow-cooker', label: 'Slow Cooker' },
  { key: '9x13', label: '9x13 Pan' },
  { key: 'one-pot', label: 'One-Pot' },
  { key: 'basics', label: 'Basics' },
];

function matchesPrep(r: Recipe, key: PrepKey): boolean {
  if (key === 'quick') return (r.approx_total_minutes ?? Infinity) <= 30;
  return !!r.tags?.includes(key);
}

// Google Drive's "file/d/.../view" links can't be embedded as images, but
// the thumbnail endpoint can be. App-local paths (starting with /) always
// work since they're same-origin. Matches the same check RecipeDetailClient
// uses, since recipe photos come from varied hosts (Drive, Supabase Storage,
// manufacturer sites) — a plain <img> avoids Next/Image's domain allowlist
// breaking on hosts we can't predict in advance.
function isDirectImageUrl(url: string) {
  if (url.startsWith('/')) return true;
  if (url.includes('drive.google.com/thumbnail')) return true;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) && !url.includes('drive.google.com');
}

export default function RecipesGridView({
  propertyId,
  recipes,
}: {
  propertyId: string;
  recipes: Recipe[];
}) {
  const role = usePropertyRole();
  const t = useTranslations('recipesGrid');
  const tCourse = useTranslations('course');
  const locale = useLocale();
  const displayName = (r: { name: string; name_es?: string | null }) =>
    locale === 'es' && r.name_es ? r.name_es : r.name;
  const displayExpiringName = (r: { recipe_name: string; recipe_name_es?: string | null }) =>
    locale === 'es' && r.recipe_name_es ? r.recipe_name_es : r.recipe_name;
  const router = useRouter();
  const supabase = createClient();
  const showToast = useToast();
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showNewRecipe, setShowNewRecipe] = useState(false);
  const [collapsedLetters, setCollapsedLetters] = useState<Set<string>>(new Set());
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [kosherFilter, setKosherFilter] = useState<string | null>(null);
  const [occasionFilter, setOccasionFilter] = useState<Occasion | null>(null);
  const [prepFilter, setPrepFilter] = useState<PrepKey | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expiringSoon, setExpiringSoon] = useState<ExpiringSoonRecipe[]>([]);
  const [expiringWindow, setExpiringWindow] = useState(4);
  const [cardMenuOpenId, setCardMenuOpenId] = useState<string | null>(null);
  const [cardActionBusy, setCardActionBusy] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);
  const [deleteBlockMessage, setDeleteBlockMessage] = useState<string | null>(null);

  // Pesach Mode (properties.feature_flags.pesach_mode, same flag toggled on
  // the Inventory page) -- when on, default the Occasion filter to Pesach
  // on load. Only sets the initial value, doesn't force it back if someone
  // changes the filter afterward -- a default, not a lock.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('properties').select('feature_flags').eq('id', propertyId).single();
      const flags = (data?.feature_flags ?? {}) as Record<string, boolean>;
      if (flags.pesach_mode) setOccasionFilter('pesach');
    })();
  }, [propertyId, supabase]);

  // Per-person favorites (recipe_favorites.user_id) — not shared across the
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
        .select('recipe_id')
        .eq('property_id', propertyId)
        .eq('user_id', user.id);
      setFavoriteIds(new Set((data ?? []).map((f) => f.recipe_id)));
    })();
  }, [propertyId, supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('get_expiring_soon_recipes', {
        p_property_id: propertyId,
        p_days_ahead: expiringWindow,
      });
      setExpiringSoon(data ?? []);
    })();
  }, [propertyId, supabase, expiringWindow]);

  async function toggleFavorite(recipeId: string, e: React.MouseEvent) {
    e.preventDefault(); // card is a Link — don't navigate
    e.stopPropagation();
    if (!currentUserId) return;

    const isFav = favoriteIds.has(recipeId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });

    if (isFav) {
      await supabase
        .from('recipe_favorites')
        .delete()
        .eq('property_id', propertyId)
        .eq('recipe_id', recipeId)
        .eq('user_id', currentUserId);
    } else {
      await supabase
        .from('recipe_favorites')
        .insert({ property_id: propertyId, recipe_id: recipeId, user_id: currentUserId });
      // A duplicate (already favorited from another tab) just no-ops via
      // the unique constraint — no need to handle that error specially.
    }
  }

  // Scoped to Duplicate + Delete only — Edit and Print don't translate well
  // to a card-click context without opening the full recipe page first, so
  // those two stay exclusive to the detail page's kebab menu.
  async function duplicateRecipeFromCard(recipeId: string, e: React.MouseEvent) {
    e.preventDefault(); // card is a Link — don't navigate
    e.stopPropagation();
    setCardMenuOpenId(null);
    setCardActionBusy(recipeId);

    const [{ data: source }, { data: sourceIngredients }] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', recipeId).single(),
      supabase
        .from('recipe_ingredients')
        .select('name, quantity, unit, category, section_label')
        .eq('recipe_id', recipeId),
    ]);

    if (!source) {
      setCardActionBusy(null);
      showToast('Failed to duplicate recipe.', { variant: 'error' });
      return;
    }

    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        property_id: propertyId,
        name: `${source.name} (Copy)`,
        name_es: source.name_es,
        servings: source.servings,
        course: source.course,
        kosher_type: source.kosher_type,
        instructions_en: source.instructions_en,
        instructions_es: source.instructions_es,
        tags: source.tags,
        approx_total_minutes: source.approx_total_minutes,
        is_pesach: source.is_pesach,
        is_yom_tov: source.is_yom_tov,
        is_shabbos_only: source.is_shabbos_only,
      })
      .select('id')
      .single();

    if (recipeError || !newRecipe) {
      setCardActionBusy(null);
      showToast('Failed to duplicate recipe.', { variant: 'error' });
      return;
    }

    if (sourceIngredients && sourceIngredients.length > 0) {
      await supabase
        .from('recipe_ingredients')
        .insert(sourceIngredients.map((i) => ({ ...i, recipe_id: newRecipe.id })));
    }

    setCardActionBusy(null);
    showToast('Recipe duplicated.', { variant: 'success' });
    router.push(`/properties/${propertyId}/recipes/${newRecipe.id}`);
  }

  async function deleteRecipeFromCard(recipeId: string) {
    setCardActionBusy(recipeId);
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    setCardActionBusy(null);
    setConfirmDeleteId(null);

    if (error) {
      showToast('Failed to delete recipe.', { variant: 'error' });
      return;
    }
    showToast('Recipe deleted.', { variant: 'success' });
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (courseFilter && r.course !== courseFilter) return false;
      if (kosherFilter && !matchesKosherFilter(r, kosherFilter)) return false;
      if (occasionFilter && !matchesOccasion(r, occasionFilter)) return false;
      if (prepFilter && !matchesPrep(r, prepFilter)) return false;
      return true;
    });
  }, [search, recipes, courseFilter, kosherFilter, occasionFilter, prepFilter]);

  const hasActiveFilters = !!courseFilter || !!kosherFilter || !!occasionFilter || !!prepFilter;

  // Live counts for every filter pill — computed once from the real recipe
  // data passed into this page, not the currently-filtered subset (so
  // picking one filter doesn't make the others' counts shift under you).
  const courseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of recipes) if (r.course) counts[r.course] = (counts[r.course] ?? 0) + 1;
    return counts;
  }, [recipes]);

  const recentlyAdded = useMemo(() => {
    return [...recipes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  }, [recipes]);

  // ExpiringSoonRecipe comes from a separate RPC (get_expiring_soon_recipes)
  // that doesn't return is_pesach -- rather than widen that RPC, look it up
  // against the recipe list already loaded for this page, which does.
  const pesachIds = useMemo(() => new Set(recipes.filter((r) => r.is_pesach).map((r) => r.id)), [recipes]);

  const kosherCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Parve counts every recipe whose kosher_type starts with "Parve" (that
    // includes "Parve (Fish)") — kosher_type is a single-value column, not
    // a tag array, so a recipe can only ever match one bucket here, no
    // double-counting possible.
    for (const k of KOSHER_TYPES) counts[k] = recipes.filter((r) => matchesKosherFilter(r, k)).length;
    return counts;
  }, [recipes]);

  const occasionCounts = useMemo(() => {
    const counts: Record<Occasion, number> = { shabbos: 0, yomtov: 0, pesach: 0, weekday: 0 };
    for (const r of recipes) {
      (['shabbos', 'yomtov', 'pesach', 'weekday'] as Occasion[]).forEach((o) => {
        if (matchesOccasion(r, o)) counts[o]++;
      });
    }
    return counts;
  }, [recipes]);

  const prepCounts = useMemo(() => {
    const counts: Record<PrepKey, number> = { quick: 0, 'slow-cooker': 0, '9x13': 0, 'one-pot': 0, basics: 0 };
    for (const r of recipes) {
      (['quick', 'slow-cooker', '9x13', 'one-pot', 'basics'] as PrepKey[]).forEach((p) => {
        if (matchesPrep(r, p)) counts[p]++;
      });
    }
    return counts;
  }, [recipes]);

  // Mobile-only staged filter state — pills on mobile edit these instead of
  // the real applied filters above, so nothing on the recipe list changes
  // until "Apply Filters" is tapped. Desktop keeps applying instantly via
  // the setters above; this block is invisible to desktop entirely (the
  // markup that uses it is CSS-hidden on md+ via the same md:hidden /
  // hidden md:block split MobileBottomNav/DesktopNav already use).
  const [stagedCourseFilter, setStagedCourseFilter] = useState<string | null>(null);
  const [stagedKosherFilter, setStagedKosherFilter] = useState<string | null>(null);
  const [stagedOccasionFilter, setStagedOccasionFilter] = useState<Occasion | null>(null);
  const [stagedPrepFilter, setStagedPrepFilter] = useState<PrepKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState({ course: true, dietary: false, occasion: false, prep: false });

  function toggleMobileSection(key: keyof typeof mobileOpen) {
    setMobileOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const hasPendingChanges =
    stagedCourseFilter !== courseFilter ||
    stagedKosherFilter !== kosherFilter ||
    stagedOccasionFilter !== occasionFilter ||
    stagedPrepFilter !== prepFilter;

  // Live "would match" count for the staged selection — same matching
  // logic as `filtered` above, just against staged instead of applied.
  const stagedMatchCount = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (stagedCourseFilter && r.course !== stagedCourseFilter) return false;
      if (stagedKosherFilter && !matchesKosherFilter(r, stagedKosherFilter)) return false;
      if (stagedOccasionFilter && !matchesOccasion(r, stagedOccasionFilter)) return false;
      if (stagedPrepFilter && !matchesPrep(r, stagedPrepFilter)) return false;
      return true;
    }).length;
  }, [search, recipes, stagedCourseFilter, stagedKosherFilter, stagedOccasionFilter, stagedPrepFilter]);

  function applyStagedFilters() {
    setCourseFilter(stagedCourseFilter);
    setKosherFilter(stagedKosherFilter);
    setOccasionFilter(stagedOccasionFilter);
    setPrepFilter(stagedPrepFilter);
  }

  function clearStagedFilters() {
    setStagedCourseFilter(null);
    setStagedKosherFilter(null);
    setStagedOccasionFilter(null);
    setStagedPrepFilter(null);
  }

  const courseLabel = (key: string | null) => (key ? tCourse(key) : 'All');
  const occasionLabels: Record<Occasion, string> = { shabbos: 'Shabbos', yomtov: 'Yom Tov', pesach: 'Pesach', weekday: 'Weekday' };
  const prepLabel = (key: PrepKey | null) => (key ? PREP_FILTERS.find((p) => p.key === key)?.label ?? key : 'Any');

  // Group alphabetically by first letter — non-letter-leading names (numbers,
  // punctuation, emoji) fall into a trailing "#" bucket rather than being
  // dropped or crashing the sort.
  const groups = useMemo(() => {
    const map = new Map<string, Recipe[]>();
    for (const recipe of filtered) {
      const firstChar = recipe.name.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(recipe);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  function toggleLetter(letter: string) {
    setCollapsedLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  return (
    <div className="max-w-md lg:max-w-6xl mx-auto p-4">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-denim">{t('title')}</h1>
          <p className="text-sm text-dusk mt-0.5">
            {recipes.length} recipe{recipes.length === 1 ? '' : 's'} in your collection
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/properties/${propertyId}/scan`}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-linen border border-brass/30 text-denim text-lg"
            aria-label="Scan a label"
          >
            📷
          </a>
          {canManage(role) && (
            <button
              onClick={() => setShowNewRecipe(true)}
              className="text-sm font-medium bg-denim text-white px-4 py-2 rounded-full hover:opacity-90 transition shadow-sm"
            >
              + {t('newRecipe')}
            </button>
          )}
        </div>
      </div>

      {/* Filtering is already live/reactive on every keystroke -- this button
          isn't a new query mechanism, it's a visible affordance so the field
          reads as a real search rather than a plain text box (the actual
          ask: "the search needs an enter button"). Enter keeps working as
          before; clicking the icon just refocuses the field, giving a real,
          keyboard-accessible tap target instead of a decorative-only icon. */}
      <div className="relative mb-3">
        <input
          ref={searchInputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full border border-cardBorder rounded-xl2 pl-10 pr-4 py-2.5 bg-card"
        />
        <button
          type="button"
          onClick={() => searchInputRef.current?.focus()}
          aria-label={t('searchPlaceholder')}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-dusk hover:text-brass transition-colors"
        >
          <Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => {
              setCourseFilter(null);
              setKosherFilter(null);
              setOccasionFilter(null);
              setPrepFilter(null);
              clearStagedFilters();
            }}
            className="text-xs text-dusk hover:text-denim px-3 py-1.5 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="hidden md:block space-y-4 mb-6">
        <FilterPillRow label="Course">
          {COURSES.map((c) => (
            <FilterPill
              key={c.key}
              active={courseFilter === c.key}
              icon={COURSE_PILL_ICONS[c.key]}
              label={tCourse(c.key)}
              count={courseCounts[c.key] ?? 0}
              onClick={() => setCourseFilter(courseFilter === c.key ? null : c.key)}
            />
          ))}
        </FilterPillRow>

        <div className="flex gap-6">
          <div className="flex-1">
            <FilterPillRow label="Dietary">
              {KOSHER_TYPES.map((k) => (
                <FilterPill
                  key={k}
                  active={kosherFilter === k}
                  icon={KOSHER_PILL_ICONS[k]}
                  label={k}
                  count={kosherCounts[k] ?? 0}
                  hebrew={KOSHER_HEBREW[k]}
                  onClick={() => setKosherFilter(kosherFilter === k ? null : k)}
                />
              ))}
            </FilterPillRow>
          </div>

          <div className="flex-1">
            <FilterPillRow label="Occasion">
              {(
                [
                  ['shabbos', 'Shabbos'],
                  ['yomtov', 'Yom Tov'],
                  ['pesach', 'Pesach'],
                  ['weekday', 'Weekday'],
                ] as [Occasion, string][]
              ).map(([key, label]) => (
                <FilterPill
                  key={key}
                  active={occasionFilter === key}
                  icon={OCCASION_PILL_ICONS[key]}
                  label={label}
                  count={occasionCounts[key] ?? 0}
                  hebrew={OCCASION_HEBREW[key]}
                  onClick={() => setOccasionFilter(occasionFilter === key ? null : key)}
                />
              ))}
            </FilterPillRow>
          </div>
        </div>

        <FilterPillRow label="Prep">
          {PREP_FILTERS.map((p) => (
            <FilterPill
              key={p.key}
              active={prepFilter === p.key}
              icon={PREP_PILL_ICONS[p.key]}
              label={p.label}
              count={prepCounts[p.key] ?? 0}
              onClick={() => setPrepFilter(prepFilter === p.key ? null : p.key)}
            />
          ))}
          <span className="w-px h-6 bg-cardBorder shrink-0" aria-hidden="true" />
          <FilterPill
            active={!courseFilter}
            icon={LayoutGrid}
            label="All"
            count={recipes.length}
            onClick={() => setCourseFilter(null)}
            title="Clear the Course filter (shows every recipe)"
          />
        </FilterPillRow>
      </div>

      {/* Mobile: staged filters, accordion sections, sticky Apply bar --
          nothing here touches the real filters until Apply is tapped. */}
      <div className="md:hidden mb-6">
        <div className="border-b border-cardBorder pb-2">
          <button
            onClick={() => toggleMobileSection('course')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-dusk">Course</span>
            <span className="flex items-center gap-2 text-xs text-dusk">
              {!mobileOpen.course && courseLabel(stagedCourseFilter)}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.course ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.course && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              <FilterPill
                active={!stagedCourseFilter}
                icon={LayoutGrid}
                label="All"
                count={recipes.length}
                onClick={() => setStagedCourseFilter(null)}
              />
              {COURSES.map((c) => (
                <FilterPill
                  key={c.key}
                  active={stagedCourseFilter === c.key}
                  icon={COURSE_PILL_ICONS[c.key]}
                  label={tCourse(c.key)}
                  count={courseCounts[c.key] ?? 0}
                  onClick={() => setStagedCourseFilter(stagedCourseFilter === c.key ? null : c.key)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-cardBorder py-2">
          <button
            onClick={() => toggleMobileSection('dietary')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-dusk">Dietary</span>
            <span className="flex items-center gap-2 text-xs text-dusk">
              {!mobileOpen.dietary && (stagedKosherFilter ?? 'Any')}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.dietary ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.dietary && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {KOSHER_TYPES.map((k) => (
                <FilterPill
                  key={k}
                  active={stagedKosherFilter === k}
                  icon={KOSHER_PILL_ICONS[k]}
                  label={k}
                  count={kosherCounts[k] ?? 0}
                  hebrew={KOSHER_HEBREW[k]}
                  onClick={() => setStagedKosherFilter(stagedKosherFilter === k ? null : k)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-cardBorder py-2">
          <button
            onClick={() => toggleMobileSection('occasion')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-dusk">Occasion</span>
            <span className="flex items-center gap-2 text-xs text-dusk">
              {!mobileOpen.occasion && (stagedOccasionFilter ? occasionLabels[stagedOccasionFilter] : 'Any')}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.occasion ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.occasion && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {(
                [
                  ['shabbos', 'Shabbos'],
                  ['yomtov', 'Yom Tov'],
                  ['pesach', 'Pesach'],
                  ['weekday', 'Weekday'],
                ] as [Occasion, string][]
              ).map(([key, label]) => (
                <FilterPill
                  key={key}
                  active={stagedOccasionFilter === key}
                  icon={OCCASION_PILL_ICONS[key]}
                  label={label}
                  count={occasionCounts[key] ?? 0}
                  hebrew={OCCASION_HEBREW[key]}
                  onClick={() => setStagedOccasionFilter(stagedOccasionFilter === key ? null : key)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 pb-1">
          <button
            onClick={() => toggleMobileSection('prep')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-dusk">Prep</span>
            <span className="flex items-center gap-2 text-xs text-dusk">
              {!mobileOpen.prep && prepLabel(stagedPrepFilter)}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.prep ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.prep && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {PREP_FILTERS.map((p) => (
                <FilterPill
                  key={p.key}
                  active={stagedPrepFilter === p.key}
                  icon={PREP_PILL_ICONS[p.key]}
                  label={p.label}
                  count={prepCounts[p.key] ?? 0}
                  onClick={() => setStagedPrepFilter(stagedPrepFilter === p.key ? null : p.key)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-16 inset-x-0 z-20 bg-linen/95 backdrop-blur border-t border-cardBorder -mx-4 px-4 pt-3 mt-3 flex items-center gap-3">
          <button onClick={clearStagedFilters} className="min-h-11 px-3 text-xs text-dusk hover:text-denim underline shrink-0">
            Clear all
          </button>
          <button
            onClick={applyStagedFilters}
            disabled={!hasPendingChanges}
            className={`flex-1 min-h-11 rounded-full text-sm font-medium transition-colors ${
              hasPendingChanges ? 'bg-denim text-white' : 'bg-mist text-dusk cursor-not-allowed'
            }`}
          >
            Apply Filters ({stagedMatchCount})
          </button>
        </div>
      </div>

      {(expiringSoon.length > 0 || recentlyAdded.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {expiringSoon.length > 0 && (
            <div
              className={`bg-rust/5 border border-rust/20 rounded-2xl ${recentlyAdded.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} ${
                hasActiveFilters ? 'p-2.5' : 'p-4'
              }`}
            >
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h2 className={`font-display text-denim flex items-center gap-1.5 ${hasActiveFilters ? 'text-sm' : 'text-lg'}`}>
                  <Timer className="w-4 h-4 text-rust" strokeWidth={1.75} /> Use it up soon
                </h2>
                {!hasActiveFilters && (
                  <select
                    value={expiringWindow}
                    onChange={(e) => setExpiringWindow(Number(e.target.value))}
                    className="text-xs border border-cardBorder rounded-full px-2 py-1 bg-card text-dusk"
                  >
                    {EXPIRING_WINDOW_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        Next {d} days
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {hasActiveFilters ? (
                // Compact single-row ribbon while a filter is active, so the
                // filtered results below don't get pushed far down the page —
                // just a thumbnail + name, no ingredient-count subtitle or
                // window picker.
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {expiringSoon.map((r) => (
                    <Link
                      key={r.recipe_id}
                      href={`/properties/${propertyId}/recipes/${r.recipe_id}`}
                      className={`shrink-0 w-36 flex items-center gap-1.5 rounded-lg border shadow-card overflow-hidden hover:shadow-cardHover transition-shadow p-1.5 ${
                        pesachIds.has(r.recipe_id) ? 'bg-brass/[0.08] border-brass/40' : 'bg-card border-cardBorder'
                      }`}
                    >
                      <div className="w-8 h-8 rounded bg-linen flex items-center justify-center shrink-0">
                        {r.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover rounded" />
                        ) : (
                          <span className="text-sm text-dusk">🍽️</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-denim leading-snug line-clamp-2">{displayExpiringName(r)}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {expiringSoon.map((r) => (
                    <Link
                      key={r.recipe_id}
                      href={`/properties/${propertyId}/recipes/${r.recipe_id}`}
                      className={`shrink-0 w-40 rounded-xl border shadow-card overflow-hidden hover:shadow-cardHover transition-shadow ${
                        pesachIds.has(r.recipe_id) ? 'bg-brass/[0.08] border-brass/40' : 'bg-card border-cardBorder'
                      }`}
                    >
                      <div className="w-full h-20 bg-linen flex items-center justify-center">
                        {r.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl text-dusk">🍽️</span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-sm font-medium text-denim leading-snug line-clamp-2">{displayExpiringName(r)}</p>
                        <p
                          className="text-xs text-rust mt-1"
                          title={r.expiring_ingredient_names.join(', ')}
                        >
                          {r.expiring_count} expiring ingredient{r.expiring_count === 1 ? '' : 's'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {recentlyAdded.length > 0 && (
            <div className={`bg-mist border border-cardBorder rounded-2xl p-4 ${expiringSoon.length > 0 ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
              <h2 className="font-display text-lg text-denim flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-brass" strokeWidth={1.75} /> Recently Added
              </h2>
              <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-1">
                {recentlyAdded.map((r) => (
                  <Link
                    key={r.id}
                    href={`/properties/${propertyId}/recipes/${r.id}`}
                    className={`shrink-0 lg:shrink lg:flex lg:items-center lg:gap-2 w-32 lg:w-full rounded-xl border shadow-card overflow-hidden hover:shadow-cardHover transition-shadow ${
                      r.is_pesach ? 'bg-brass/[0.08] border-brass/40' : 'bg-card border-cardBorder'
                    }`}
                  >
                    <div className="w-full lg:w-12 h-20 lg:h-12 bg-linen flex items-center justify-center shrink-0">
                      {r.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl text-dusk">🍽️</span>
                      )}
                    </div>
                    <div className="p-2 lg:py-1.5 lg:pl-0 min-w-0">
                      <p className="text-xs font-medium text-denim leading-snug line-clamp-2 lg:truncate">{r.name}</p>
                      <p className="text-[10px] text-dusk mt-0.5">
                        {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-dusk">{t('noResults')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([letter, groupRecipes]) => {
            const collapsed = collapsedLetters.has(letter);
            return (
              <div key={letter}>
                <button
                  onClick={() => toggleLetter(letter)}
                  className="w-full flex items-center gap-2 mb-2 text-left"
                >
                  <span className="font-display text-lg text-denim">{letter}</span>
                  <span className="text-xs text-dusk">({groupRecipes.length})</span>
                  <span className="flex-1 border-t border-cardBorder" />
                  <span className="text-dusk text-sm">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
                    {groupRecipes.map((recipe) => (
                      <Link
                        key={recipe.id}
                        href={`/properties/${propertyId}/recipes/${recipe.id}`}
                        className={`block rounded-xl2 overflow-hidden border shadow-card hover:shadow-cardHover transition-shadow ${
                          recipe.is_pesach ? 'bg-brass/[0.08] border-brass/40' : 'bg-card border-cardBorder'
                        }`}
                      >
                        <div className="relative w-full aspect-[4/3] bg-linen">
                          {/* Decorative only (no onToggle -- recipe cards
                              don't collapse), matching the same corner every
                              other card in the app anchors its pin to. The
                              favorite-heart button below lives in the
                              opposite (bottom-right) corner specifically to
                              stay clear of this. */}
                          <Pin size="sm" />
                          {recipe.photo_url && isDirectImageUrl(recipe.photo_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.photo_url}
                              alt={displayName(recipe)}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-dusk">
                              {(() => {
                                const Icon = getRecipeIcon(recipe.course);
                                return <Icon className="w-8 h-8" strokeWidth={1.5} />;
                              })()}
                            </div>
                          )}
                          {currentUserId && (
                            <button
                              onClick={(e) => toggleFavorite(recipe.id, e)}
                              className="absolute bottom-0 right-0 w-11 h-11 flex items-center justify-center"
                              aria-label={favoriteIds.has(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <span className="w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                                <Heart
                                  className={favoriteIds.has(recipe.id) ? 'w-4 h-4 fill-brass text-brass' : 'w-4 h-4 text-dusk'}
                                  strokeWidth={1.75}
                                />
                              </span>
                            </button>
                          )}
                          {canManage(role) && (
                            <div className="absolute top-0 left-0">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCardMenuOpenId((prev) => (prev === recipe.id ? null : recipe.id));
                                }}
                                aria-label="More actions"
                                className="w-11 h-11 flex items-center justify-center"
                              >
                                <span className="w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                                  <MoreVertical className="w-4 h-4 text-dusk" strokeWidth={1.75} />
                                </span>
                              </button>
                              {cardMenuOpenId === recipe.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setCardMenuOpenId(null);
                                    }}
                                  />
                                  <div className="absolute left-0 top-11 z-20 bg-card rounded-2xl shadow-cardHover border border-cardBorder w-40 overflow-hidden">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCardMenuOpenId(null);
                                        // Opens the recipe's own detail page with its edit
                                        // modal pre-triggered, rather than duplicating that
                                        // modal's full initial-data-fetch here with a partial
                                        // recipe object off the grid.
                                        router.push(`/properties/${propertyId}/recipes/${recipe.id}?edit=1`);
                                      }}
                                      className="w-full min-h-11 flex items-center gap-2 px-3 text-sm text-denim hover:bg-mist transition border-b border-cardBorder"
                                    >
                                      <Pencil size={14} strokeWidth={1.75} />
                                      Edit
                                    </button>
                                    <button
                                      onClick={(e) => duplicateRecipeFromCard(recipe.id, e)}
                                      disabled={cardActionBusy === recipe.id}
                                      className="w-full min-h-11 flex items-center gap-2 px-3 text-sm text-denim hover:bg-mist transition disabled:opacity-40"
                                    >
                                      <Copy size={14} strokeWidth={1.75} />
                                      {cardActionBusy === recipe.id ? 'Duplicating…' : 'Duplicate'}
                                    </button>
                                    <button
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setCardMenuOpenId(null);
                                        setCheckingDeleteId(recipe.id);
                                        const check = await checkRecipeDeletable(supabase, recipe.id);
                                        setCheckingDeleteId(null);
                                        if (!check.deletable) {
                                          setDeleteBlockMessage(check.message);
                                        } else {
                                          setConfirmDeleteId(recipe.id);
                                        }
                                      }}
                                      disabled={checkingDeleteId === recipe.id}
                                      className="w-full min-h-11 flex items-center gap-2 px-3 text-sm text-rust hover:bg-rust/5 transition border-t border-cardBorder disabled:opacity-40"
                                    >
                                      <Trash2 size={14} strokeWidth={1.75} /> {checkingDeleteId === recipe.id ? 'Checking…' : 'Delete'}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h2 className="font-display font-bold text-lg text-denim leading-snug mb-1">
                            {displayName(recipe)}
                          </h2>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {(() => {
                              const courseInfo = COURSES.find((c) => c.key === recipe.course);
                              return courseInfo ? (
                                <span className="inline-block text-xs font-medium text-dusk">
                                  {courseInfo.icon} {tCourse(courseInfo.key)}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {recipe.kosher_type && (
                              <span className={`inline-block text-xs font-medium border px-2.5 py-1 rounded-full ${kosherPillClass(recipe.kosher_type)}`}>
                                {kosherIcon(recipe.kosher_type)} {recipe.kosher_type}
                              </span>
                            )}
                            {recipe.approx_total_minutes && (
                              <span className="text-xs font-medium text-dusk bg-linen border border-cardBorder px-2.5 py-1 rounded-full">
                                ⏱ {formatMinutes(recipe.approx_total_minutes)}
                              </span>
                            )}
                          </div>
                          {recipe.tags && recipe.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap">
                              {recipe.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={
                                    tag === 'NEW'
                                      ? 'text-[10px] font-medium text-white bg-denim px-2 py-0.5 rounded-full'
                                      : 'text-[10px] font-medium text-brass bg-brass/10 px-2 py-0.5 rounded-full'
                                  }
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNewRecipe && (
        <NewRecipeModal
          propertyId={propertyId}
          onClose={() => setShowNewRecipe(false)}
          onSaved={() => {
            setShowNewRecipe(false);
            router.refresh();
          }}
        />
      )}

      {deleteBlockMessage && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setDeleteBlockMessage(null)}
        >
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-50 sm:p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-sm mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl text-denim mb-1">Delete this recipe?</h2>
            <p className="text-sm text-dusk mb-4">
              This recipe and its ingredient list will be permanently deleted. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-full bg-linen border border-brass/30 text-denim"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRecipeFromCard(confirmDeleteId)}
                disabled={cardActionBusy === confirmDeleteId}
                className="flex-1 py-2.5 rounded-full bg-rust text-white disabled:opacity-40"
              >
                {cardActionBusy === confirmDeleteId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FloatingKitchenTimerButton />
    </div>
  );
}
