// app/api/tools/recipe-stealer/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaudeWithImage, callClaudeWithText } from '@/lib/anthropic/client';
import { checkRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You reverse-engineer a home-cookable recipe from either a photo of a finished dish, or a typed description/name of one.

Rules:
- If given a photo: identify the dish and its likely components from visual cues (ingredients, sauce, garnish, cooking method suggested by color/texture). If given text: work from the dish name/description provided.
- Give a full ingredient list with real quantities for a home cook, and clear step-by-step technique.
- Be upfront that this is your best reconstruction, not the restaurant's actual proprietary recipe — you cannot taste the dish or know their exact method.
- Where a home version will realistically fall short of a restaurant version, say why (commercial equipment, higher heat than a home stove, aged stock, larger batch emulsification, etc.) rather than implying there's one "secret" fix.
- If ambiguous, name the most likely interpretation and note the next most likely one.`;

export async function POST(request: Request) {
  const { propertyId, imageBase64, mediaType, textInput } = await request.json();

  if (!propertyId || (!imageBase64 && !textInput)) {
    return NextResponse.json({ error: 'Missing propertyId, and either a photo or typed dish description.' }, { status: 400 });
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

  const rateLimit = await checkRateLimit(supabase, 'recipe_stealer', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const { text } = imageBase64
      ? await callClaudeWithImage({
          systemPrompt: SYSTEM_PROMPT,
          userText: 'Reverse-engineer this dish into a recipe I can make at home.',
          imageBase64,
          mediaType,
          useWebSearch: false,
        })
      : await callClaudeWithText({
          systemPrompt: SYSTEM_PROMPT,
          userText: `Reverse-engineer this dish into a recipe I can make at home: ${textInput}`,
        });
    return NextResponse.json({ result: text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
