// components/SopLibraryClient.tsx
// Browsable surface for sop_library -- 40 bilingual SOPs that existed with no
// page anywhere in the app, and which master_tasks.sop_id links to on only 1
// of 141 tasks. Making them readable is what lets a task card point at its
// SOP instead of repeating the text.
//
// sop_library is GLOBAL, not property-scoped (no property_id column). Its RLS
// already matches what's needed here and no migration was required:
//   sop_read  -> auth.uid() is not null   (any signed-in user, incl. staff)
//   sop_write -> owner/manager on any property
// The canManage gate below mirrors sop_write so staff get a clean read-only
// view rather than edit affordances that would fail at the database.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import Pin from '@/components/PinAccent';
import { Search, X } from 'lucide-react';
import SopPosterUpload from '@/components/SopPosterUpload';
import TaskSuppliesList from '@/components/TaskSuppliesList';
import { fetchSuppliesForSop, type TaskSupply } from '@/lib/task-supplies';

export type Sop = {
  id: string;
  sop_code: string | null;
  zone_type: string | null;
  zone_type_es: string | null;
  task_en: string;
  task_es: string;
  sop_en: string | null;
  sop_es: string | null;
  pass_fail_en: string | null;
  pass_fail_es: string | null;
  estimated_minutes: number | null;
  /** SS-363: stored public-style path reference, not a directly usable URL
   *  -- sop-posters is a private bucket now. Null for the SOPs with no
   *  poster yet. Kept for SopPosterUpload, which re-signs it independently
   *  when a manager opens the editor. */
  expected_appearance_url: string | null;
  /** Freshly signed, per-size-tier URLs (lib/sop-posters.ts), minted by
   *  HandbookTabs alongside the fetch. Null exactly when
   *  expected_appearance_url is null. */
  posterThumbUrl: string | null;
  posterDetailUrl: string | null;
  posterFullUrl: string | null;
  photo_verification: boolean;
};

const FIELD =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-3 py-2 text-sm text-denim';

export default function SopLibraryClient({
  initialSops,
  propertyId,
}: {
  initialSops: Sop[];
  /** Needed only for the supplies list. sop_library itself stays global --
   *  per the SS-382 model, property specificity lives on the task, so a
   *  procedure's supplies are this property's tasks' supplies, never every
   *  property's. */
  propertyId: string;
}) {
  const t = useTranslations('sopLibrary');
  const locale = useLocale();
  const role = usePropertyRole();
  const editable = canManage(role);
  const supabase = createClient();
  const showToast = useToast();

  const [sops, setSops] = useState<Sop[]>(initialSops);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ sop_en: string; sop_es: string }>({ sop_en: '', sop_es: '' });
  const [saving, setSaving] = useState(false);
  // Fetched lazily, per SOP, when a card is opened -- there are 83 SOPs and
  // only the open one's supplies are ever on screen, so loading all of them
  // up front would be 83 rows of work to display at most one. Keyed by sop
  // id; a key present with an empty array means "checked, none" and stops a
  // refetch on every reopen.
  const [suppliesBySop, setSuppliesBySop] = useState<Map<string, TaskSupply[]>>(new Map());

  useEffect(() => {
    if (!openId || suppliesBySop.has(openId)) return;
    let cancelled = false;
    fetchSuppliesForSop(supabase, openId, propertyId)
      .then((rows) => {
        if (cancelled) return;
        setSuppliesBySop((prev) => new Map(prev).set(openId, rows));
      })
      .catch(() => {
        // Non-fatal: the procedure itself still reads fine without its
        // supply list, same principle as the Task Center's own handling.
        if (!cancelled) setSuppliesBySop((prev) => new Map(prev).set(openId, []));
      });
    return () => {
      cancelled = true;
    };
  }, [openId, propertyId, supabase, suppliesBySop]);

  // Deep link: /staff/sops?sop=<id> opens that SOP directly. Added because
  // the Task Center now links here per task, and a link that lands on a
  // 55-row list without opening the one SOP you asked for is a link that
  // only half works.
  //
  // Read from window.location on mount rather than useSearchParams(): that
  // hook opts the whole page into client-side rendering unless it is
  // wrapped in a Suspense boundary, which is a bigger change than this
  // needs. One-shot on mount is enough -- the param only matters on
  // arrival.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('sop');
    if (!wanted) return;
    setOpenId(wanted);
    // Let the expanded card render before scrolling to it.
    requestAnimationFrame(() => {
      document.getElementById(`sop-${wanted}`)?.scrollIntoView({ block: 'center' });
    });
  }, []);

  const pick = (en: string | null, es: string | null) => (locale === 'es' ? es || en : en) ?? '';

  // Search covers BOTH languages regardless of the current locale, so a
  // Spanish-speaking staff member finds an SOP typed in English and vice
  // versa. Accent handling is deliberately not attempted here -- that needs a
  // real decision (unaccent is not installed; pg_trgm is) and doing it half
  // way in the client would give inconsistent results against a later
  // server-side search.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sops;
    return sops.filter((s) =>
      // Both zone spellings are searchable regardless of UI language: a
      // Spanish reader who knows the zone as "Baño" and one who typed
      // "Bathroom" should both find it.
      [s.task_en, s.task_es, s.sop_en, s.sop_es, s.sop_code, s.zone_type, s.zone_type_es]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [sops, search]);

  const byZone = useMemo(() => {
    const map = new Map<string, Sop[]>();
    for (const s of filtered) {
      // Spanish when the toggle is ES and a translation exists, English
      // otherwise. zone_type_es is nullable on purpose, so an untranslated
      // zone degrades to the English name rather than to a blank eyebrow --
      // this is the grouping key, so a null here would collapse every
      // untranslated zone into one heading.
      const key = (locale === 'es' && s.zone_type_es) || s.zone_type || t('unzoned');
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    // Collated in the reader's own locale, so Spanish headings sort by
    // Spanish rules rather than raw code points.
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], locale));
  }, [filtered, t, locale]);

  function startEdit(s: Sop) {
    setEditingId(s.id);
    setDraft({ sop_en: s.sop_en ?? '', sop_es: s.sop_es ?? '' });
  }

  // SopPosterUpload writes directly to sop_library itself (upload, remove,
  // and the verification toggle all commit immediately, unlike the text
  // fields above which stage into `draft` until Save) -- this just syncs
  // that already-saved result into local state.
  function handlePosterUpdated(
    sopId: string,
    patch: Partial<{
      expected_appearance_url: string | null;
      photo_verification: boolean;
      posterThumbUrl: string | null;
      posterDetailUrl: string | null;
      posterFullUrl: string | null;
    }>
  ) {
    setSops((prev) => prev.map((x) => (x.id === sopId ? { ...x, ...patch } : x)));
  }

  async function save(s: Sop) {
    // Both languages required, consistent with the rest of the app -- staff
    // read the Spanish, so an English-only SOP is unusable to them.
    if (!draft.sop_en.trim() || !draft.sop_es.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('sop_library')
      .update({ sop_en: draft.sop_en.trim(), sop_es: draft.sop_es.trim() })
      .eq('id', s.id);
    setSaving(false);
    if (error) {
      showToast(t('saveFailed'), { variant: 'error' });
      return;
    }
    setSops((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, sop_en: draft.sop_en.trim(), sop_es: draft.sop_es.trim() } : x))
    );
    setEditingId(null);
    showToast(t('saved'), { variant: 'success' });
  }

  return (
    // No own max-w/mx-auto here -- this only ever mounts inside
    // HandbookTabs' Procedures tab now (both /tools/sops and /staff/sops
    // are redirect stubs into it), which already provides max-w-5xl
    // centering. A second, narrower max-w-4xl here was clamping the grid
    // below what the page actually has room for.
    <div className="pb-4">
      <h1 className="text-2xl font-display text-denim mb-1">{t('title')}</h1>
      <p className="text-sm text-dusk mb-4">{t('description', { count: sops.length })}</p>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brass" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className={`${FIELD} pl-9`}
        />
      </div>

      {byZone.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-card rounded-xl2 border border-cardBorder shadow-card">
          {/* Empty-because-filtered vs empty-because-none-exist, same rule as
              the duty roster. */}
          {sops.length === 0 ? t('emptyNone') : t('emptyFiltered')}
        </p>
      ) : (
        <div className="space-y-6">
          {byZone.map(([zone, items]) => (
            <div key={zone}>
              <div className="relative flex items-center gap-2 mb-2 pr-6">
                <Pin size="sm" />
                <span className="text-xs font-medium uppercase tracking-wider text-dusk">{zone}</span>
                <span className="text-xs text-dusk">({items.length})</span>
                <span className="flex-1 border-t border-cardBorder" />
              </div>

              {/* A lone card takes the full row rather than half of one with
                  a hole beside it. Most zones here have exactly one SOP --
                  Accessories, Bathroom, Charging Dock and nine others are all
                  single -- so this was the common case, not the edge. */}
              <ul
                className={
                  items.length === 1
                    ? 'space-y-2.5'
                    : 'space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-4 md:gap-2.5'
                }
              >
                {items.map((s) => {
                  const open = openId === s.id;
                  const isEditing = editingId === s.id;
                  return (
                    <li
                      key={s.id}
                      // Anchor for the ?sop=<id> deep link above.
                      id={`sop-${s.id}`}
                      className="relative bg-mist rounded-xl2 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow p-3.5 pr-8"
                    >
                      <Pin size="sm" />
                      <button
                        onClick={() => setOpenId(open ? null : s.id)}
                        aria-expanded={open}
                        className="w-full text-left flex items-start gap-3"
                      >
                        {/* Poster on the left, at reading scale rather than a
                            thumbnail crop -- contain, so nothing on the poster
                            is cut off. Nothing renders when there is no poster:
                            a grey placeholder box on the 8 SOPs without one
                            would be a hole where the eye expects content. */}
                        {s.posterThumbUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.posterThumbUrl}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="shrink-0 max-h-20 w-20 object-contain rounded-lg bg-card border border-cardBorder"
                          />
                        )}
                        <span className="flex-1 min-w-0">
                          {/* Eyebrow: zone, then the SOP code as a secondary
                              label rather than the brass pill it used to be.
                              The code is an identifier, not a headline. */}
                          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-dusk truncate">
                            {zone}
                            {s.sop_code ? ` · ${s.sop_code}` : ''}
                          </span>
                          <span className="block font-display text-[18px] text-denim leading-snug mt-0.5">
                            {pick(s.task_en, s.task_es)}
                          </span>
                          {s.estimated_minutes && (
                            <span className="inline-block mt-1.5 text-[10px] text-dusk bg-card border border-cardBorder px-2 py-0.5 rounded-full">
                              ~{s.estimated_minutes} min
                            </span>
                          )}
                        </span>
                      </button>

                      {open && (
                        <div className="mt-2.5 pt-2.5 border-t border-cardBorder space-y-2">
                          {isEditing ? (
                            <>
                              <SopPosterUpload
                                sopId={s.id}
                                expectedAppearanceUrl={s.expected_appearance_url}
                                posterDetailUrl={s.posterDetailUrl}
                                photoVerification={s.photo_verification}
                                onUpdated={(patch) => handlePosterUpdated(s.id, patch)}
                              />
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-wider text-dusk mb-1">
                                  {t('methodEn')}
                                </label>
                                <textarea
                                  value={draft.sop_en}
                                  onChange={(e) => setDraft((d) => ({ ...d, sop_en: e.target.value }))}
                                  rows={4}
                                  className={`${FIELD} resize-y`}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-wider text-dusk mb-1">
                                  {t('methodEs')}
                                </label>
                                <textarea
                                  value={draft.sop_es}
                                  onChange={(e) => setDraft((d) => ({ ...d, sop_es: e.target.value }))}
                                  rows={4}
                                  className={`${FIELD} resize-y`}
                                />
                              </div>
                              {(!draft.sop_en.trim() || !draft.sop_es.trim()) && (
                                // A validation block, not a label -- dusk would
                                // read as a hint when it is the reason the
                                // save button is disabled. briar is the token
                                // that exists for this now.
                                <p className="text-[11px] text-briar">{t('bothRequired')}</p>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="flex-1 py-2 rounded-full border border-cardBorder text-denim text-sm"
                                >
                                  {t('cancel')}
                                </button>
                                <button
                                  onClick={() => save(s)}
                                  disabled={saving || !draft.sop_en.trim() || !draft.sop_es.trim()}
                                  className="flex-1 py-2 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
                                >
                                  {saving ? t('saving') : t('save')}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {/* SS-124 / SS-162: the poster. 47 of 55 SOPs
                                  have one hosted in Supabase Storage; the
                                  other 8 get a plain line, never a broken
                                  image. Tap to open full size -- these are
                                  posters, meant to be looked at.

                                  The card draws it through the render
                                  endpoint: as stored these are ~800KB and
                                  the card shows them at 256px tall. Open a
                                  zone with a dozen SOPs on staff mobile data
                                  and the original URLs would pull ~10MB to
                                  fill a column. 'contain' rather than the
                                  default crop -- a poster with its edge cut
                                  off is a poster missing a step. The
                                  lightbox below still loads the original,
                                  which is the one place full size is the
                                  point. */}
                              {s.posterDetailUrl ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox({ url: s.posterFullUrl ?? s.posterDetailUrl!, label: pick(s.task_en, s.task_es) });
                                  }}
                                  className="block w-full rounded-xl2 overflow-hidden border border-cardBorder bg-mist"
                                  aria-label={t('viewPoster')}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={s.posterDetailUrl}
                                    alt={t('posterAlt', { name: pick(s.task_en, s.task_es) })}
                                    loading="lazy"
                                    className="w-full max-h-64 object-contain"
                                  />
                                </button>
                              ) : (
                                <p className="text-xs text-dusk italic">{t('noPoster')}</p>
                              )}

                              <p className="text-sm text-denim whitespace-pre-wrap">
                                {pick(s.sop_en, s.sop_es) || t('noMethod')}
                              </p>
                              {pick(s.pass_fail_en, s.pass_fail_es) && (
                                <p className="text-xs text-dusk">
                                  <span className="font-medium text-dusk uppercase tracking-wider">
                                    {t('passFail')}
                                  </span>{' '}
                                  {pick(s.pass_fail_en, s.pass_fail_es)}
                                </p>
                              )}
                              {/* Read-only here on purpose -- no onRemove.
                                  A supply belongs to a TASK, and this card
                                  is a global procedure that several
                                  properties' tasks can share, so the place
                                  to add or remove one is the Task Center,
                                  where it's unambiguous which task is being
                                  changed. */}
                              <TaskSuppliesList supplies={suppliesBySop.get(s.id) ?? []} />
                              {editable && (
                                <button
                                  onClick={() => startEdit(s)}
                                  className="text-xs font-medium text-brass underline underline-offset-2"
                                >
                                  {t('edit')}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Full-size poster. Backdrop and Escape both close it; the image itself
          does not, so pinch-zooming on a phone cannot dismiss it by accident. */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[90] bg-denim/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === 'Escape' && setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
        >
          <button
            onClick={() => setLightbox(null)}
            aria-label={t('closePoster')}
            className="self-end w-11 h-11 flex items-center justify-center text-white"
          >
            <X size={20} strokeWidth={1.75} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={t('posterAlt', { name: lightbox.label })}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[85vh] object-contain rounded-xl2"
          />
        </div>
      )}
    </div>
  );
}
