// app/api/tools/identify-item/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaudeWithImage } from '@/lib/anthropic/client';
import { checkRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You look at a photo of a single grocery or household item — not a barcode, not an ingredient label close-up, just the item itself (a piece of produce, a packaged product, a homemade dish, anything that might go on a household inventory list) — and suggest a short, plain name for it, suitable for an inventory list.

Rules:
- If a brand/product name is legible in the photo, use that specific product name (e.g. "Heinz Ketchup 32oz").
- If it's a generic or unbranded item (produce, bulk food, a homemade item), give a plain generic name (e.g. "Red Onions", "Homemade Chicken Soup").
- Keep it short — a few words, not a sentence.
- Only guess a category or additional detail if it's genuinely visible; do not invent brand, size, or flavor information you can't actually see.
- If you genuinely cannot tell what the item is (blurry, unclear, empty frame), say so honestly rather than guessing.

Also give the Spanish name, because the household staff reading this inventory are Spanish-speaking:
- Translate the generic part of the name, not the brand ("Heinz Ketchup 32oz" -> "Kétchup Heinz 32oz", "Red Onions" -> "Cebollas Rojas").
- If the item is a proper brand name with nothing translatable, repeat the same string rather than inventing a Spanish-sounding variant.
- If you cannot tell what the item is, return an empty string for the Spanish name too.

Do NOT suggest a category, a kosher type, or whether the item is food — those are decided by a person, never inferred from a photo.

Respond with ONLY a JSON object (no text before or after it, no markdown code fence) with exactly these keys: "name" (string — your best-guess English name, or empty string if you truly cannot tell), "name_es" (string — the Spanish name, or empty string) and "uncertain" (boolean — true if this is a low-confidence guess that should be double-checked).`;

type IdentifyResult = {
  name: string;
  name_es: string;
  uncertain: boolean;
};

// Same "don't fail the whole request over a formatting slip" fallback as
// ingredient-scanner's parseScannerResult.
function parseIdentifyResult(raw: string): IdentifyResult {
  const fallback: IdentifyResult = { name: '', name_es: '', uncertain: true };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate.trim());
    return {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      // Missing/malformed name_es degrades to empty rather than failing the
      // request -- the confirming step shows it as an editable field either
      // way, so a person still fills it in. Never falls back to the English
      // name: a silent English-in-a-Spanish-field row is exactly the
      // "looks translated but isn't" state the bilingual rule exists to stop.
      name_es: typeof parsed.name_es === 'string' ? parsed.name_es.trim() : '',
      uncertain: typeof parsed.uncertain === 'boolean' ? parsed.uncertain : true,
    };
  } catch {
    return fallback;
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

  const rateLimit = await checkRateLimit(supabase, 'identify_item', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const { text } = await callClaudeWithImage({
      systemPrompt: SYSTEM_PROMPT,
      userText: 'What is this item? Suggest a short inventory-list name for it, per your instructions.',
      imageBase64,
      mediaType: mediaType ?? 'image/jpeg',
      useWebSearch: false,
    });
    return NextResponse.json(parseIdentifyResult(text));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
