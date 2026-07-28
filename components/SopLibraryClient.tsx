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

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import Pin from '@/components/PinAccent';
import { Search, X } from 'lucide-react';

export type Sop = {
  id: string;
  sop_code: string | null;
  zone_type: string | null;
  task_en: string;
  task_es: string;
  sop_en: string | null;
  sop_es: string | null;
  pass_fail_en: string | null;
  pass_fail_es: string | null;
  estimated_minutes: number | null;
  /** Public Storage URL, or null for the 8 SOPs with no poster yet. */
  expected_appearance_url: string | null;
};

const FIELD =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-3 py-2 text-sm text-denim';

export default function SopLibraryClient({ initialSops }: { initialSops: Sop[] }) {
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
      [s.task_en, s.task_es, s.sop_en, s.sop_es, s.sop_code, s.zone_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [sops, search]);

  const byZone = useMemo(() => {
    const map = new Map<string, Sop[]>();
    for (const s of filtered) {
      const key = s.zone_type ?? t('unzoned');
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, t]);

  function startEdit(s: Sop) {
    setEditingId(s.id);
    setDraft({ sop_en: s.sop_en ?? '', sop_es: s.sop_es ?? '' });
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
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
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
                <span className="text-xs font-medium uppercase tracking-wider text-brass">{zone}</span>
                <span className="text-xs text-dusk">({items.length})</span>
                <span className="flex-1 border-t border-cardBorder" />
              </div>

              <ul className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2.5">
                {items.map((s) => {
                  const open = openId === s.id;
                  const isEditing = editingId === s.id;
                  return (
                    <li
                      key={s.id}
                      className="relative bg-card rounded-xl2 border border-cardBorder shadow-card hover:shadow-cardHover transition-shadow p-3.5"
                    >
                      <Pin size="sm" />
                      <button
                        onClick={() => setOpenId(open ? null : s.id)}
                        aria-expanded={open}
                        className="w-full text-left flex items-start gap-2"
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block font-medium text-denim">{pick(s.task_en, s.task_es)}</span>
                          <span className="flex flex-wrap items-center gap-1.5 mt-1">
                            {s.sop_code && (
                              <span className="text-[10px] font-medium text-brass bg-brass/10 px-2 py-0.5 rounded-full">
                                {s.sop_code}
                              </span>
                            )}
                            {s.estimated_minutes && (
                              <span className="text-[10px] text-dusk bg-mist px-2 py-0.5 rounded-full">
                                ~{s.estimated_minutes} min
                              </span>
                            )}
                          </span>
                        </span>
                      </button>

                      {open && (
                        <div className="mt-2.5 pt-2.5 border-t border-cardBorder space-y-2">
                          {isEditing ? (
                            <>
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-wider text-brass mb-1">
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
                                <label className="block text-xs font-medium uppercase tracking-wider text-brass mb-1">
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
                                <p className="text-[11px] text-brass">{t('bothRequired')}</p>
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
                                  posters, meant to be looked at. */}
                              {s.expected_appearance_url ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightbox({ url: s.expected_appearance_url!, label: pick(s.task_en, s.task_es) });
                                  }}
                                  className="block w-full rounded-xl2 overflow-hidden border border-cardBorder bg-mist"
                                  aria-label={t('viewPoster')}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={s.expected_appearance_url}
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
                                  <span className="font-medium text-brass uppercase tracking-wider">
                                    {t('passFail')}
                                  </span>{' '}
                                  {pick(s.pass_fail_en, s.pass_fail_es)}
                                </p>
                              )}
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
