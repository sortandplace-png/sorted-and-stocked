// GET /api/recipes/[id]/history
//
// Reads recipe_versions for a single recipe, newest first. Rows are written
// by the trg_log_recipe_change trigger (AFTER UPDATE on recipes) — this route
// is purely a read path, nothing here writes to the table.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // RLS on recipe_versions scopes by property_id — this will simply return
  // an empty list if the caller isn't a member of the recipe's property,
  // rather than erroring, so no separate membership check is needed here.
  const { data, error } = await supabase
    .from('recipe_versions')
    .select('id, field_name, old_value, new_value, editor_name, created_at')
    .eq('recipe_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ history: data ?? [] });
}
