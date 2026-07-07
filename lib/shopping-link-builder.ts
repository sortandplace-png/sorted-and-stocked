// lib/shopping-link-builder.ts
// Build shopping links based on kosher classification + availability

export interface IngredientWithContext {
  name: string;
  recipeIds: string[];
  recipeKosherTypes: string[];
}

export interface StoreLink {
  store: string;
  url: string;
  icon: string;
}

// Determine if ingredient is strictly kosher (used only in meat/dairy/fish recipes)
export function isStrictlyKosher(kosherTypes: string[]): boolean {
  const strictlyKosherTypes = ['Meat', 'Fleishig', 'Dairy', 'Milchig', 'Fish'];
  const hasStrict = kosherTypes.some(kt => strictlyKosherTypes.includes(kt));
  // Match "Parve" and variants like "Parve (Fish)" — any recipe tagged as a
  // kind of Parve means this ingredient can't be assumed meat/dairy-only.
  const hasParve = kosherTypes.some(kt => kt.startsWith('Parve'));

  // If ALL recipes using this ingredient are strictly kosher (no Parve), mark as strictly kosher
  return hasStrict && !hasParve;
}

// Generate primary store based on kosher classification
export function getPrimaryStore(isStrictlyKosher: boolean): string {
  if (isStrictlyKosher) {
    return 'gourmet_glatt'; // Default kosher store
  }
  return 'instacart'; // Default for general items
}

// Build Instacart URLs for stores (prioritized over direct links)
export function buildInstacartStoreUrl(store: string, ingredientName: string): string {
  const term = encodeURIComponent(ingredientName);
  // Instacart store URLs follow pattern: /store/{store-name}/search?q=...
  const storeMap: Record<string, string> = {
    costco: 'costco',
    walmart: 'walmart',
    target: 'target',
    // Kosher stores not available on Instacart
  };

  if (storeMap[store]) {
    return `https://www.instacart.com/store/${storeMap[store]}/s?k=${term}`;
  }

  return `https://www.instacart.com/search?q=${term}`;
}

// Build direct store URLs (fallback when not on Instacart)
export function buildDirectStoreUrl(store: string, ingredientName: string): string {
  const term = encodeURIComponent(ingredientName);

  switch (store) {
    case 'costco':
      return `https://www.costco.com/crt/search?keyword=${term}`;
    case 'walmart':
      return `https://www.walmart.com/search?q=${term}`;
    case 'target':
      return `https://www.target.com/s?searchTerm=${term}`;
    case 'amazon':
      return `https://www.amazon.com/s?k=${term}`;
    case 'gourmet_glatt':
      return `https://www.gourmetglattonline.com/search/${ingredientName}`;
    case 'kosher_west':
      return `https://kosherwest.com/Lakewood-NJ/search/query=${term}`;
    case 'evergreen':
      return `https://www.shopevergreenkosher.com/search/${ingredientName}`;
    default:
      return `https://www.instacart.com/search?q=${term}`;
  }
}

// Kosher store URLs (not on Instacart)
export function buildKosherStoreUrls(ingredientName: string): Record<string, string> {
  const term = encodeURIComponent(ingredientName);
  return {
    gourmet_glatt: buildDirectStoreUrl('gourmet_glatt', ingredientName),
    kosher_west: buildDirectStoreUrl('kosher_west', ingredientName),
    evergreen: buildDirectStoreUrl('evergreen', ingredientName),
  };
}

// Build complete shopping link recommendation
export function buildShoppingLinkRecommendation(
  ingredient: IngredientWithContext
): {
  reorder_link: string;
  primary_store: string;
  alternative_stores: string[];
  is_strictly_kosher: boolean;
  reasoning: string;
} {
  const isStrictly = isStrictlyKosher(ingredient.recipeKosherTypes);

  if (isStrictly) {
    // Strictly kosher: primary is Gourmet Glatt (direct), alternatives are other kosher stores
    return {
      reorder_link: buildDirectStoreUrl('gourmet_glatt', ingredient.name),
      primary_store: 'gourmet_glatt',
      alternative_stores: ['kosher_west', 'evergreen'],
      is_strictly_kosher: true,
      reasoning: `Strictly kosher (used in ${ingredient.recipeKosherTypes.join(', ')} recipes only)`,
    };
  } else {
    // General items: prioritize Instacart versions of major stores
    // Primary: Costco via Instacart (most competitive pricing)
    return {
      reorder_link: buildInstacartStoreUrl('costco', ingredient.name),
      primary_store: 'instacart_costco',
      alternative_stores: ['instacart_walmart', 'instacart_target', 'amazon', 'walmart', 'target'],
      is_strictly_kosher: false,
      reasoning: `General item (${ingredient.recipeKosherTypes.join(', ')})`,
    };
  }
}

// Generate all alternative store URLs for dropdown
export function getAllAlternativeUrls(
  ingredientName: string,
  isStrictly: boolean
): Record<string, string> {
  if (isStrictly) {
    // Kosher items: all kosher stores
    return {
      gourmet_glatt: buildDirectStoreUrl('gourmet_glatt', ingredientName),
      kosher_west: buildDirectStoreUrl('kosher_west', ingredientName),
      evergreen: buildDirectStoreUrl('evergreen', ingredientName),
    };
  } else {
    // General items: Instacart versions first, then direct links
    return {
      instacart_costco: buildInstacartStoreUrl('costco', ingredientName),
      instacart_walmart: buildInstacartStoreUrl('walmart', ingredientName),
      instacart_target: buildInstacartStoreUrl('target', ingredientName),
      amazon: buildDirectStoreUrl('amazon', ingredientName),
      walmart: buildDirectStoreUrl('walmart', ingredientName),
      target: buildDirectStoreUrl('target', ingredientName),
      costco: buildDirectStoreUrl('costco', ingredientName),
    };
  }
}
