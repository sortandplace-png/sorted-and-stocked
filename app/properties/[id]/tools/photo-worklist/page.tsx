// app/properties/[id]/tools/photo-worklist/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PhotoWorklistClient, { type WorklistItem, type PhotoSuggestion } from '@/components/PhotoWorklistClient';
import { formatPropertyLabel, buildHouseholdCounts } from '@/lib/property-display';

// SS-869 part 2. "Use this photo": the business already owns most of these
// pictures -- 245 items across Henderson and Low match, by name, a
// photographed item somewhere else in the business. TWO PASSES, NO FUZZY
// MATCHING, per Racquel's explicit ruling: near-miss matching on product
// names is how "salt" once matched "shampoo" in this database. Both passes
// are exact-string equality after lower(trim(...)) -- pass 2 widens the
// equality set through item_name_synonyms, it does not loosen it.
function normalize(name: string): string {
  return name.trim().toLowerCase();
}

export default async function PhotoWorklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || membership.role === 'staff') {
    redirect(`/properties/${id}/inventory`);
  }

  // SS-869 "do not lose it": the empty state was reading
  // photo_needs_sourcing, an unmaintained flag that let Henderson show
  // "nothing left" while holding 175 photoless items. photo_url IS NULL
  // (or empty string, the same shape QuickPhotoCaptureClient already
  // treats as unset) is the one real fact -- read directly, no flag in
  // the middle to drift from it.
  const { data: itemRows } = await supabase
    .from('inventory_items')
    .select('id, name, category, locations(name)')
    .eq('property_id', id)
    .or('photo_url.is.null,photo_url.eq.')
    .order('category')
    .order('name');

  const items: WorklistItem[] = (itemRows ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    location_name: (i.locations as unknown as { name: string } | null)?.name ?? null,
  }));

  const suggestions: Record<string, PhotoSuggestion> = {};

  if (items.length > 0) {
    // Every OTHER property's photographed items -- this is a business-wide
    // read (crosses household boundaries on purpose: the source house is
    // always named on the suggestion, so nothing is silent). Main, Lax and
    // Country are where these pictures came from, which is exactly why
    // they measure at 0-1 candidates when THEY are the target.
    const [{ data: photographedRows }, { data: synonymRows }, { data: allProps }] = await Promise.all([
      supabase
        .from('inventory_items')
        .select('name, photo_url, property_id, properties(name, household_id, households(name))')
        .neq('property_id', id)
        .not('photo_url', 'is', null)
        .neq('photo_url', ''),
      supabase.from('item_name_synonyms').select('canonical_name, synonym'),
      supabase.from('properties').select('household_id').not('household_id', 'is', null).is('archived_at', null),
    ]);

    const householdCounts = buildHouseholdCounts((allProps ?? []) as { household_id: string | null }[]);

    type Candidate = { photoUrl: string; propertyLabel: string };
    const photoedByName = new Map<string, Candidate[]>();
    for (const row of photographedRows ?? []) {
      const prop = row.properties as unknown as {
        name: string;
        household_id: string | null;
        households: { name: string } | null;
      } | null;
      if (!prop) continue;
      const label = formatPropertyLabel(prop.name, {
        name: prop.households?.name ?? '',
        propertyCount: prop.household_id ? householdCounts.get(prop.household_id) ?? 1 : 1,
      });
      const key = normalize(row.name);
      const list = photoedByName.get(key) ?? [];
      list.push({ photoUrl: row.photo_url as string, propertyLabel: label });
      photoedByName.set(key, list);
    }

    // Undirected equivalence set per normalized name: a name that appears
    // as either side of an item_name_synonyms row expands to every other
    // name on that same row. Still exact-string matching once expanded --
    // this widens WHICH strings count as equal, it never approximates.
    const equivalents = new Map<string, Set<string>>();
    function link(a: string, b: string) {
      if (!equivalents.has(a)) equivalents.set(a, new Set([a]));
      if (!equivalents.has(b)) equivalents.set(b, new Set([b]));
      equivalents.get(a)!.add(b);
      equivalents.get(b)!.add(a);
    }
    for (const row of synonymRows ?? []) {
      link(normalize(row.canonical_name), normalize(row.synonym));
    }

    for (const item of items) {
      const key = normalize(item.name);
      const namesToCheck = [key, ...(equivalents.get(key) ?? [])];
      const candidates: Candidate[] = [];
      const seenNames = new Set<string>();
      for (const n of namesToCheck) {
        if (seenNames.has(n)) continue;
        seenNames.add(n);
        const found = photoedByName.get(n);
        if (found) candidates.push(...found);
      }
      if (candidates.length === 0) continue;
      candidates.sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
      suggestions[item.id] = {
        photoUrl: candidates[0].photoUrl,
        propertyLabel: candidates[0].propertyLabel,
        otherCount: candidates.length - 1,
      };
    }
  }

  return <PhotoWorklistClient propertyId={id} initialItems={items} initialSuggestions={suggestions} />;
}
