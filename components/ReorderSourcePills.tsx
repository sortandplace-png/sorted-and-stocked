// components/ReorderSourcePills.tsx
// Shown only when an item has more than one reorder source -- the common
// single-source case keeps each page's existing link markup untouched (see
// getPreferredSource() call sites), so this never changes how the vast
// majority of items look. Tapping a pill opens that retailer's link and
// makes it the preferred one for next time, via the set_preferred_reorder_source
// RPC (needs to be atomic across rows, so it isn't a plain resilientUpdate
// call) -- fired in the background, not awaited, since it shouldn't block
// or be able to fail the navigation itself.
'use client';

import { createClient } from '@/lib/supabase/client';
import type { ReorderSource } from '@/lib/reorder-sources';

// 'default' is the gold/cream/charcoal palette used everywhere except the
// Dashboard route, which is on the separate Concept B denim/brass/mist
// system -- same behavior either way, just different tokens so the pills
// don't clash with whichever page they land on.
const VARIANT_CLASS: Record<'default' | 'conceptB', string> = {
  default: 'border-cardBorder text-brass hover:bg-linen',
  conceptB: 'border-brass/40 text-brass bg-mist hover:bg-mist/70',
};

export default function ReorderSourcePills({
  sources,
  className = '',
  variant = 'default',
}: {
  sources: ReorderSource[];
  className?: string;
  variant?: 'default' | 'conceptB';
}) {
  if (sources.length < 2) return null;
  const supabase = createClient();

  function handlePillClick(source: ReorderSource) {
    supabase.rpc('set_preferred_reorder_source', { p_id: source.id }).then(() => {});
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} onClick={(e) => e.stopPropagation()}>
      {sources.map((source) => (
        <a
          key={source.id}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handlePillClick(source)}
          className={`px-2.5 py-1 rounded-full border text-xs font-medium transition whitespace-nowrap ${VARIANT_CLASS[variant]}`}
        >
          {source.retailer_name}
        </a>
      ))}
    </div>
  );
}
