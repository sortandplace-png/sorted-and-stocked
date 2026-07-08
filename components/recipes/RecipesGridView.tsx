'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { kosherIcon } from '@/lib/icon-maps';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import NewRecipeModal from '@/components/NewRecipeModal';

interface Recipe {
  id: string;
  name: string;
  photo_url: string | null;
  kosher_type: string | null;
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
  const [search, setSearch] = useState('');
  const [showNewRecipe, setShowNewRecipe] = useState(false);
  const [collapsedLetters, setCollapsedLetters] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [search, recipes]);

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
        <h1 className="text-2xl font-display text-aubergine">{t('title')}</h1>
        {canManage(role) && (
          <button
            onClick={() => setShowNewRecipe(true)}
            className="text-sm font-medium bg-gold text-white px-4 py-2 rounded-full hover:opacity-90 transition"
          >
            + {t('newRecipe')}
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full border border-gold-light/60 rounded-2xl px-4 py-2.5 bg-cream/40 mb-5"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-ink/40">{t('noResults')}</p>
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
                  <span className="font-display text-lg text-aubergine">{letter}</span>
                  <span className="text-xs text-ink/40">({groupRecipes.length})</span>
                  <span className="flex-1 border-t border-gold-light/40" />
                  <span className="text-ink/40 text-sm">{collapsed ? '▸' : '▾'}</span>
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                    {groupRecipes.map((recipe) => (
                      <Link
                        key={recipe.id}
                        href={`/properties/${propertyId}/recipes/${recipe.id}`}
                        className="block rounded-2xl overflow-hidden border border-gold-light/40 bg-white hover:border-gold transition-colors"
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
                            <div className="w-full h-full flex items-center justify-center text-ink/20 text-3xl">
                              🍽️
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h2 className="font-display text-lg text-aubergine leading-snug mb-1.5">
                            {recipe.name}
                          </h2>
                          {recipe.kosher_type && (
                            <span className="inline-block text-xs font-medium text-aubergine bg-gold-light/30 px-2.5 py-1 rounded-full">
                              {kosherIcon(recipe.kosher_type)} {recipe.kosher_type}
                            </span>
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
