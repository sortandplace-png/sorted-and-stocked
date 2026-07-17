// app/properties/[id]/my-day/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocale } from 'next-intl/server';
import MyDayClient from '@/components/MyDayClient';
import { getTodayTriggerType } from '@/lib/calendar-trigger-type';

// general/omer are deliberately excluded, not just "usually have no note" --
// per spec, this banner never shows on those two days even if a future
// content edit accidentally adds a staff_note to a general/omer row.
async function getStaffNote(propertyId: string, triggerType: string): Promise<{ en: string; es: string | null } | null> {
  if (triggerType === 'general' || triggerType === 'omer') return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('calendar_content')
    .select('staff_note_en, staff_note_es')
    .eq('property_id', propertyId)
    .eq('trigger_type', triggerType)
    .eq('active', true)
    .not('staff_note_en', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!data?.staff_note_en) return null
  return { en: data.staff_note_en, es: data.staff_note_es }
}

export default async function MyDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Same shared trigger-type resolution the Dashboard's Today card uses
  // (lib/calendar-trigger-type.ts) -- one priority chain, so this page can
  // never disagree with the Dashboard about what today "is."
  const [locale, triggerType] = await Promise.all([getLocale(), getTodayTriggerType()]);
  const note = await getStaffNote(id, triggerType);
  const staffNote = note ? (locale === 'es' && note.es ? note.es : note.en) : null;

  // Parent layout already confirmed membership on this property — no
  // additional role gate here. This is staff's landing page, but nothing
  // about it is staff-exclusive (an owner/manager visiting directly just
  // sees their own assigned tasks, which may be none).
  return <MyDayClient propertyId={id} staffNote={staffNote} />;
}
