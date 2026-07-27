// lib/job-types.ts
// Bilingual labels for master_tasks.job_type / staff_duty_templates.job_type.
//
// Lifted out of DutyRosterEditor so Staff Task Center can use the same names
// rather than a second, drifting copy.
//
// job_type has NO check constraint in the database -- it is free text, so a
// value that isn't listed here is possible and must render as itself rather
// than disappearing. labelFor() falls back to the raw value for exactly that
// reason.
//
// Live shape as of 2026-07-27: Main carries 12 granular cleaning-family types
// (plus one row with job_type null); Lax carries a single 'maintenance' type
// across its 79 tasks. So "Cleaning vs Maintenance" is a coarse view over a
// finer real vocabulary -- see JOB_FAMILY below.
export const JOB_LABELS: Record<string, { en: string; es: string }> = {
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
  maintenance: { en: 'Maintenance', es: 'Mantenimiento' },
};

export function jobLabel(job: string | null | undefined, locale: string): string {
  if (!job) return locale === 'es' ? 'Sin categoría' : 'Uncategorized';
  const l = JOB_LABELS[job];
  if (!l) return job;
  return locale === 'es' ? l.es : l.en;
}

export type JobFamily = 'maintenance' | 'cleaning' | 'other';

// The coarse split the owner asked for. Only 'maintenance' is genuinely its
// own family right now; every other known type is part of the cleaning
// rotation. Anything unrecognised is 'other' rather than being silently
// folded into cleaning -- a new job_type showing up as "Other" is honest, a
// new job_type silently counted as cleaning is not.
export function jobFamily(job: string | null | undefined): JobFamily {
  if (job === 'maintenance') return 'maintenance';
  if (job && JOB_LABELS[job]) return 'cleaning';
  return 'other';
}

export function jobFamilyLabel(family: JobFamily, locale: string): string {
  const map: Record<JobFamily, { en: string; es: string }> = {
    maintenance: { en: 'Maintenance', es: 'Mantenimiento' },
    cleaning: { en: 'Cleaning', es: 'Limpieza' },
    other: { en: 'Other', es: 'Otros' },
  };
  return locale === 'es' ? map[family].es : map[family].en;
}
