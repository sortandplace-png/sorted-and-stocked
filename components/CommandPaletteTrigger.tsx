// components/CommandPaletteTrigger.tsx
// Icon-only by default; clicking expands it into a real inline text input
// right in the header instead of jumping straight to the full-screen
// palette. Typing + Enter (or the input losing focus with an empty value)
// hands off to the existing CommandPalette modal, which owns the actual
// search/results logic -- this component only owns the compact/expanded
// header chrome, not a second copy of the search itself.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CommandPaletteTrigger() {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('common');

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    function onClickAway(e: MouseEvent) {
      if (!value.trim() && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [expanded, value]);

  function openPalette(query: string) {
    window.dispatchEvent(new CustomEvent('open-command-palette', { detail: { query } }));
    setValue('');
    setExpanded(false);
  }

  return (
    <div ref={containerRef} className="hidden md:flex items-center">
      {expanded ? (
        <div className="flex items-center gap-1.5 rounded-full border border-gold-active px-3 py-1.5 text-xs bg-white">
          <Search className="h-3.5 w-3.5 text-charcoal/40 shrink-0" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) openPalette(value.trim());
              if (e.key === 'Escape') {
                setValue('');
                setExpanded(false);
              }
            }}
            placeholder={t('search')}
            className="w-32 outline-none bg-transparent text-charcoal placeholder:text-charcoal/40"
          />
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          aria-label={t('searchShortcut')}
          title={t('searchShortcut')}
          className="flex items-center gap-1.5 rounded-full border border-gold-light/60 px-3 py-1.5 text-xs text-charcoal/60 hover:bg-gold-light/10 transition-colors"
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {t('findLabel')}
        </button>
      )}
    </div>
  );
}
