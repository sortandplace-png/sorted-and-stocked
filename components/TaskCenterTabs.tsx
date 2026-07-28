// components/TaskCenterTabs.tsx
// SS-156 Phase 1: one entry point, not one rewrite.
//
// This is glue, deliberately. It combines Task Center and Duty Roster at
// NAVIGATION -- one route, two tabs -- and swaps which component renders.
// Neither component is touched: not its queries, not its internal logic,
// not its layout. Whichever tab is showing is the same code that ran on
// its own route yesterday.
//
// That is the whole point. Reconciling the two interaction models into a
// genuinely unified view is real work with real risk to two components
// that both work today. This gets "one master screen" from where it is
// clicked, now, at zero risk to either.
//
// Known seam, accepted for Phase 1: each component renders its own page
// chrome (Task Center brings its own background and <h1>, Duty Roster its
// own wider container), so the two tabs do not look like one page yet.
// Fixing that means editing their internals, which is exactly what this
// phase is avoiding.
'use client';

import { useState } from 'react';
import StaffTasksClient from '@/components/StaffTasksClient';
import DutyRosterClient from '@/components/DutyRosterClient';

type Tab = 'tasks' | 'roster';

export default function TaskCenterTabs({ propertyId }: { propertyId: string }) {
  // Plain state, not session-persisted. The repo has
  // useSessionPersistedState and this is a reasonable candidate for it
  // later -- but a tab that silently remembers a choice across visits is a
  // behaviour change, and this phase changes no behaviour.
  const [tab, setTab] = useState<Tab>('tasks');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'roster', label: 'Roster' },
  ];

  return (
    <>
      <div className="bg-[#F9F5EF] pt-4 px-4">
        {/* D-18: the selected tab is bg-denim with white text. Segmented
            control matching the Broad/Detailed switch on Print Labels
            rather than a new pattern. No chevrons -- D-21 exempts menu
            carets, and this is neither. */}
        <div className="max-w-[720px] mx-auto flex rounded-full border border-cardBorder overflow-hidden text-[11px] font-semibold uppercase tracking-[0.15em]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`flex-1 py-2 transition-colors ${
                tab === t.key ? 'bg-denim text-white' : 'bg-linen text-dusk hover:bg-card'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Whole-component swap. Both are mounted fresh on tab change, which
          means each refetches on switch -- the honest trade for not
          touching either one's data layer. */}
      {tab === 'tasks' ? (
        <StaffTasksClient propertyId={propertyId} />
      ) : (
        <DutyRosterClient propertyId={propertyId} />
      )}
    </>
  );
}
