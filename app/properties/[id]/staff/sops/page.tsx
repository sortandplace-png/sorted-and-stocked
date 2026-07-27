// app/properties/[id]/staff/sops/page.tsx
// sop_library is a GLOBAL table (no property_id), so this fetches the whole
// library regardless of which property the URL names -- the same shape as
// help_articles and blog_posts. Staff-readable by design: sop_read is
// `auth.uid() is not null`, and the SOPs are the reference staff need while
// actually doing the work.
import { createClient } from '@/lib/supabase/server';
import SopLibraryClient, { type Sop } from '@/components/SopLibraryClient';

export default async function SopLibraryPage() {
  const supabase = await createClient();

  const { data: sops } = await supabase
    .from('sop_library')
    .select('id, sop_code, zone_type, task_en, task_es, sop_en, sop_es, pass_fail_en, pass_fail_es, estimated_minutes')
    .eq('active', true)
    .order('zone_type')
    .order('task_en');

  return <SopLibraryClient initialSops={(sops as Sop[]) ?? []} />;
}
