// components/BrachaCategorySelect.tsx
// Custom listbox replacing a native <select> -- a native <option> can only
// render one line of plain text, which can't give the bracha name (Shehakol,
// Ha'adama, etc.) its own prominent styling separate from the category
// description. Shared by RecipeBracha and InventoryBracha, which otherwise
// duplicated this exact dropdown. Focus stays on the trigger button at all
// times (the ARIA 1.2 combobox-with-listbox-popup pattern, using
// aria-activedescendant) rather than moving DOM focus into the popup and
// back -- fewer moving parts than a roving-tabindex listbox.
'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type BrachaCategoryRow = {
  category: string;
  bracha_rishona: string;
  bracha_achrona: string;
  note: string | null;
};

// Categories are a human title, not a raw db key (e.g. "grain_mezonos" ->
// "Grain Mezonos") -- derived from the row itself so this never drifts from
// bracha_categories. Left untranslated on purpose -- halachic terms, same
// treatment as Shabbos/Parve elsewhere in the app.
function titleCase(key: string) {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

type Option = { category: string | null; label: string; sub: string | null };

export default function BrachaCategorySelect({
  categories,
  value,
  onChange,
  disabled,
  notSetLabel,
}: {
  categories: BrachaCategoryRow[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  notSetLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const options: Option[] = [
    { category: null, label: notSetLabel, sub: null },
    ...categories.map((c) => ({
      category: c.category,
      label: c.bracha_rishona,
      // The two Shehakol categories (beverages_other, meat_fish_dairy_eggs)
      // read identically on the bracha name alone -- this subtext is what
      // keeps them told apart, same as before this component existed.
      sub: titleCase(c.category),
    })),
  ];

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.category === value)
  );
  const current = options[selectedIndex];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function openList() {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function selectOption(index: number) {
    onChange(options[index].category);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectOption(activeIndex);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-opt-${activeIndex}` : undefined}
        className="w-full flex items-center justify-between gap-2 border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl px-3 py-2.5 text-sm text-denim disabled:opacity-60 bg-white text-left"
      >
        <span className="min-w-0">
          <span className="font-semibold text-denim">{current.label}</span>
          {current.sub && <span className="block text-xs text-dusk leading-tight">{current.sub}</span>}
        </span>
        <span
          className={`text-dusk text-xs shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-cardBorder rounded-xl shadow-md shadow-charcoal/10 z-30 py-1"
        >
          {options.map((o, i) => (
            <li
              key={o.category ?? '__unset'}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={o.category === value}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => selectOption(i)}
              className={`px-3 py-2 cursor-pointer ${i === activeIndex ? 'bg-linen' : ''}`}
            >
              <span className="block text-sm font-semibold text-denim">{o.label}</span>
              {o.sub && <span className="block text-xs text-dusk">{o.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
