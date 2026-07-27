// app/properties/[id]/staff/handbook/page.tsx
// The staff handbook as its own page.
//
// The ten articles were always in help_articles and always bilingual -- they
// simply had no door. Deliberately NOT a filtered view of the Help Center:
// that category also holds 28 admin-facing articles ("Who should have admin
// access?"), and Help itself is a page staff should not be dropped into.
//
// FAQ-101..110 were written in shift order, so id order IS reading order:
// arrive, find things, report problems, house standards, finish the shift.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffHandbookClient, { type HandbookArticle } from '@/components/StaffHandbookClient';

export default async function StaffHandbookPage({
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

  // Every role reads the handbook -- it is the thing staff are told to check
  // before asking. No manager gate here.
  const { data, error } = await supabase
    .from('help_articles')
    .select('id, question, short_answer, detailed_answer, question_es, short_answer_es, detailed_answer_es')
    .gte('id', 'FAQ-101')
    .lte('id', 'FAQ-110')
    .order('id');

  if (error) {
    console.error('staff handbook fetch failed', error);
  }

  return <StaffHandbookClient articles={(data ?? []) as HandbookArticle[]} propertyId={id} />;
}
