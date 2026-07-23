// app/help/page.tsx
// Property-agnostic route -- same content for Main and Country House, so no
// [id] param. Requires login (any role) but isn't scoped to a property the
// way every other authenticated page here is.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HelpClient, { type HelpArticle } from '@/components/help/HelpClient';

export default async function HelpPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('help_articles')
    .select('id, category, question, short_answer, detailed_answer, question_es, short_answer_es, detailed_answer_es, keywords')
    .order('id');

  if (error) {
    console.error('help_articles fetch failed', error);
  }

  return <HelpClient articles={(data ?? []) as HelpArticle[]} />;
}
