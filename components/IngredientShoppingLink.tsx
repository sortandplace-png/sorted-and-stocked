'use client';

import { useState } from 'react';
import Image from 'next/image';

interface IngredientShoppingLinkProps {
  ingredient: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    reorder_link?: string | null;
    primary_store?: string | null;
    alternative_stores?: string[] | null;
    is_strictly_kosher?: boolean | null;
    photo_url?: string | null;
  };
  recipeNames?: string[];
}

const STORE_INFO: Record<string, { name: string; icon: string; url: (ing: string) => string }> = {
  instacart_costco: {
    name: 'Instacart (Costco)',
    icon: '📦',
    url: (ing) => `https://www.instacart.com/store/costco/s?k=${encodeURIComponent(ing)}`,
  },
  instacart_walmart: {
    name: 'Instacart (Walmart)',
    icon: '🏬',
    url: (ing) => `https://www.instacart.com/store/walmart/s?k=${encodeURIComponent(ing)}`,
  },
  instacart_target: {
    name: 'Instacart (Target)',
    icon: '🎯',
    url: (ing) => `https://www.instacart.com/store/target/s?k=${encodeURIComponent(ing)}`,
  },
  amazon: {
    name: 'Amazon',
    icon: '📦',
    url: (ing) => `https://www.amazon.com/s?k=${encodeURIComponent(ing)}`,
  },
  walmart: {
    name: 'Walmart',
    icon: '🏬',
    url: (ing) => `https://www.walmart.com/search?q=${encodeURIComponent(ing)}`,
  },
  target: {
    name: 'Target',
    icon: '🎯',
    url: (ing) => `https://www.target.com/s?searchTerm=${encodeURIComponent(ing)}`,
  },
  costco: {
    name: 'Costco',
    icon: '📦',
    url: (ing) => `https://www.costco.com/crt/search?keyword=${encodeURIComponent(ing)}`,
  },
  gourmet_glatt: {
    name: 'Gourmet Glatt',
    icon: '✡️',
    url: (ing) => `https://www.gourmetglattonline.com/search/${ing}`,
  },
  kosher_west: {
    name: 'Kosher West',
    icon: '✡️',
    url: (ing) => `https://kosherwest.com/Lakewood-NJ/search/query=${encodeURIComponent(ing)}`,
  },
  evergreen: {
    name: 'Evergreen Kosher',
    icon: '🌿',
    url: (ing) => `https://www.shopevergreenkosher.com/search/${ing}`,
  },
};

export default function IngredientShoppingLink({
  ingredient,
  recipeNames = [],
}: IngredientShoppingLinkProps) {
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);

  if (!ingredient.reorder_link || !ingredient.primary_store) {
    return null;
  }

  const primaryStoreCode = ingredient.primary_store;
  const primaryStoreInfo = STORE_INFO[primaryStoreCode] || { name: 'Shop', icon: '🛒', url: () => ingredient.reorder_link || '#' };
  const alternativeStores = (ingredient.alternative_stores || []).slice(0, 5);

  const handleCopyToClipboard = () => {
    const text = `${ingredient.quantity || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard: ' + text);
  };

  return (
    <div className="flex items-start gap-3 mt-2 flex-wrap print:hidden">
      {/* Photo */}
      {ingredient.photo_url && (
        <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-stone-100 border border-gold-light/30">
          <Image
            src={ingredient.photo_url}
            alt={ingredient.name}
            fill
            className="object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {/* Primary store button */}
        <a
          href={ingredient.reorder_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-1 rounded-full bg-aubergine text-cream hover:opacity-90 transition flex items-center gap-1"
        >
          <span>{primaryStoreInfo.icon}</span>
          <span className="text-xs">{primaryStoreInfo.name}</span>
        </a>

        {/* Store dropdown */}
        {alternativeStores.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowStoreDropdown(!showStoreDropdown)}
              className="text-sm px-2 py-1 rounded-full border border-aubergine/30 text-aubergine hover:bg-aubergine/5 transition"
              title="Choose alternative store"
            >
              ⬇️
            </button>

            {showStoreDropdown && (
              <div className="absolute top-full mt-1 right-0 bg-white border border-aubergine/20 rounded-lg shadow-md z-10 min-w-[160px]">
                {alternativeStores.map((storeCode, idx) => {
                  const storeInfo = STORE_INFO[storeCode];
                  if (!storeInfo) return null;

                  return (
                    <a
                      key={idx}
                      href={storeInfo.url(ingredient.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2 text-sm text-aubergine hover:bg-aubergine/5 transition border-b last:border-b-0"
                    >
                      <span>{storeInfo.icon}</span> {storeInfo.name}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={handleCopyToClipboard}
          className="text-sm px-2 py-1 rounded-full border border-gold/30 text-gold hover:bg-gold/5 transition"
          title="Copy ingredient to clipboard"
        >
          📋
        </button>

        {/* Recipe count */}
        {recipeNames.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRecipes(!showRecipes)}
              className="text-xs text-ink/50 hover:text-ink/70 underline"
            >
              {recipeNames.length} recipe{recipeNames.length !== 1 ? 's' : ''}
            </button>

            {showRecipes && (
              <div className="absolute top-full mt-1 right-0 bg-white border border-ink/10 rounded-lg shadow-md p-2 z-10 text-xs max-w-xs">
                {recipeNames.map((name, i) => (
                  <div key={i} className="text-ink/70 py-0.5">
                    • {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
