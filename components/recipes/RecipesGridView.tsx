'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
  Star,
  type LucideIcon,
} from 'lucide-react';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import { COURSES, type Course } from '@/lib/course-constants';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { createClient } from '@/lib/supabase/client';
import NewRecipeModal from '@/components/NewRecipeModal';

interface Recipe {
  id: string;
  name: string;
  photo_url: string | null;
  kosher_type: string | null;
  course: string | null;
  tags: string[] | null;
  is_pesach: boolean | null;
  is_yom_tov: boolean | null;
  is_shabbos_only: boolean | null;
  approx_total_minutes: number | null;
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
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState('');
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

  const courseLabel = (key: string | null) => (key ? COURSES.find((c) => c.key === key)?.label ?? key : 'All');
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-display text-charcoal">{t('title')}</h1>
        <div className="flex gap-2">
          <a
            href={`/properties/${propertyId}/scan`}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-cream border border-charcoal/30 text-charcoal text-lg"
            aria-label="Scan a label"
          >
            📷
          </a>
          {canManage(role) && (
            <button
              onClick={() => setShowNewRecipe(true)}
              className="text-sm font-medium bg-gold-dark text-white px-4 py-2 rounded-full hover:opacity-90 transition"
            >
              + {t('newRecipe')}
            </button>
          )}
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-3"
      />

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
            className="text-xs text-charcoal/40 hover:text-charcoal px-3 py-1.5 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="hidden md:block space-y-4 mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-3">Course</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {COURSES.map((c) => {
              const active = courseFilter === c.key;
              const Icon = COURSE_PILL_ICONS[c.key];
              return (
                <button key={c.key} onClick={() => setCourseFilter(active ? null : c.key)} className="min-h-11 flex items-center">
                  <span
                    className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                      active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                    {c.label} <span className={active ? 'text-charcoal/60' : 'text-charcoal/40'}>({courseCounts[c.key] ?? 0})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-3">Dietary</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {KOSHER_TYPES.map((k) => {
                const active = kosherFilter === k;
                const Icon = KOSHER_PILL_ICONS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setKosherFilter(active ? null : k)}
                    className="min-h-11 flex items-center justify-center"
                  >
                    <span
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 leading-tight text-sm font-medium">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                        {k}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] leading-tight ${active ? 'text-charcoal/60' : 'text-charcoal/40'}`}>
                        <span>({kosherCounts[k] ?? 0})</span>
                        {KOSHER_HEBREW[k] && (
                          <span lang="he" dir="rtl">
                            {KOSHER_HEBREW[k]}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-3">Occasion</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {(
                [
                  ['shabbos', 'Shabbos'],
                  ['yomtov', 'Yom Tov'],
                  ['pesach', 'Pesach'],
                  ['weekday', 'Weekday'],
                ] as [Occasion, string][]
              ).map(([key, label]) => {
                const active = occasionFilter === key;
                const hebrew = OCCASION_HEBREW[key];
                const Icon = OCCASION_PILL_ICONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setOccasionFilter(active ? null : key)}
                    className="min-h-11 flex items-center justify-center"
                  >
                    <span
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 leading-tight text-sm font-medium">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                        {label}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] leading-tight ${active ? 'text-charcoal/60' : 'text-charcoal/40'}`}>
                        <span>({occasionCounts[key] ?? 0})</span>
                        {hebrew && (
                          <span lang="he" dir="rtl">
                            {hebrew}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-3">Prep</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
            <button
              onClick={() => setCourseFilter(null)}
              className="min-h-11 flex items-center"
              title="Clear the Course filter (shows every recipe)"
            >
              <span
                className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full border border-dashed transition-colors ${
                  !courseFilter
                    ? 'bg-gold text-charcoal border-gold'
                    : 'bg-white border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                }`}
              >
                <LayoutGrid className={`w-3.5 h-3.5 ${!courseFilter ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                All <span className={!courseFilter ? 'text-charcoal/60' : 'text-charcoal/40'}>({recipes.length})</span>
              </span>
            </button>
            <span className="w-px h-6 bg-gold-light/60 shrink-0" aria-hidden="true" />
            {PREP_FILTERS.map((p) => {
              const active = prepFilter === p.key;
              const Icon = PREP_PILL_ICONS[p.key];
              return (
                <button key={p.key} onClick={() => setPrepFilter(active ? null : p.key)} className="min-h-11 flex items-center">
                  <span
                    className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                      active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                    {p.label} <span className={active ? 'text-charcoal/60' : 'text-charcoal/40'}>({prepCounts[p.key] ?? 0})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile: staged filters, accordion sections, sticky Apply bar --
          nothing here touches the real filters until Apply is tapped. */}
      <div className="md:hidden mb-6">
        <div className="border-b border-gold-light/40 pb-2">
          <button
            onClick={() => toggleMobileSection('course')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-charcoal/40">Course</span>
            <span className="flex items-center gap-2 text-xs text-charcoal/60">
              {!mobileOpen.course && courseLabel(stagedCourseFilter)}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.course ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.course && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              <button onClick={() => setStagedCourseFilter(null)} className="min-h-11 flex items-center">
                <span
                  className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                    !stagedCourseFilter ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                  }`}
                >
                  <LayoutGrid className={`w-3.5 h-3.5 ${!stagedCourseFilter ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                  All <span className={!stagedCourseFilter ? 'text-charcoal/60' : 'text-charcoal/40'}>({recipes.length})</span>
                </span>
              </button>
              {COURSES.map((c) => {
                const active = stagedCourseFilter === c.key;
                const Icon = COURSE_PILL_ICONS[c.key];
                return (
                  <button key={c.key} onClick={() => setStagedCourseFilter(active ? null : c.key)} className="min-h-11 flex items-center">
                    <span
                      className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                      {c.label} <span className={active ? 'text-charcoal/60' : 'text-charcoal/40'}>({courseCounts[c.key] ?? 0})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-b border-gold-light/40 py-2">
          <button
            onClick={() => toggleMobileSection('dietary')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-charcoal/40">Dietary</span>
            <span className="flex items-center gap-2 text-xs text-charcoal/60">
              {!mobileOpen.dietary && (stagedKosherFilter ?? 'Any')}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.dietary ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.dietary && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {KOSHER_TYPES.map((k) => {
                const active = stagedKosherFilter === k;
                const Icon = KOSHER_PILL_ICONS[k];
                return (
                  <button
                    key={k}
                    onClick={() => setStagedKosherFilter(active ? null : k)}
                    className="min-h-11 flex items-center justify-center"
                  >
                    <span
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 leading-tight text-sm font-medium">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                        {k}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] leading-tight ${active ? 'text-charcoal/60' : 'text-charcoal/40'}`}>
                        <span>({kosherCounts[k] ?? 0})</span>
                        {KOSHER_HEBREW[k] && (
                          <span lang="he" dir="rtl">
                            {KOSHER_HEBREW[k]}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-b border-gold-light/40 py-2">
          <button
            onClick={() => toggleMobileSection('occasion')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-charcoal/40">Occasion</span>
            <span className="flex items-center gap-2 text-xs text-charcoal/60">
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
              ).map(([key, label]) => {
                const active = stagedOccasionFilter === key;
                const hebrew = OCCASION_HEBREW[key];
                const Icon = OCCASION_PILL_ICONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setStagedOccasionFilter(active ? null : key)}
                    className="min-h-11 flex items-center justify-center"
                  >
                    <span
                      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 leading-tight text-sm font-medium">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                        {label}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] leading-tight ${active ? 'text-charcoal/60' : 'text-charcoal/40'}`}>
                        <span>({occasionCounts[key] ?? 0})</span>
                        {hebrew && (
                          <span lang="he" dir="rtl">
                            {hebrew}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-2 pb-1">
          <button
            onClick={() => toggleMobileSection('prep')}
            className="w-full min-h-11 flex items-center justify-between"
          >
            <span className="text-xs font-medium uppercase tracking-wider text-charcoal/40">Prep</span>
            <span className="flex items-center gap-2 text-xs text-charcoal/60">
              {!mobileOpen.prep && prepLabel(stagedPrepFilter)}
              <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen.prep ? 'rotate-180' : ''}`} strokeWidth={1.75} />
            </span>
          </button>
          {mobileOpen.prep && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
              {PREP_FILTERS.map((p) => {
                const active = stagedPrepFilter === p.key;
                const Icon = PREP_PILL_ICONS[p.key];
                return (
                  <button key={p.key} onClick={() => setStagedPrepFilter(active ? null : p.key)} className="min-h-11 flex items-center">
                    <span
                      className={`flex items-center gap-1.5 leading-tight text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                        active ? 'bg-gold text-charcoal' : 'bg-white border border-gold-light/50 text-charcoal/70 hover:bg-gold-light/10'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-charcoal' : 'text-gold-dark'}`} strokeWidth={1.75} aria-hidden="true" />
                      {p.label} <span className={active ? 'text-charcoal/60' : 'text-charcoal/40'}>({prepCounts[p.key] ?? 0})</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-16 inset-x-0 z-20 bg-cream/95 backdrop-blur border-t border-gold-light/40 -mx-4 px-4 pt-3 mt-3 flex items-center gap-3">
          <button onClick={clearStagedFilters} className="min-h-11 px-3 text-xs text-charcoal/40 hover:text-charcoal underline shrink-0">
            Clear all
          </button>
          <button
            onClick={applyStagedFilters}
            disabled={!hasPendingChanges}
            className={`flex-1 min-h-11 rounded-full text-sm font-medium transition-colors ${
              hasPendingChanges ? 'bg-gold text-charcoal' : 'bg-charcoal/10 text-charcoal/30 cursor-not-allowed'
            }`}
          >
            Apply Filters ({stagedMatchCount})
          </button>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-rust/5 border border-rust/20 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-display text-lg text-charcoal flex items-center gap-1.5">
              <Timer className="w-4 h-4 text-rust" strokeWidth={1.75} /> Use it up soon
            </h2>
            <select
              value={expiringWindow}
              onChange={(e) => setExpiringWindow(Number(e.target.value))}
              className="text-xs border border-gold-light/60 rounded-full px-2 py-1 bg-white text-charcoal/70"
            >
              {EXPIRING_WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Next {d} days
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {expiringSoon.map((r) => (
              <Link
                key={r.recipe_id}
                href={`/properties/${propertyId}/recipes/${r.recipe_id}`}
                className="shrink-0 w-40 bg-white rounded-xl border border-gold-light/40 shadow-sm shadow-charcoal/5 overflow-hidden hover:border-gold transition-colors"
              >
                <div className="w-full h-20 bg-cream flex items-center justify-center">
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-charcoal/20">🍽️</span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-medium text-charcoal leading-snug line-clamp-2">{r.recipe_name}</p>
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
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-charcoal/40">{t('noResults')}</p>
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
                  <span className="font-display text-lg text-charcoal">{letter}</span>
                  <span className="text-xs text-charcoal/40">({groupRecipes.length})</span>
                  <span className="flex-1 border-t border-gold-light/40" />
                  <span className="text-charcoal/40 text-sm">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {groupRecipes.map((recipe) => (
                      <Link
                        key={recipe.id}
                        href={`/properties/${propertyId}/recipes/${recipe.id}`}
                        className="block rounded-2xl overflow-hidden border border-gold-light/40 bg-white shadow-sm shadow-charcoal/5 hover:border-gold transition-colors"
                      >
                        <div className="relative w-full aspect-[4/3] bg-cream">
                          {recipe.photo_url && isDirectImageUrl(recipe.photo_url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={recipe.photo_url}
                              alt={recipe.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-charcoal/20">
                              {(() => {
                                const Icon = getRecipeIcon(recipe.course);
                                return <Icon className="w-8 h-8" strokeWidth={1.5} />;
                              })()}
                            </div>
                          )}
                          {currentUserId && (
                            <button
                              onClick={(e) => toggleFavorite(recipe.id, e)}
                              className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center"
                              aria-label={favoriteIds.has(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <span className="w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
                                <Star
                                  className={favoriteIds.has(recipe.id) ? 'w-4 h-4 fill-gold text-gold' : 'w-4 h-4 text-charcoal/40'}
                                  strokeWidth={1.75}
                                />
                              </span>
                            </button>
                          )}
                        </div>
                        <div className="p-3">
                          <h2 className="font-display text-lg text-charcoal leading-snug mb-1.5">
                            {recipe.name}
                          </h2>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            {recipe.kosher_type && (
                              <span className="inline-block text-xs font-medium text-charcoal bg-gold-light/30 px-2.5 py-1 rounded-full">
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
                            <div className="flex items-center gap-1 flex-wrap">
                              {recipe.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium text-gold-dark bg-gold/10 px-2 py-0.5 rounded-full"
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
    </div>
  );
}
