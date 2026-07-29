// components/StaffHandbookClient.tsx
// Staff handbook: ten questions, shift order, as a BENTO GRID.
//
// D-20 (supersedes D-15 for this page) -- RACQUEL: "bento never ever list".
// She wrote D-15 and overrode it; its reading-order argument is recorded as
// noted and rejected. Any future rebuild of this page as a single-column list
// citing D-15 is wrong: D-20 governs the handbook.
//
// D-21 (supersedes D-14) -- the gold pin dot IS the collapse control. No
// chevrons, no arrows. Tap the pin or tap the card.
//
// D-19 -- answers render DENIM, not dusk. dusk #7A8A9C on mist #E8EEF6 is
// about 2.9:1, below AA, and these answers carry instructions.
//
// Also kept: no grey subtitle (SS-224), 15px Cormorant denim numerals
// (a numeral is a label, not display type), mist fills, denim strip.
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import PageShell from '@/components/ui/PageShell';
import Pin from '@/components/ui/Pin';
import { routes } from '@/lib/app-routes';
import { ArrowLeftRight, BookOpen, ClipboardList, DoorOpen, Flag, Search } from 'lucide-react';

export type HandbookArticle = {
  id: string;
  question: string;
  short_answer: string;
  detailed_answer: string;
  question_es?: string | null;
  short_answer_es?: string | null;
  detailed_answer_es?: string | null;
};

// The bento rhythm. Each pair sums to 6 so rows stay flush on desktop while
// card sizes visibly vary -- written as literal class strings because Tailwind
// cannot see dynamically built ones.
const SPANS = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-4',
  'lg:col-span-3',
  'lg:col-span-3',
  'lg:col-span-2',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-2',
];

// SS-150. One lucide LINE icon per question, its own set -- not the
// shopping-category PNGs, which are product pictures: a milk bottle beside
// "what do I do first" means nothing. Six icons across ten questions,
// reused where the question is genuinely the same shape of thing.
//
// The links are the point of the ticket. Every destination comes from
// lib/app-routes.ts, which existed since 6416f4c and was imported by
// nothing -- these routes are property-scoped (/properties/[id]/my-day,
// never /staff/my-day) and houseManual resolves to /tools/knowledge-base,
// NOT the title-derived /tools/house-manual, which 404s.
//
// Keyed by help_articles.id rather than array position, so re-ordering or
// inserting an article can't silently shift every icon and link by one.
const GUIDE: Record<
  string,
  { Icon: typeof DoorOpen; links: { key: 'myDay' | 'inventory' | 'shoppingList' | 'houseManual' | 'sops' | 'training'; labelKey: string }[] }
> = {
  'FAQ-101': { Icon: DoorOpen, links: [{ key: 'myDay', labelKey: 'linkMyDay' }] },
  'FAQ-102': { Icon: ClipboardList, links: [{ key: 'myDay', labelKey: 'linkMyDay' }] },
  'FAQ-103': { Icon: Search, links: [{ key: 'inventory', labelKey: 'linkInventory' }] },
  'FAQ-104': { Icon: ArrowLeftRight, links: [{ key: 'inventory', labelKey: 'linkInventory' }] },
  'FAQ-105': {
    Icon: Flag,
    links: [
      { key: 'shoppingList', labelKey: 'linkShoppingList' },
      { key: 'inventory', labelKey: 'linkInventory' },
    ],
  },
  'FAQ-106': {
    Icon: BookOpen,
    links: [
      { key: 'houseManual', labelKey: 'linkHouseManual' },
      { key: 'sops', labelKey: 'linkSops' },
    ],
  },
  'FAQ-107': { Icon: ClipboardList, links: [{ key: 'myDay', labelKey: 'linkMyDay' }] },
  'FAQ-108': { Icon: Flag, links: [{ key: 'myDay', labelKey: 'linkMyDay' }] },
  'FAQ-109': {
    Icon: BookOpen,
    links: [
      { key: 'sops', labelKey: 'linkSops' },
      { key: 'training', labelKey: 'linkTraining' },
    ],
  },
  'FAQ-110': { Icon: ClipboardList, links: [{ key: 'myDay', labelKey: 'linkMyDay' }] },
};

// The ten questions in three shift-phase groups (Racquel approved 2026-07-28).
//
// Static in the component rather than a column on help_articles: the IDs are
// fixed, the grouping is presentation, and a three-row lookup does not earn a
// migration. If sections ever become editable in-app, that is the moment it
// becomes data -- not before.
//
// Keyed by id for the same reason GUIDE is: inserting FAQ-103a should not
// silently push two questions into the wrong phase of the shift.
// `image` is a screenshot of the app page that section is about. The files
// are supplied separately -- until one exists the slot renders nothing
// rather than a broken image, so shipping the markup ahead of the assets
// costs the reader nothing.
const SECTIONS: {
  key: 'sectionStart' | 'sectionDuring' | 'sectionEnd';
  ids: string[];
  image: string;
}[] = [
  { key: 'sectionStart', ids: ['FAQ-101', 'FAQ-102'], image: '/handbook/starting-shift.jpg' },
  {
    key: 'sectionDuring',
    ids: ['FAQ-103', 'FAQ-104', 'FAQ-105', 'FAQ-106', 'FAQ-107', 'FAQ-108'],
    image: '/handbook/during-shift.jpg',
  },
  { key: 'sectionEnd', ids: ['FAQ-109', 'FAQ-110'], image: '/handbook/wrapping-up.jpg' },
];

export default function StaffHandbookClient({
  articles,
  propertyId,
}: {
  articles: HandbookArticle[];
  propertyId: string;
}) {
  const t = useTranslations('staffHandbook');
  const locale = useLocale();
  const es = locale === 'es';
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Which questions this person has actually opened. Session-only, held in
  // component state: there is no read-tracking table and inventing one for
  // a progress hint would be a schema decision, not a UI one. It resets on
  // reload, and that is the honest behaviour rather than a fake streak.
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());

  // Degrades to English if a Spanish field is blank -- readable, never empty.
  const pick = (en: string, esVal?: string | null) => (es && esVal ? esVal : en);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
    setOpenedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  // Live search across whichever language is actually on screen, plus the
  // detailed answer -- someone searching "batteries" should find the
  // question whose answer mentions them, not just its title.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      [
        pick(a.question, a.question_es),
        pick(a.short_answer, a.short_answer_es),
        pick(a.detailed_answer, a.detailed_answer_es),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, query, es]);

  // The flat grid becomes three stacked groups. Two things this has to get
  // right beyond the grouping itself:
  //
  // 1. The numeral stays global. These are "ten questions in shift order",
  //    and the progress strip counts them the same way -- restarting at 1
  //    inside each group would make the card labelled 1 ambiguous across
  //    three places on one screen.
  // 2. Nothing disappears. An article whose id this constant does not name
  //    still renders, in a trailing unheaded group. SECTIONS is a hardcoded
  //    list and help_articles is a table someone can insert into; the
  //    failure mode of a stale constant should be an unsorted card, never a
  //    silently missing instruction.
  const grouped = useMemo(() => {
    const order = new Map(articles.map((a, i) => [a.id, i]));
    const claimed = new Set(SECTIONS.flatMap((s) => s.ids));
    const groups: { key: string; image: string | null; items: HandbookArticle[] }[] = SECTIONS.map(
      (s) => ({
        key: s.key,
        image: s.image,
        items: visible.filter((a) => s.ids.includes(a.id)),
      })
    );
    const unmapped = visible.filter((a) => !claimed.has(a.id));
    if (unmapped.length > 0) groups.push({ key: '', image: null, items: unmapped });
    // Search filters within groups, so a group with no match drops its
    // header too rather than leaving a denim strip over empty space.
    return { groups: groups.filter((g) => g.items.length > 0), order };
  }, [articles, visible]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display text-[34px] font-normal text-denim mb-5">{t('title')}</h1>

      <PageShell
        strip={t('strip', { count: articles.length })}
        stripRight={t('progress', { opened: openedIds.size, total: articles.length })}
      >
        {/* Live search. Above the grid, full width -- ten questions is few
            enough to scan, but someone hunting one word shouldn't have to. */}
        {articles.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="w-full mb-[14px] bg-mist border border-cardBorder rounded-full px-4 py-2 text-[13px] text-denim placeholder:text-dusk focus:border-brass focus:outline-none"
          />
        )}

        {articles.length === 0 ? (
          <p className="text-center italic text-dusk font-display text-lg py-10">{t('empty')}</p>
        ) : visible.length === 0 ? (
          <p className="text-center italic text-dusk font-display text-lg py-10">{t('noResults')}</p>
        ) : (
          <div className="space-y-[22px]">
            {grouped.groups.map((g) => (
              <div key={g.key || '__unmapped'}>
                {/* Same denim strip as the Task Center's room headers --
                    title left, count right, brass pin top-right. Not a
                    button: these do not collapse, and a pin that toggles
                    nothing would be a lie about D-21. The strip on
                    PageShell above is decorative in exactly the same way. */}
                {g.key && (
                  <div className="relative bg-denim rounded-xl2 py-[11px] pl-5 pr-8 mb-[14px] flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white truncate">
                      {t(g.key)}
                    </span>
                    <span className="text-[10px] font-semibold tracking-[0.17em] uppercase text-white/70 shrink-0">
                      {g.items.length}
                    </span>
                    <Pin size="sm" />
                  </div>
                )}

                {/* A contained thumbnail of the app page this section is
                    about, not a banner. It carries no caption and no link:
                    it is orientation for someone who has not used the app
                    yet, and the article cards below are the real content.

                    aria-hidden with an empty alt -- the section header
                    already names it, so a screen reader announcing the
                    screenshot too would just be repetition.

                    onError removes the element rather than leaving a broken
                    image icon: the three files are supplied separately, and
                    the handbook has to look finished before they land. */}
                {g.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.image}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-full max-h-[140px] object-cover rounded-xl2 border border-cardBorder mb-[14px]"
                  />
                )}

                {/* D-20 still governs inside the group: bento, never list.
                    The span index restarts per group so each group's rows
                    stay flush -- SPANS pairs sum to 6, and 2/6/2 all land
                    on pair boundaries. Indexing globally would start the
                    six-question group mid-pair and leave a ragged row. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-[14px] auto-rows-fr">
            {g.items.map((a, gi) => {
              const open = openId === a.id;
              const guide = GUIDE[a.id];
              const numeral = (grouped.order.get(a.id) ?? 0) + 1;
              return (
                // The card is a div wrapping a real <button>, not one big
                // button, because the "go to" links below are real <a>
                // elements and an <a> inside a <button> is invalid HTML --
                // nested interactive content, which browsers and screen
                // readers both handle badly. The toggle keeps its button
                // semantics; the links keep theirs.
                <div
                  key={a.id}
                  // No fixed height: Spanish runs 15-30% longer and would clip.
                  className={`relative bg-mist rounded-xl2 border border-brass/30 shadow-card hover:shadow-cardHover transition-shadow py-[14px] px-[18px] flex flex-col gap-[11px] ${
                    open ? 'sm:col-span-2 lg:col-span-6' : SPANS[gi % SPANS.length]
                  }`}
                >
                  {/* The pin is the control (D-21). Nothing else marks it. */}
                  <Pin size="sm" />

                  <button
                    onClick={() => toggle(a.id)}
                    aria-expanded={open}
                    className="text-left flex flex-col gap-[11px] w-full"
                  >

                  {/* Numeral + its own line icon. Denim on a 1.75 stroke --
                      brass is never a fill and a numeral is a label, not
                      display type (D-01). */}
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[15px] text-denim tabular-nums">{numeral}</span>
                    {guide && (
                      <guide.Icon size={16} className="text-denim shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </span>

                  <span className="font-display text-[18px] text-denim leading-snug pr-4">
                    {pick(a.question, a.question_es)}
                  </span>

                  {/* Hairline between the question and its answer -- the
                      #E8DDD0 border token, not a heavier rule. */}
                  <span className="block border-t border-cardBorder" />

                  {/* Denim, not dusk -- D-19. These are instructions. */}
                  <span className="text-[13px] text-denim leading-relaxed">
                    {pick(a.short_answer, a.short_answer_es)}
                  </span>

                    {open && (
                      <span className="text-[13px] text-denim leading-relaxed whitespace-pre-line border-t border-cardBorder pt-3">
                        {pick(a.detailed_answer, a.detailed_answer_es)}
                      </span>
                    )}
                  </button>

                  {/* The navigation phrases become real destinations.
                      Denim, underlined on hover -- never brass (D-01).
                      Outside the button, so they are ordinary links: no
                      stopPropagation trickery, and keyboard users tab
                      straight to them. */}
                  {open && guide && guide.links.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-[11px] uppercase tracking-[0.15em] text-dusk">{t('goTo')}</span>
                      {guide.links.map((l) => (
                        <Link
                          key={l.key}
                          href={routes[l.key](propertyId)}
                          className="text-[13px] font-medium text-denim underline-offset-2 hover:underline"
                        >
                          {t(l.labelKey)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageShell>
    </div>
  );
}
