// app/api/tools/pantry-zone-scan/route.ts
// SS-260. A photo of a pantry zone in, a list of candidate items out.
// Same shape as identify-item's route (auth, membership, rate limit, one
// callClaudeWithImage call, a tolerant JSON parse) because it is the same
// kind of request -- a single vision call gated to property members.
//
// Deliberately returns SUGGESTIONS only, never writes anything itself. The
// household/food categories Claude is asked for here are exactly the kind
// of thing this app never lets AI decide unsupervised elsewhere (kosher_type
// is the standing example) -- a person still checks each box before
// anything is created, and even then it lands in Capture Inbox for review,
// not a direct inventory_items write.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaudeWithImage } from '@/lib/anthropic/client';
import { checkRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You look at a photo of a household storage area (a pantry shelf, a cleaning cabinet, a bathroom drawer -- any zone where items are stored) and list the individual items you can identify.

For each distinct item visible:
- name: a short, plain product or item name suitable for an inventory list (use the brand name if legible, otherwise a generic description).
- category: your best estimate of a general category (e.g. Pantry, Cleaning, Personal Care, Paper Goods, Baking, Frozen) -- a single short word or phrase, your best guess, not a fixed list you must match exactly.
- is_food: true if this is something eaten or drunk, false otherwise.

Rules:
- Only list items you can actually make out. Do not invent items that might plausibly be on a shelf like this -- only what is visibly present in this specific photo.
- If the same product appears multiple times (three identical cans), list it once.
- Be concise: short names, no descriptions or reasoning.
- If you cannot make out any distinct items (blurry, too dark, empty shelf), return an empty list rather than guessing.

Respond with ONLY a JSON array (no text before or after it, no markdown code fence), where each element has exactly these keys: "name" (string), "category" (string), "is_food" (boolean). Return at most 15 items -- the most clearly identifiable ones if there are more.`;

type ScanItem = { name: string; category: string; is_food: boolean };

// Same "don't fail the whole request over a formatting slip" fallback as
// identify-item's parseIdentifyResult -- a fenced or slightly-off response
// still parses if the JSON itself is valid.
function parseScanResult(raw: string): ScanItem[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate.trim());
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name.trim() : '',
        category: typeof item.category === 'string' ? item.category.trim() : '',
        is_food: typeof item.is_food === 'boolean' ? item.is_food : true,
      }))
      .filter((item) => item.name.length > 0)
      .slice(0, 15);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  let body: { propertyId?: string; imageBase64?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body — expected JSON.' }, { status: 400 });
  }
  const { propertyId, imageBase64, mediaType } = body;

  if (!propertyId || !imageBase64) {
    return NextResponse.json({ error: 'Missing propertyId or photo.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Not a member of this property.' }, { status: 403 });

  const rateLimit = await checkRateLimit(supabase, 'pantry_zone_scan', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const { text } = await callClaudeWithImage({
      systemPrompt: SYSTEM_PROMPT,
      userText:
        'What household items are visible in this photo? List product names, estimated category (Pantry/Cleaning/Personal Care/etc.), and whether each is a food item. Be concise.',
      imageBase64,
      mediaType: mediaType ?? 'image/jpeg',
      useWebSearch: false,
    });
    return NextResponse.json({ items: parseScanResult(text) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
