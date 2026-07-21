// components/PhotoOrFallback.tsx
// SS-212/SS-160: one shared "photo or fallback" tile instead of each surface
// growing its own. RecipeDetailClient's ingredient rows used a blank
// aria-hidden bg-mist box with no icon or text -- indistinguishable from a
// broken image at a glance. ShoppingListViewEnhanced's main rows already had
// a clear "No photo" label, which is what this generalizes (an icon instead
// of text so it holds up at ingredient-row size too, ~36px, where text
// doesn't fit).
'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export default function PhotoOrFallback({
  src,
  alt = '',
  sizeClass = 'w-9 h-9',
  rounded = 'rounded-lg',
  className = '',
}: {
  src: string | null | undefined;
  alt?: string;
  sizeClass?: string;
  rounded?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} ${rounded} object-cover shrink-0 bg-mist ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${rounded} bg-mist shrink-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <ImageOff className="w-1/2 h-1/2 text-dusk" strokeWidth={1.5} />
    </div>
  );
}
