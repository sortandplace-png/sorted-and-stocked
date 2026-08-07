// components/DutyRosterEditor.tsx
// Admin editor for staff_duty_templates -- flat table, every row visible by
// default (not per-person tabs), with two independent filters (Room, Job)
// whose option lists come from the actual distinct values present in the
// data, not a hardcoded list. Every text field writes straight to its own
// column on blur/change; no batching, no draft state to lose.
'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { Plus } from 'lucide-react';
import { jobLabel as sharedJobLabel } from '@/lib/job-types';
import ReadTimestamp from '@/components/ui/ReadTimestamp';

export type StaffSlot = {
  id: string;
  slot_number: number;
  label_en: string;
  label_es: string;
  active: boolean;
};

type Row = {
  id: string;
  area_en: string;
  area_es: string;
  task_en: string;
  task_es: string;
  slot_id: string | null;
  job_type: string | null;
  sort_order: number;
};

// Assignment is a real FK to staff_slots, per property. There is deliberately
// no hardcoded list of people here and there must never be one again: slots
// are renameable labels that exist independently of who currently holds them,
// so a person leaving is a rename, not a code change. Unassigned is the null
// state, not a magic string.
export function slotLabel(slot: StaffSlot | undefined, locale: string): string {
  if (!slot) return '—';
  return locale === 'es' ? slot.label_es : slot.label_en;
}

const cellInputClass =
  'w-full text-sm px-2 py-1.5 rounded border border-transparent hover:border-brass/30 focus:border-brass focus:outline-none bg-transparent text-denim';

export default function DutyRosterEditor({
  propertyId,
  initialRows,
  slots,
  readAt,
}: {
  propertyId: string;
  initialRows: Row[];
  slots: StaffSlot[];
  /** SS-857: server-stamped the same request as initialRows/slots above. */
  readAt: string;
}) {
  const locale = useLocale();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const slotById = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const [roomFilter, setRoomFilter] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const supabase = createClient();
  const showToast = useToast();

  // Option lists always derive from the full row set, not the currently
  // filtered subset -- picking a Job shouldn't shrink the Room dropdown's
  // own options out from under it.
  const rooms = useMemo(() => Array.from(new Set(rows.map((r) => r.area_en))).sort(), [rows]);
  const jobs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.job_type).filter((j): j is string => !!j))).sort(),
    [rows]
  );

  const filtered = rows.filter((r) => (!roomFilter || r.area_en === roomFilter) && (!jobFilter || r.job_type === jobFilter));

  function jobLabel(job: string | null) {
    return sharedJobLabel(job, locale);
  }

  async function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSavingIds((prev) => ({ ...prev, [id]: true }));
    const { error } = await supabase.from('staff_duty_templates').update(patch).eq('id', id);
    setSavingIds((prev) => ({ ...prev, [id]: false }));
    if (error) showToast('Failed to save — try again.', { variant: 'error' });
  }

  // Inserts a real row immediately rather than opening a separate "new row"
  // form -- it appears in the table using the same inline inputs as every
  // other row. Starts unassigned (slot_id null); assignment is an explicit
  // choice, never a default.
  async function addRow() {
    setAdding(true);
    const { data, error } = await supabase
      .from('staff_duty_templates')
      .insert({
        property_id: propertyId,
        slot_id: null,
        area_en: '',
        area_es: '',
        task_en: '',
        task_es: '',
        job_type: null,
        sort_order: 0,
      })
      .select('id, area_en, area_es, task_en, task_es, slot_id, job_type, sort_order')
      .single();
    setAdding(false);
    if (error || !data) {
      showToast('Failed to add row.', { variant: 'error' });
      return;
    }
    setRows((prev) => [...prev, data as Row]);
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Staff Duty Roster</h1>
      <p className="text-sm text-dusk mb-1">Every duty template, one flat list. Owner/manager only.</p>
      <ReadTimestamp readAt={readAt} className="text-[11px] text-dusk mb-4" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          className="text-sm border border-brass/30 rounded-full px-3 py-2 bg-mist text-denim"
        >
          <option value="">All Rooms</option>
          {rooms.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="text-sm border border-brass/30 rounded-full px-3 py-2 bg-mist text-denim"
        >
          <option value="">All Jobs</option>
          {jobs.map((j) => (
            <option key={j} value={j}>
              {jobLabel(j)}
            </option>
          ))}
        </select>
        <button
          onClick={addRow}
          disabled={adding}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-white bg-denim px-4 py-2 rounded-full disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" /> Add Row
        </button>
      </div>

      <div className="rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-denim text-white text-[10px] font-semibold tracking-[0.1em] uppercase">
                <th className="text-left py-2.5 px-3">Room (EN)</th>
                <th className="text-left py-2.5 px-3">Room (ES)</th>
                <th className="text-left py-2.5 px-3">Job</th>
                <th className="text-left py-2.5 px-3">Task (EN)</th>
                <th className="text-left py-2.5 px-3">Task (ES)</th>
                <th className="text-left py-2.5 px-3">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-cardBorder">
                  <td className="p-1.5 min-w-[160px]">
                    <input
                      defaultValue={row.area_en}
                      onBlur={(e) => e.target.value !== row.area_en && patchRow(row.id, { area_en: e.target.value })}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5 min-w-[160px]">
                    <input
                      defaultValue={row.area_es}
                      onBlur={(e) => e.target.value !== row.area_es && patchRow(row.id, { area_es: e.target.value })}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5 text-dusk text-xs whitespace-nowrap">{jobLabel(row.job_type)}</td>
                  <td className="p-1.5 min-w-[220px]">
                    <input
                      defaultValue={row.task_en}
                      onBlur={(e) => e.target.value !== row.task_en && patchRow(row.id, { task_en: e.target.value })}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5 min-w-[220px]">
                    <input
                      defaultValue={row.task_es}
                      onBlur={(e) => e.target.value !== row.task_es && patchRow(row.id, { task_es: e.target.value })}
                      className={cellInputClass}
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      value={row.slot_id ?? ''}
                      onChange={(e) => patchRow(row.id, { slot_id: e.target.value || null })}
                      disabled={savingIds[row.id]}
                      className="text-sm border border-brass/30 rounded-full px-2.5 py-1.5 bg-mist text-denim disabled:opacity-50"
                    >
                      <option value="">{locale === 'es' ? 'Sin asignar' : 'Unassigned'}</option>
                      {slots
                        .filter((s) => s.active || s.id === row.slot_id)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {slotLabel(s, locale)}
                            {!s.active ? (locale === 'es' ? ' (inactivo)' : ' (inactive)') : ''}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  {/* Empty-because-filtered and empty-because-none-exist are
                      different states and must not share a message. Country
                      and Lax both have 0 duty templates, so "No rows match
                      these filters" blamed a filter that wasn't doing
                      anything and hid the real next step (Add Row). */}
                  <td colSpan={6} className="text-center py-8 text-dusk text-sm">
                    {rows.length === 0 ? (
                      <>
                        No duty templates for this property yet.
                        <br />
                        <span className="text-xs">Use “Add Row” above to create the first one.</span>
                      </>
                    ) : (
                      'No rows match these filters.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
