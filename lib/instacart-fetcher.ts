// lib/instacart-fetcher.ts
// Batch fetch ingredient photos via Openverse (free, no API key, CC-licensed images)

export interface ProductResult {
  name: string;
  photo_url?: string;
  photo_candidates?: string[];
  source: 'openverse' | 'manufacturer' | 'none';
}

// Manufacturer website photo lookup (hardcoded for popular brands)
async function fetchManufacturerPhoto(
  ingredientName: string
): Promise<{ photo?: string; source: string }> {
  const lowerName = ingredientName.toLowerCase();

  const brandPhotos: Record<string, string> = {
    salt: 'https://www.mccormick.com/american-spice-trade-association/salt',
    pepper: 'https://www.mccormick.com/pepper',
    flour: 'https://www.kingarthurbaking.com/products/bread-flour',
    sugar: 'https://www.domino.com/products/granulated-sugar',
    olive_oil: 'https://www.pompeian.com/product/extra-virgin-olive-oil',
  };

  for (const [brand, url] of Object.entries(brandPhotos)) {
    if (lowerName.includes(brand)) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
        if (ogImageMatch?.[1]) {
          return { photo: ogImageMatch[1], source: 'manufacturer' };
        }
      } catch {
        // Silently continue
      }
    }
  }

  return { source: 'none' };
}

// Openverse OAuth2 client-credentials token, cached in-process (12hr expiry).
// Registered app raises rate limits above the 200/day anonymous tier once
// the account email is verified; falls back to anonymous access otherwise.
let openverseToken: { token: string; expiresAt: number } | null = null;

async function getOpenverseToken(): Promise<string | null> {
  const clientId = process.env.OPENVERSE_CLIENT_ID;
  const clientSecret = process.env.OPENVERSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (openverseToken && openverseToken.expiresAt > Date.now()) {
    return openverseToken.token;
  }

  try {
    const response = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { access_token: string; expires_in: number };
    openverseToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return openverseToken.token;
  } catch {
    return null;
  }
}

// Recipe ingredient names are often messy fragments ("chicken bottoms",
// "cornstarch diluted in 4 Tbsp water", "Egg (for wash)") carried over from
// free-text recipe parsing. Stripping prep/quantity noise words before
// searching gets Openverse's keyword search onto the actual food item
// instead of matching unrelated tags on the noise words.
const PREP_NOISE_WORDS = [
  'diced', 'chopped', 'sliced', 'minced', 'crushed', 'grated', 'shredded',
  'melted', 'softened', 'divided', 'to taste', 'for wash', 'for garnish',
  'optional', 'or to taste', 'toasted', 'cooked', 'raw', 'fresh', 'dried',
  'chilled', 'room temperature', 'large', 'medium', 'small',
];

function cleanIngredientQuery(ingredientName: string): string {
  let cleaned = ingredientName
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical notes
    .replace(/[–—-]/g, ' ') // drop stray dashes from truncated quantities
    .toLowerCase();

  for (const word of PREP_NOISE_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'g'), ' ');
  }

  cleaned = cleaned.replace(/\b\d+([./]\d+)?\b/g, ' ') // stray numbers
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || ingredientName;
}

// Returns up to 3 candidate thumbnail URLs so the caller can fall back if
// the top result's thumbnail turns out to be a dead link (Openverse's own
// thumbnail proxy returns 424 for a meaningful fraction of results, since it
// depends on the original third-party host still serving the image).
async function searchOpenverse(
  query: string,
  token: string | null
): Promise<string[]> {
  const headers: Record<string, string> = { 'User-Agent': 'SortedAndStocked/1.0' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=3`,
    { headers }
  );
  if (!response.ok) return [];

  const data = (await response.json()) as {
    results?: Array<{ thumbnail?: string; url?: string }>;
  };
  return (data.results || [])
    .map(r => r.thumbnail || r.url)
    .filter((u): u is string => !!u);
}

// Openverse: free CC-licensed image search. Uses their thumbnail proxy
// (api.openverse.org) instead of hotlinking the original source, since many
// providers (Flickr, StockSnap) block hotlinked server-side image requests
// without a browser Referer.
//
// Openverse's search is an AND across all query terms, so leftover filler
// words ("pure", "package") in a cleaned ingredient name can zero out an
// otherwise-findable match ("pure tahini paste" -> 0 results, "tahini paste"
// -> 52). Rather than maintain an ever-growing filler-word blocklist, retry
// with progressively shorter suffixes of the cleaned query.
async function fetchOpenversePhoto(
  ingredientName: string
): Promise<{ candidates: string[]; source: string }> {
  try {
    const token = await getOpenverseToken();
    const cleaned = cleanIngredientQuery(ingredientName);
    const words = cleaned.split(' ').filter(Boolean);

    const attempts = [cleaned];
    if (words.length > 2) attempts.push(words.slice(-2).join(' '));
    if (words.length > 1) attempts.push(words.slice(-1).join(' '));

    for (const attempt of attempts) {
      const candidates = await searchOpenverse(attempt, token);
      if (candidates.length > 0) return { candidates, source: 'openverse' };
    }

    return { candidates: [], source: 'none' };
  } catch {
    return { candidates: [], source: 'error' };
  }
}

// Main fetcher: try manufacturer (exact brand match) → Openverse (general search)
export async function fetchProductPhoto(
  ingredientName: string
): Promise<ProductResult> {
  const manufacturer = await fetchManufacturerPhoto(ingredientName);
  if (manufacturer.photo) {
    return {
      name: ingredientName,
      photo_url: manufacturer.photo,
      source: 'manufacturer',
    };
  }

  const openverse = await fetchOpenversePhoto(ingredientName);
  return {
    name: ingredientName,
    photo_url: openverse.candidates[0],
    photo_candidates: openverse.candidates,
    source: openverse.candidates.length > 0 ? 'openverse' : 'none',
  };
}

// Batch fetch multiple ingredients
export async function batchFetchPhotos(
  ingredients: string[]
): Promise<ProductResult[]> {
  // Rate limit: fetch 2 at a time to avoid overwhelming external APIs
  const results: ProductResult[] = [];

  for (let i = 0; i < ingredients.length; i += 2) {
    const batch = ingredients.slice(i, i + 2);
    const batchResults = await Promise.all(
      batch.map(name => fetchProductPhoto(name))
    );
    results.push(...batchResults);

    if (i + 2 < ingredients.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
