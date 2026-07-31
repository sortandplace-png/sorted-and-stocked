// components/StaffSlotsEditor.tsx
// Manager-only rename UI for staff_slots, shown in property settings.
//
// Slots are renameable LABELS, not people. They start generic
// ("Housekeeper 1" / "Ama de llaves 1"), a manager renames one when someone
// real starts, and each residence keeps its own set -- Main's staff are not
// Lax's staff. Renaming touches label_en/label_es only: it never modifies
// slot_id on any duty, completion, or assignment, so history survives a
// rename intact.
//
// There is deliberately no default person's name anywhere in this file, and
// none may be added. If a slot is linked to a real account, staff-facing
// surfaces should show that account's own display name -- never a name typed
// into a seed, a document, or a prompt.
'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { Plus } from 'lucide-react';
import Pin from '@/components/PinAccent';

export type StaffSlotRow = {
  id: string;
  slot_number: number;
  label_en: string;
  label_es: string;
  active: boolean;
  user_id: string | null;
};

const FIELD =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-3 py-2 text-sm text-denim';

export default function StaffSlotsEditor({
  propertyId,
  initialSlots,
}: {
  propertyId: string;
  initialSlots: StaffSlotRow[];
}) {
  const t = useTranslations('staffSlots');
  const locale = useLocale();
  const supabase = createClient();
  const showToast = useToast();
  const [slots, setSlots] = useState<StaffSlotRow[]>(initialSlots);
  const [drafts, setDrafts] = useState<Record<string, { label_en: string; label_es: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function draftFor(s: StaffSlotRow) {
    return drafts[s.id] ?? { label_en: s.label_en, label_es: s.label_es };
  }

  function setDraft(id: string, patch: Partial<{ label_en: string; label_es: string }>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { label_en: '', label_es: '' }), ...patch } }));
  }

  async function save(s: StaffSlotRow) {
    const d = draftFor(s);
    // Both languages required, same rule as everywhere else in this app --
    // a slot labelled only in English is unusable to the staff reading it.
    if (!d.label_en.trim() || !d.label_es.trim()) return;
    setSavingId(s.id);
    const { error } = await supabase
      .from('staff_slots')
      .update({ label_en: d.label_en.trim(), label_es: d.label_es.trim() })
      .eq('id', s.id);
    setSavingId(null);
    if (error) {
      showToast(t('saveFailed'), { variant: 'error' });
      return;
    }
    setSlots((prev) =>
      prev.map((x) => (x.id === s.id ? { ...x, label_en: d.label_en.trim(), label_es: d.label_es.trim() } : x))
    );
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[s.id];
      return next;
    });
    showToast(t('saved'), { variant: 'success' });
  }

  async function toggleActive(s: StaffSlotRow) {
    const { error } = await supabase.from('staff_slots').update({ active: !s.active }).eq('id', s.id);
    if (error) {
      showToast(t('saveFailed'), { variant: 'error' });
      return;
    }
    setSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));
  }

  async function addSlot() {
    setAdding(true);
    const nextNumber = slots.reduce((m, s) => Math.max(m, s.slot_number), 0) + 1;
    const { data, error } = await supabase
      .from('staff_slots')
      .insert({
        property_id: propertyId,
        slot_number: nextNumber,
        // Generic by design. Never seed a person's name here.
        label_en: `Housekeeper ${nextNumber}`,
        label_es: `Ama de llaves ${nextNumber}`,
        sort_order: nextNumber * 10,
      })
      .select('id, slot_number, label_en, label_es, active, user_id')
      .single();
    setAdding(false);
    if (error || !data) {
      showToast(t('addFailed'), { variant: 'error' });
      return;
    }
    setSlots((prev) => [...prev, data as StaffSlotRow]);
  }

  return (
    <div className="relative bg-card rounded-xl3 border border-cardBorder shadow-card p-5">
      <Pin size="sm" />
      <h2 className="font-display text-lg text-denim mb-1">{t('title')}</h2>
      <p className="text-xs text-dusk mb-4">{t('description')}</p>

      {/* SS-429: Concept B action tiles -- mist fill, 20px radius (xl2, an
          action tile, not the 28px section-card radius), brass hairline,
          pin dot each, two-up on md. The empty state IS the normal state:
          all 16 slots app-wide are unlinked, so "no one assigned yet" is
          designed as the default line, not an edge case. */}
      <ul className="grid gap-[14px] md:grid-cols-2">
        {slots.map((s) => {
          const d = draftFor(s);
          const dirty = d.label_en !== s.label_en || d.label_es !== s.label_es;
          const incomplete = !d.label_en.trim() || !d.label_es.trim();
          return (
            <li
              key={s.id}
              className={`relative flex flex-col gap-[11px] bg-mist rounded-xl2 border border-brass/30 shadow-card py-[14px] px-[18px] ${s.active ? '' : 'opacity-60'}`}
            >
              <Pin size="sm" />
              <div className="flex items-center gap-2 pr-6">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass">
                  {t('slotNumber', { number: s.slot_number })}
                </span>
                <button
                  onClick={() => toggleActive(s)}
                  className="ml-auto text-[11px] text-dusk hover:text-denim underline underline-offset-2"
                >
                  {s.active ? t('deactivate') : t('activate')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={d.label_en}
                  onChange={(e) => setDraft(s.id, { label_en: e.target.value })}
                  placeholder={t('labelEn')}
                  aria-label={t('labelEn')}
                  className={FIELD}
                />
                <input
                  value={d.label_es}
                  onChange={(e) => setDraft(s.id, { label_es: e.target.value })}
                  placeholder={t('labelEs')}
                  aria-label={t('labelEs')}
                  className={FIELD}
                />
              </div>
              {/* Dusk is correct here -- a status line is genuinely
                  non-critical text, unlike the tappable toggle SS-429 moved
                  off dusk elsewhere. Never a typed name when linked (R17):
                  linked slots show the generic linked marker; display names
                  come from the account itself on staff-facing surfaces. */}
              <p className="text-[11px] text-dusk">{s.user_id ? t('linked') : t('noOneAssigned')}</p>
              {incomplete && <p className="text-[11px] text-brass">{t('bothRequired')}</p>}
              {dirty && (
                <button
                  onClick={() => save(s)}
                  disabled={savingId === s.id || incomplete}
                  className="self-start text-sm font-medium bg-denim text-white px-4 py-1.5 rounded-full disabled:opacity-40"
                >
                  {savingId === s.id ? t('saving') : t('save')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={addSlot}
        disabled={adding}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-denim border border-brass/30 px-4 py-2 rounded-full disabled:opacity-50"
      >
        <Plus size={15} aria-hidden="true" /> {t('addSlot')}
      </button>

      <p className="text-[11px] text-dusk mt-3">{locale === 'es' ? t('renameNote') : t('renameNote')}</p>
    </div>
  );
}
