// app/api/tools/backup/route.ts
// SS-092/SS-001: "no recovery path" -- a one-click export of everything
// this property owns, before anyone needs it to actually recover from
// something.
//
// Owner-only, deliberately stricter than the usual owner/manager gate
// (canManage()) every other tools/* route in this app uses. A full data
// export is a different class of action than assigning a task or editing
// a room -- confirmed against the brief, not loosened to match the more
// common gate out of habit.
//
// Scope: every table confirmed live (via information_schema, not assumed)
// to carry a property_id column, PLUS the real child tables that matter
// for a genuine no-recovery-path safety net but link in through a parent
// id rather than property_id directly -- recipe_ingredients (via recipes),
// shopping_list_items (via shopping_lists), task_assignments and
// master_task_sops (via master_tasks). Global reference data (frequencies,
// sop_library, item_name_synonyms) is NOT included -- it is shared across
// every property and restorable from the schema itself, not something
// this property could lose.
//
// One JSON file per table inside a zip, not a single SQL dump -- valid
// JSON is something a person can actually open and read without a
// database to restore into first, which matters for a backup nobody
// expects to need until the day something has already gone wrong.
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { formatPropertyLabel } from '@/lib/property-display';

// SS-326. This used to be a hardcoded list of 44 tables. Live count the
// night this was fixed was 45 (two tables -- proposals, sms_replies --
// had been added since the original SS-092 build and were silently
// missing from every backup taken since). A backup that goes stale the
// moment someone adds a table defeats the entire point of SS-092: the
// list is now read from information_schema at request time, so a new
// property-scoped table is included the moment it exists, with no second
// place to remember to update.
//
// Requires the service role key: information_schema.columns is not
// exposed to the anon/authenticated PostgREST roles, and this is a
// metadata query about the SCHEMA, not a row a property member should be
// reading through their own session anyway.
async function getPropertyScopedTables(): Promise<string[]> {
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await admin.rpc('list_property_scoped_tables');
  if (error || !data) {
    throw new Error(`Could not enumerate property-scoped tables: ${error?.message ?? 'no data'}`);
  }
  return (data as { table_name: string }[]).map((r) => r.table_name);
}

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get('propertyId');
  if (!propertyId) return NextResponse.json({ error: 'Missing propertyId.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Owner-only. Stricter than canManage() -- a full export is not the same
  // class of action as everything else that gate covers.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'owner') {
    return NextResponse.json({ error: 'Owner-only.' }, { status: 403 });
  }

  const { data: property } = await supabase
    .from('properties')
    .select('name, household_id, households(name)')
    .eq('id', propertyId)
    .maybeSingle();
  const propertyHouseholdInfo = (property?.households as unknown as { name: string } | null) ?? null;
  let propertyLabel: string | null = property?.name ?? null;
  if (property?.name && property.household_id && propertyHouseholdInfo?.name) {
    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', property.household_id);
    propertyLabel = formatPropertyLabel(property.name, { name: propertyHouseholdInfo.name, propertyCount: count ?? 1 });
  }

  const zip = new JSZip();
  const manifest: Record<string, { rows: number; error?: string }> = {};

  // SS-326. Live, not hardcoded -- see getPropertyScopedTables above.
  const propertyScopedTables = await getPropertyScopedTables();

  await Promise.all(
    propertyScopedTables.map(async (table) => {
      const { data, error } = await supabase.from(table).select('*').eq('property_id', propertyId);
      if (error) {
        // A failing table must not take the rest of the backup down with
        // it -- recorded in the manifest as an honest gap rather than a
        // silently truncated file with no note that anything was missed.
        manifest[table] = { rows: 0, error: error.message };
        return;
      }
      manifest[table] = { rows: data?.length ?? 0 };
      zip.file(`${table}.json`, JSON.stringify(data ?? [], null, 2));
    })
  );

  // Child tables that matter for a real no-recovery-path safety net but do
  // not carry property_id themselves -- fetched via their parent's
  // property-scoped ids instead. Recipe ingredients, shopping list items,
  // task assignments and SOP links are exactly the kind of content that
  // would otherwise be silently absent from a backup that only looked for
  // a property_id column.
  const { data: recipeRows } = await supabase.from('recipes').select('id').eq('property_id', propertyId);
  const recipeIds = (recipeRows ?? []).map((r) => r.id);
  if (recipeIds.length > 0) {
    const { data, error } = await supabase.from('recipe_ingredients').select('*').in('recipe_id', recipeIds);
    manifest['recipe_ingredients'] = error ? { rows: 0, error: error.message } : { rows: data?.length ?? 0 };
    if (!error) zip.file('recipe_ingredients.json', JSON.stringify(data ?? [], null, 2));
  } else {
    manifest['recipe_ingredients'] = { rows: 0 };
  }

  const { data: listRows } = await supabase.from('shopping_lists').select('id').eq('property_id', propertyId);
  const listIds = (listRows ?? []).map((r) => r.id);
  if (listIds.length > 0) {
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .in('shopping_list_id', listIds);
    manifest['shopping_list_items'] = error ? { rows: 0, error: error.message } : { rows: data?.length ?? 0 };
    if (!error) zip.file('shopping_list_items.json', JSON.stringify(data ?? [], null, 2));
  } else {
    manifest['shopping_list_items'] = { rows: 0 };
  }

  const { data: taskRows } = await supabase.from('master_tasks').select('id').eq('property_id', propertyId);
  const taskIds = (taskRows ?? []).map((r) => r.id);
  if (taskIds.length > 0) {
    const [{ data: assignData, error: assignErr }, { data: sopData, error: sopErr }] = await Promise.all([
      supabase.from('task_assignments').select('*').in('task_id', taskIds),
      supabase.from('master_task_sops').select('*').in('master_task_id', taskIds),
    ]);
    manifest['task_assignments'] = assignErr ? { rows: 0, error: assignErr.message } : { rows: assignData?.length ?? 0 };
    manifest['master_task_sops'] = sopErr ? { rows: 0, error: sopErr.message } : { rows: sopData?.length ?? 0 };
    if (!assignErr) zip.file('task_assignments.json', JSON.stringify(assignData ?? [], null, 2));
    if (!sopErr) zip.file('master_task_sops.json', JSON.stringify(sopData ?? [], null, 2));
  } else {
    manifest['task_assignments'] = { rows: 0 };
    manifest['master_task_sops'] = { rows: 0 };
  }

  zip.file(
    'MANIFEST.json',
    JSON.stringify(
      {
        property_id: propertyId,
        property_name: propertyLabel,
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        // SS-326. Recorded so a future audit can tell at a glance whether
        // the enumeration ran (a number here) rather than silently falling
        // back to nothing -- the same "an error must look like an error"
        // principle as the per-table manifest entries below.
        property_scoped_table_count: propertyScopedTables.length,
        tables: manifest,
        // Deliberately not included, and said so here rather than left
        // unexplained: global reference data (frequencies, sop_library,
        // item_name_synonyms) is shared across every property and
        // restorable from the schema itself -- not something this
        // property's own backup needs to carry.
        note:
          'Global, non-property-scoped reference tables (frequencies, sop_library, item_name_synonyms) are intentionally excluded -- they are shared across every property, not owned by this one.',
      },
      null,
      2
    )
  );

  // Copied into a plain, concrete ArrayBuffer before wrapping in a Blob.
  // JSZip's Uint8Array output is typed against ArrayBufferLike (which
  // includes SharedArrayBuffer), and neither NextResponse's BodyInit nor
  // Blob's BlobPart accept that generically -- a real type mismatch this
  // TS/lib version enforces, not one to cast around. A fresh, concrete
  // ArrayBuffer satisfies both without ambiguity.
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], { type: 'application/zip' });
  const filename = `sorted-and-stocked-backup-${propertyLabel ?? propertyId}-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`,
    },
  });
}
