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

type Row = {
  id: string;
  area_en: string;
  area_es: string;
  task_en: string;
  task_es: string;
  staff_roster_key: string;
  job_type: string | null;
  sort_order: number;
};

// 'unassigned' is a real, live value -- every one of the 61 rows in the
// database has it (the default a new row is created with, before anyone
// picks a real person). It was missing from this list even though it was
// never missing from the data: a <select> whose bound value doesn't match
// any of its <option>s falls back to showing the first option in the
// browser, which silently displayed "Amber" for every single
// still-unassigned row -- reading as if triage was already done when none
// of it had happened. Added as its own real, selectable option instead.
export const ROSTER_OPTIONS = ['unassigned', 'amber', 'leti', 'marlyn', 'live_in'] as const;
export const ROSTER_LABELS: Record<string, string> = {
  unassigned: 'Unassigned',
  amber: 'Amber',
  leti: 'Leti',
  marlyn: 'Marlyn',
  live_in: 'Live-In (Nino/Noni)',
};

// EN values are the literal labels given in the spec; ES are my own
// translations (explicitly asked for, not present in the source data).
const JOB_LABELS: Record<string, { en: string; es: string }> = {
  general_tidying: { en: 'General Tidying', es: 'Limpieza General' },
  shades_windows: { en: 'Shades & Windows', es: 'Persianas y Ventanas' },
  floors: { en: 'Floors', es: 'Pisos' },
  dusting_surfaces: { en: 'Dusting & Surfaces', es: 'Sacudir y Superficies' },
  trash_disinfecting: { en: 'Trash & Disinfecting', es: 'Basura y Desinfección' },
  glass_mirrors: { en: 'Glass & Mirrors', es: 'Vidrios y Espejos' },
  bathroom_cleaning: { en: 'Bathroom Cleaning', es: 'Limpieza de Baños' },
  laundry: { en: 'Laundry', es: 'Lavandería' },
  outdoor_perimeter: { en: 'Outdoor & Perimeter', es: 'Exterior y Perímetro' },
  bed_making: { en: 'Bed-Making', es: 'Tender Camas' },
  kitchen_dishes: { en: 'Kitchen Dishes', es: 'Platos de Cocina' },
  childcare: { en: 'Childcare', es: 'Cuidado de Niños' },
};

const cellInputClass =
  'w-full text-sm px-2 py-1.5 rounded border border-transparent hover:border-brass/30 focus:border-brass focus:outline-none bg-transparent text-denim';

export default function DutyRosterEditor({ propertyId, initialRows }: { propertyId: string; initialRows: Row[] }) {
  const locale = useLocale();
  const [rows, setRows] = useState<Row[]>(initialRows);
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
    if (!job) return '—';
    const l = JOB_LABELS[job];
    if (!l) return job;
    return locale === 'es' ? l.es : l.en;
  }

  async function patchRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSavingIds((prev) => ({ ...prev, [id]: true }));
    const { error } = await supabase.from('staff_duty_templates').update(patch).eq('id', id);
    setSavingIds((prev) => ({ ...prev, [id]: false }));
    if (error) showToast('Failed to save — try again.', { variant: 'error' });
  }

  // Inserts a real row immediately (empty text fields, defaulted to
  // Live-In since that roster currently has zero rows and this is the
  // way a first one gets created) rather than opening a separate "new
  // row" form -- it appears in the table using the exact same inline
  // inputs as every other row.
  async function addRow() {
    setAdding(true);
    const { data, error } = await supabase
      .from('staff_duty_templates')
      .insert({
        property_id: propertyId,
        staff_roster_key: 'live_in',
        area_en: '',
        area_es: '',
        task_en: '',
        task_es: '',
        job_type: null,
        sort_order: 0,
      })
      .select('id, area_en, area_es, task_en, task_es, staff_roster_key, job_type, sort_order')
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
      <p className="text-sm text-dusk mb-4">Every duty template, one flat list. Owner/manager only.</p>

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
                      value={row.staff_roster_key}
                      onChange={(e) => patchRow(row.id, { staff_roster_key: e.target.value })}
                      disabled={savingIds[row.id]}
                      className="text-sm border border-brass/30 rounded-full px-2.5 py-1.5 bg-mist text-denim disabled:opacity-50"
                    >
                      {ROSTER_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {ROSTER_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-dusk text-sm">
                    No rows match these filters.
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
