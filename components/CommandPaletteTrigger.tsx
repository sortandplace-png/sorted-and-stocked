// components/CommandPaletteTrigger.tsx
'use client';

import { Search } from 'lucide-react';

export default function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
      aria-label="Search"
      title="Search (Cmd+K)"
      className="hidden md:flex items-center gap-1.5 rounded-full border border-gold-light/60 px-3 py-1.5 text-xs text-charcoal/50 hover:bg-gold-light/10 transition-colors"
    >
      <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>Search</span>
    </button>
  );
}
