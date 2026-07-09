'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Timer } from 'lucide-react';
import { kosherIcon } from '@/lib/icon-maps';
import { getRecipeIcon } from '@/lib/recipe-icons';
import { COURSES } from '@/lib/course-constants';
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

const KOSHER_TYPES = ['Meat', 'Dairy', 'Parve', 'Parve (Fish)'];

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
      if (kosherFilter && r.kosher_type !== kosherFilter) return false;
      if (occasionFilter && !matchesOccasion(r, occasionFilter)) return false;
      return true;
    });
  }, [search, recipes, courseFilter, kosherFilter, occasionFilter]);

  const hasActiveFilters = !!courseFilter || !!kosherFilter || !!occasionFilter;

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
        {canManage(role) && (
          <button
            onClick={() => setShowNewRecipe(true)}
            className="text-sm font-medium bg-gold-dark text-white px-4 py-2 rounded-full hover:opacity-90 transition"
          >
            + {t('newRecipe')}
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-3"
      />

      <div className="flex flex-wrap gap-1.5 mb-5">
        {COURSES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCourseFilter(courseFilter === c.key ? null : c.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              courseFilter === c.key ? 'bg-gold-dark text-white' : 'bg-white border border-gold-light/50 text-charcoal/60 hover:bg-gold-light/10'
            }`}
          >
            {c.icon} {c.label}
          </button>
        ))}
        <span className="w-px bg-gold-light/40 mx-0.5" />
        {KOSHER_TYPES.map((k) => (
          <button
            key={k}
            onClick={() => setKosherFilter(kosherFilter === k ? null : k)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              kosherFilter === k ? 'bg-gold-dark text-white' : 'bg-white border border-gold-light/50 text-charcoal/60 hover:bg-gold-light/10'
            }`}
          >
            {kosherIcon(k)} {k}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setCourseFilter(null);
              setKosherFilter(null);
              setOccasionFilter(null);
            }}
            className="text-xs text-charcoal/40 hover:text-charcoal px-3 py-1.5 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-charcoal/40 mb-1.5">Occasion</p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['shabbos', '✨ Shabbos'],
              ['yomtov', '🕎 Yom Tov'],
              ['pesach', '✡️ Pesach'],
              ['weekday', '📅 Weekday'],
            ] as [Occasion, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOccasionFilter(occasionFilter === key ? null : key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                occasionFilter === key ? 'bg-gold-dark text-white' : 'bg-white border border-gold-light/50 text-charcoal/60 hover:bg-gold-light/10'
              }`}
            >
              {label}
            </button>
          ))}
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
                              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-xl"
                              aria-label={favoriteIds.has(recipe.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {favoriteIds.has(recipe.id) ? '⭐' : '☆'}
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
