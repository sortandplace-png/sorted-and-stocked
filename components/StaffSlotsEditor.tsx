// components/StaffSlotsEditor.tsx
// Manager-only staff_slots surface.
//
// Slots are renameable LABELS, not people. They start generic
// ("Housekeeper 1" / "Ama de llaves 1"), a manager renames one when someone
// real starts, and each residence keeps its own set -- Main's staff are not
// Lax's staff. Renaming touches label_en/label_es only: it never modifies
// slot_id on any duty, completion, or assignment, so history survives a
// rename intact.
//
// SS-436 reopen defect 2 (2 Aug, Racquel's on-device pass): the full-width
// EN+ES input-pair pills were dysfunctional. Slots are now COMPACT
// FIXED-SIZE TILES (the handbook tile rule applies app-wide): one tile per
// slot, EN label primary, ES beneath small, the assigned person (from
// their own account -- never a seeded name) or "Open", and an on-card line
// saying what a slot connects to (duties + assignments + history). The
// rename inputs appear only when a tile's Rename is tapped.
//
// There is deliberately no default person's name anywhere in this file, and
// none may be added. If a slot is linked to a real account, the name shown
// comes from that account (assignedNames, resolved server-side from
// profiles full_name/email).
//
// SS-243, the connector: slots existed, duties could attach to them
// (staff_duty_templates.slot_id, DutyRosterEditor.tsx), and task_assignments
// could target them (SS-672/SS-684), but nothing ever WROTE staff_slots.
// user_id -- 20 slots, zero linked. `members` below is that property's
// property_members, and the picker writes/clears user_id directly. Clearing
// is a valid state (the slot goes back to open) and only ever touches this
// one column -- duties/assignments/history key off slot_id, never user_id,
// so nothing else moves when a person is swapped out or removed.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { Plus } from 'lucide-react';
import Pin from '@/components/PinAccent';
import { useCardCollapse } from '@/lib/useCardCollapse';

export type StaffSlotRow = {
  id: string;
  slot_number: number;
  label_en: string;
  label_es: string;
  active: boolean;
  user_id: string | null;
};

export type SlotMember = { user_id: string; name: string; role: string };
export type SlotContact = { phone: string | null; email: string | null };

const FIELD =
  'w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-3 py-2 text-sm text-denim';

export default function StaffSlotsEditor({
  propertyId,
  initialSlots,
  assignedNames = {},
  members = [],
  propertyName,
  weekMinutesByUser = {},
  contactByUserId = {},
  myDayHref,
}: {
  propertyId: string;
  initialSlots: StaffSlotRow[];
  /** user_id -> display name (full_name, else email) for linked slots. */
  assignedNames?: Record<string, string>;
  /** This property's property_members -- the picker's candidate list. */
  members?: SlotMember[];
  /** SS-824: shown on every tile so a multi-house view says whose house
      each slot belongs to, even inside a single house's own view. */
  propertyName?: string;
  /** user_id -> minutes worked this week (shifts, Monday start, closed
      shifts only -- same rule ClockInOutButton/ShiftHoursClient use). */
  weekMinutesByUser?: Record<string, number>;
  /** user_id -> phone/email for the Manager at a Glance block. */
  contactByUserId?: Record<string, SlotContact>;
  /** SS-824: where Clock In/Clock Out actually live -- this page has never
      linked to them. Omitted (no link rendered) where not supplied. */
  myDayHref?: string;
}) {
  const t = useTranslations('staffSlots');
  const supabase = createClient();
  const showToast = useToast();
  // SS-823: reusing SS-048's collapse (localStorage per cardId), not a
  // second implementation -- this card's Pin was decorative.
  const { collapsed, toggle } = useCardCollapse('staff-slots-editor');
  const [slots, setSlots] = useState<StaffSlotRow[]>(initialSlots);
  const [drafts, setDrafts] = useState<Record<string, { label_en: string; label_es: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
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
    setEditingId(null);
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

  // SS-243. userId === null clears the slot back to open -- staff_slots is
  // the only row touched. Duties (staff_duty_templates.slot_id) and
  // assignments (task_assignments.slot_id) key off the slot's own id, not
  // its user_id, so they survive a link, a swap, or a clear untouched.
  async function linkUser(s: StaffSlotRow, userId: string | null) {
    setLinkingId(s.id);
    const { error } = await supabase.from('staff_slots').update({ user_id: userId }).eq('id', s.id);
    setLinkingId(null);
    if (error) {
      showToast(t('linkFailed'), { variant: 'error' });
      return;
    }
    setSlots((prev) => prev.map((x) => (x.id === s.id ? { ...x, user_id: userId } : x)));
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
      <Pin size="sm" collapsed={collapsed} onToggle={toggle} />
      <h2 className="font-display text-lg text-denim mb-1">{t('title')}</h2>
      <p className="text-xs text-dusk mb-1">{t('description')}</p>
      {/* Reopen defect 2: say on-card what a slot connects to. One line for
          the whole grid rather than repeated per tile. */}
      <p className="text-[11px] text-dusk mb-4">{t('connectsNote')}</p>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
      {/* Compact fixed-size tiles -- the grid holds tile size even with one
          slot (handbook tile rule, app-wide). */}
      <ul className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {slots.map((s) => {
          const d = draftFor(s);
          const editing = editingId === s.id;
          const incomplete = !d.label_en.trim() || !d.label_es.trim();
          const person = s.user_id ? assignedNames[s.user_id] || t('linked') : null;
          return (
            <li
              key={s.id}
              className={`relative flex flex-col gap-1.5 bg-mist rounded-xl2 border border-brass/30 shadow-card py-3 px-3.5 ${s.active ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2 pr-5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brass">
                  {t('slotNumber', { number: s.slot_number })}
                </span>
                {/* SS-824: every slot says its house, even inside a single
                    house's own view -- "i dont see which residence belongs
                    to who." */}
                {propertyName && (
                  <span className="text-[9px] font-medium text-dusk truncate max-w-[6.5rem]">{propertyName}</span>
                )}
              </div>

              {editing ? (
                <>
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
                  {incomplete && <p className="text-[11px] text-brass">{t('bothRequired')}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      onClick={() => save(s)}
                      disabled={savingId === s.id || incomplete}
                      className="text-xs font-medium bg-denim text-white px-3.5 py-1.5 rounded-full disabled:opacity-40"
                    >
                      {savingId === s.id ? t('saving') : t('save')}
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setDrafts((prev) => {
                          const next = { ...prev };
                          delete next[s.id];
                          return next;
                        });
                      }}
                      className="text-xs text-dusk underline underline-offset-2"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-denim leading-snug">{s.label_en}</p>
                  <p className="text-[11px] text-dusk leading-snug">{s.label_es}</p>
                  {/* SS-243: the picker that actually writes user_id. Falls
                      back to a plain read-out when this property's member
                      list wasn't supplied (there is always at least the
                      null/open option otherwise). */}
                  {members.length > 0 || s.user_id ? (
                    <select
                      value={s.user_id ?? ''}
                      onChange={(e) => linkUser(s, e.target.value || null)}
                      disabled={linkingId === s.id}
                      aria-label={t('assignLabel')}
                      className={`text-xs mt-0.5 rounded-full px-2 py-1 border disabled:opacity-50 ${
                        s.user_id ? 'text-denim border-cardBorder bg-card' : 'text-brass border-brass/30 bg-card'
                      }`}
                    >
                      <option value="">{t('open')}</option>
                      {/* The linked user might not be in this property's
                          current member list (removed since, say) -- keep
                          them selectable so the dropdown never silently
                          shows the wrong name. */}
                      {s.user_id && !members.some((m) => m.user_id === s.user_id) && (
                        <option value={s.user_id}>{person}</option>
                      )}
                      {members.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs mt-0.5 text-brass">{t('open')}</p>
                  )}

                  {/* SS-824: Manager at a Glance. Only once a real person is
                      linked -- an honest empty state (no hours logged / no
                      phone on file), never a bare "0" that could be read as
                      real data. */}
                  {s.user_id && (
                    <div className="mt-1 pt-1 border-t border-brass/20 space-y-0.5">
                      <p className="text-[10px] text-dusk">
                        {weekMinutesByUser[s.user_id] > 0
                          ? t('hoursThisWeek', {
                              hours: `${Math.floor(weekMinutesByUser[s.user_id] / 60)}h ${weekMinutesByUser[s.user_id] % 60}m`,
                            })
                          : t('noHoursThisWeek')}
                      </p>
                      <p className="text-[10px] text-dusk truncate">
                        {contactByUserId[s.user_id]?.phone || t('noPhone')}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 mt-1">
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="text-[11px] text-denim underline underline-offset-2"
                    >
                      {t('rename')}
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className="text-[11px] text-dusk hover:text-denim underline underline-offset-2"
                    >
                      {s.active ? t('deactivate') : t('activate')}
                    </button>
                  </div>
                </>
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

      <p className="text-[11px] text-dusk mt-3">{t('renameNote')}</p>

      {/* SS-824: "where do clock in and clock out lead" -- they live on My
          Day, and nothing on this page pointed at them until now. */}
      {myDayHref && (
        <p className="text-[11px] text-dusk mt-2">
          {t('clockNote')}{' '}
          <Link href={myDayHref} className="text-denim underline underline-offset-2">
            {t('viewMyDay')} →
          </Link>
        </p>
      )}
        </div>
      </div>
    </div>
  );
}
