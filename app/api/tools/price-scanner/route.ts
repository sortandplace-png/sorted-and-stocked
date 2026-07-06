// app/api/tools/price-scanner/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaudeWithImage, callClaudeWithText } from '@/lib/anthropic/client';
import { checkRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You help someone find a cheaper version of a product, whether they photographed it or just typed its name.

Rules:
- Identify the product as specifically as you can (brand, name, size/variant) before searching. If given only a typed description, work with what's provided.
- Search the web for genuinely comparable alternatives — same category, similar quality tier, similar materials or ingredients where relevant.
- For each alternative: name it, give its price, calculate the price difference vs. the original, and link to where it's sold.
- State real trade-offs plainly (smaller size, fewer features, different certification, mixed reviews, etc.) — do not claim "same quality" unless you can actually support that from specs or reviews. A spec comparison is not proof of real-world durability or QC; say so if that's the limit of what you can verify.
- If you can't confidently identify the product, say so rather than guessing.
- Keep the answer scannable: short sections per alternative, not one long paragraph.`;

export async function POST(request: Request) {
  const { propertyId, imageBase64, mediaType, textInput } = await request.json();

  if (!propertyId || (!imageBase64 && !textInput)) {
    return NextResponse.json({ error: 'Missing propertyId, and either a photo or typed product description.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  // Any member can use this tool, not just owner/manager — it's a shopping
  // aid, not an admin action. Still gated to members only since each call
  // costs real money against the Anthropic API.
  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Not a member of this property.' }, { status: 403 });

  // 20 scans per hour per user — this call costs real money (vision + web
  // search), so cap it before it ever reaches the Anthropic API.
  const rateLimit = await checkRateLimit(supabase, 'price_scanner', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const { text } = imageBase64
      ? await callClaudeWithImage({
          systemPrompt: SYSTEM_PROMPT,
          userText: 'Find me a cheaper version of this exact product. Show real alternatives, real prices, and real trade-offs.',
          imageBase64,
          mediaType,
          useWebSearch: true,
        })
      : await callClaudeWithText({
          systemPrompt: SYSTEM_PROMPT,
          userText: `Find me a cheaper version of this product: ${textInput}. Show real alternatives, real prices, and real trade-offs.`,
        });
    return NextResponse.json({ result: text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
