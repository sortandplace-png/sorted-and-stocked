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

Respond with ONLY a JSON object (no text before or after it, no markdown code fence) with exactly these keys: "name" (string — your best-guess name, or empty string if you truly cannot tell) and "uncertain" (boolean — true if this is a low-confidence guess that should be double-checked).`;

type IdentifyResult = {
  name: string;
  uncertain: boolean;
};

// Same "don't fail the whole request over a formatting slip" fallback as
// ingredient-scanner's parseScannerResult.
function parseIdentifyResult(raw: string): IdentifyResult {
  const fallback: IdentifyResult = { name: '', uncertain: true };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate.trim());
    return {
      name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
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
