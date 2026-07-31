// app/properties/[id]/help/page.tsx
// Property-scoped door to the Help Center.
//
// The content is identical to /help -- this route exists because /help sits
// OUTSIDE app/properties/[id]/, which is where the app header and DesktopNav
// are rendered. That is the whole reason Help was a dead end: not a missing
// back link, a missing layout. Rendering it here inherits the standard chrome
// the same way every other page does.
//
// /help is deliberately left in place; anyone with it bookmarked keeps working.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HelpClient, { type HelpArticle } from '@/components/help/HelpClient';

export default async function PropertyHelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string; article?: string }>;
}) {
  await params;
  const { category } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('help_articles')
    .select(
      'id, category, question, short_answer, detailed_answer, question_es, short_answer_es, detailed_answer_es, keywords'
    )
    // 152: superseded duplicates stay in the table (R21) but out of the list.
    .eq('active', true)
    .order('id');

  if (error) {
    console.error('help_articles fetch failed', error);
  }

  return <HelpClient articles={(data ?? []) as HelpArticle[]} initialCategory={category} />;
}
