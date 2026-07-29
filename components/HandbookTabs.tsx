// components/HandbookTabs.tsx
// One page, two audiences-of-one-person: the Household Guide answers "what
// do I do when X happens", the Procedures tab is the SOP reference for
// "how exactly is this done". Same URL, ?tab= selects.
//
// Neither child component was rewritten. StaffHandbookClient and
// SopLibraryClient render exactly as they do on their own routes -- this
// only decides which one is mounted.
//
// SOPs are fetched HERE, lazily, on first switch to Procedures. The
// handbook is the fast always-open page; loading 55 SOPs on every visit to
// answer a ten-question FAQ would be paying for the tab nobody opened.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';
import StaffHandbookClient, { type HandbookArticle } from '@/components/StaffHandbookClient';
import SopLibraryClient, { type Sop } from '@/components/SopLibraryClient';

type Tab = 'guide' | 'procedures';

export default function HandbookTabs({
  articles,
  propertyId,
}: {
  articles: HandbookArticle[];
  propertyId: string;
}) {
  const t = useTranslations('staffHandbook');
  const supabase = createClient();

  // Seeded from the URL on mount so ?tab=procedures opens on the right tab
  // -- which is what /staff/sops redirects into, and what the Task Center's
  // "View full procedure" link depends on. Read from window.location rather
  // than useSearchParams() to avoid forcing the page into client-side
  // rendering without a Suspense boundary.
  const [tab, setTab] = useState<Tab>('guide');
  const [sops, setSops] = useState<Sop[] | null>(null);
  const [loadingSops, setLoadingSops] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'procedures') {
      setTab('procedures');
    }
  }, []);

  const loadSops = useCallback(async () => {
    // Fetch once per visit, not once per tab switch.
    if (sops !== null || loadingSops) return;
    setLoadingSops(true);
    const { data } = await supabase
      .from('sop_library')
      .select(
        'id, sop_code, zone_type, task_en, task_es, sop_en, sop_es, pass_fail_en, pass_fail_es, estimated_minutes, expected_appearance_url'
      )
      .eq('active', true)
      .order('zone_type')
      .order('task_en');
    setSops((data as Sop[]) ?? []);
    setLoadingSops(false);
  }, [sops, loadingSops, supabase]);

  useEffect(() => {
    if (tab === 'procedures') loadSops();
  }, [tab, loadSops]);

  function selectTab(next: Tab) {
    setTab(next);
    // Keep the URL honest so the tab survives a refresh and can be shared,
    // without a navigation -- replaceState leaves history alone, so Back
    // still means "the page before this one", not "the other tab".
    const url = new URL(window.location.href);
    if (next === 'procedures') url.searchParams.set('tab', 'procedures');
    else url.searchParams.delete('tab');
    window.history.replaceState({}, '', url);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'guide', label: t('tabGuide') },
    { key: 'procedures', label: t('tabProcedures') },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8">
      {/* D-18: the selected tab is bg-denim with white text. Same segmented
          control the Shopping List and Print Labels already use, rather
          than a third tab pattern. */}
      <div className="flex rounded-full border border-cardBorder overflow-hidden text-[11px] font-semibold uppercase tracking-[0.15em] mb-5">
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

      {tab === 'guide' ? (
        <StaffHandbookClient articles={articles} propertyId={propertyId} />
      ) : sops === null ? (
        <SkeletonList rows={4} />
      ) : (
        <SopLibraryClient initialSops={sops} />
      )}
    </div>
  );
}
