'use client';

import { useState } from 'react';
import { ExternalLink, ShoppingCart, ChevronDown, Copy } from 'lucide-react';

interface IngredientShoppingLinkProps {
  ingredient: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    reorder_link?: string | null;
    primary_store?: string | null;
    alternative_stores?: string[] | null;
    is_strictly_kosher?: boolean | null;
  };
  recipeNames?: string[];
  onAddToList?: () => void;
  addingToList?: boolean;
}

const STORE_INFO: Record<string, { name: string; url: (ing: string) => string }> = {
  instacart_costco: {
    name: 'Instacart (Costco)',
    url: (ing) => `https://www.instacart.com/store/costco/s?k=${encodeURIComponent(ing)}`,
  },
  instacart_walmart: {
    name: 'Instacart (Walmart)',
    url: (ing) => `https://www.instacart.com/store/walmart/s?k=${encodeURIComponent(ing)}`,
  },
  instacart_target: {
    name: 'Instacart (Target)',
    url: (ing) => `https://www.instacart.com/store/target/s?k=${encodeURIComponent(ing)}`,
  },
  amazon: { name: 'Amazon', url: (ing) => `https://www.amazon.com/s?k=${encodeURIComponent(ing)}` },
  walmart: { name: 'Walmart', url: (ing) => `https://www.walmart.com/search?q=${encodeURIComponent(ing)}` },
  target: { name: 'Target', url: (ing) => `https://www.target.com/s?searchTerm=${encodeURIComponent(ing)}` },
  costco: { name: 'Costco', url: (ing) => `https://www.costco.com/crt/search?keyword=${encodeURIComponent(ing)}` },
  gourmet_glatt: { name: 'Gourmet Glatt', url: (ing) => `https://www.gourmetglattonline.com/search/${ing}` },
  kosher_west: {
    name: 'Kosher West',
    url: (ing) => `https://kosherwest.com/Lakewood-NJ/search/query=${encodeURIComponent(ing)}`,
  },
  evergreen: { name: 'Evergreen Kosher', url: (ing) => `https://www.shopevergreenkosher.com/search/${ing}` },
};

export default function IngredientShoppingLink({
  ingredient,
  recipeNames = [],
  onAddToList,
  addingToList,
}: IngredientShoppingLinkProps) {
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);

  const primaryStoreCode = ingredient.primary_store;
  const primaryStoreInfo = primaryStoreCode ? STORE_INFO[primaryStoreCode] : null;
  const alternativeStores = (ingredient.alternative_stores || []).slice(0, 5);

  function copyToClipboard() {
    const text = `${ingredient.quantity || ''} ${ingredient.unit || ''} ${ingredient.name}`.trim();
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="flex items-center gap-1 mt-1 print:hidden">
      {ingredient.reorder_link && (
        <a
          href={ingredient.reorder_link}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 flex items-center justify-center rounded-full border border-gold-light/60 text-gold-dark hover:bg-gold-light/10 transition"
          title={primaryStoreInfo ? `Buy at ${primaryStoreInfo.name}` : 'Reorder link'}
        >
          <ExternalLink size={14} strokeWidth={1.75} />
        </a>
      )}

      {onAddToList && (
        <button
          onClick={onAddToList}
          disabled={addingToList}
          className="w-7 h-7 flex items-center justify-center rounded-full border border-gold-light/60 text-gold-dark hover:bg-gold-light/10 transition disabled:opacity-40"
          title="Add to shopping list"
        >
          <ShoppingCart size={14} strokeWidth={1.75} />
        </button>
      )}

      <button
        onClick={copyToClipboard}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-gold-light/60 text-gold-dark hover:bg-gold-light/10 transition"
        title="Copy ingredient"
      >
        <Copy size={14} strokeWidth={1.75} />
      </button>

      {alternativeStores.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-gold-light/60 text-charcoal/60 hover:bg-gold-light/10 transition"
            title="Other stores"
          >
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>

          {showStoreDropdown && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gold-light/40 rounded-lg shadow-md z-10 min-w-[160px]">
              {alternativeStores.map((storeCode, idx) => {
                const storeInfo = STORE_INFO[storeCode];
                if (!storeInfo) return null;
                return (
                  <a
                    key={idx}
                    href={storeInfo.url(ingredient.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 text-sm text-charcoal hover:bg-gold-light/10 transition border-b border-gold-light/20 last:border-b-0"
                  >
                    {storeInfo.name}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      )}

      {recipeNames.length > 0 && (
        <div className="relative ml-1">
          <button
            onClick={() => setShowRecipes(!showRecipes)}
            className="text-xs text-charcoal/40 hover:text-charcoal/60 underline"
          >
            {recipeNames.length} recipe{recipeNames.length !== 1 ? 's' : ''}
          </button>

          {showRecipes && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gold-light/40 rounded-lg shadow-md p-2 z-10 text-xs max-w-xs">
              {recipeNames.map((name, i) => (
                <div key={i} className="text-charcoal/70 py-0.5">
                  • {name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
