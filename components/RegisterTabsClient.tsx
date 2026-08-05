// components/RegisterTabsClient.tsx
// Two tabs on one page (Racquel, 4 Aug): "NOT PILLS OR LISTS!!!!" ruled out
// the details/summary list the Drafts section used to be -- but the tab
// SWITCH itself is exactly the segmented pill control the Staff Handbook
// already uses (same visual language HandbookTabs.tsx sets up: bg-denim
// selected, ?tab= in the URL so a refresh or a shared link lands on the
// right tab). Register stays the default, unchanged tab; Blog Drafts is
// new. Not a new page, not a new route, not a nav entry -- both live at
// /properties/[id]/register.
'use client';

import { useEffect, useState } from 'react';
import RegisterViewerClient, { type WorkItemRow } from '@/components/RegisterViewerClient';
import BlogDraftsClient, { type DraftRow } from '@/components/BlogDraftsClient';

export type { WorkItemRow, DraftRow };

type Tab = 'register' | 'drafts';

export default function RegisterTabsClient({
  rows,
  drafts,
  propertyId,
  readAt,
}: {
  rows: WorkItemRow[];
  drafts: DraftRow[];
  propertyId: string;
  /** SS-681: server read time, threaded through as data. See the register page. */
  readAt: string;
}) {
  const [tab, setTab] = useState<Tab>('register');

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (wanted === 'drafts') setTab('drafts');
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'register') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState({}, '', url);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'register', label: 'Register' },
    { key: 'drafts', label: `Blog Drafts${drafts.length > 0 ? ` (${drafts.length})` : ''}` },
  ];

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
        <div className="flex rounded-full border border-cardBorder overflow-hidden text-[11px] font-semibold uppercase tracking-[0.15em]">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => selectTab(tb.key)}
              aria-pressed={tab === tb.key}
              className={`flex-1 py-2 transition-colors ${
                tab === tb.key ? 'bg-denim text-white' : 'bg-linen text-dusk hover:bg-card'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'register' ? (
        <RegisterViewerClient rows={rows} readAt={readAt} />
      ) : (
        <BlogDraftsClient drafts={drafts} propertyId={propertyId} />
      )}
    </div>
  );
}
