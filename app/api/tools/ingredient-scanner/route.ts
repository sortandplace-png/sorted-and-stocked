// app/api/tools/ingredient-scanner/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { callClaudeWithImage, callClaudeWithText } from '@/lib/anthropic/client';
import { checkRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `You read an ingredient list — from a photo of a label, or typed in directly — and explain it to someone with no science background.

Rules:
- If given a photo: read every ingredient you can make out, and say which parts you couldn't read rather than guessing. If given typed text: work with exactly what's provided.
- For each ingredient: say what it actually does in the product (preservative, thickener, flavoring, etc.) in plain language.
- Only flag a health concern if it's genuinely supported by real evidence — and say how strong that evidence actually is ("well-established at normal exposure," "debated," "concern is specifically about high-dose/occupational exposure, not what's in this product," etc.). Most ingredients on most labels are unremarkable — do not manufacture concern where there isn't good evidence for it just to make the list feel thorough.
- Never state a risk more dramatically than the evidence supports. Dose and context matter — say so when relevant.
- Only suggest a cleaner alternative product when there's a genuinely well-supported concern worth avoiding, not as a default for every ingredient.
- End with a one-line honest summary: is this product mostly unremarkable, or does it have a small number of ingredients actually worth a second look?`;

export async function POST(request: Request) {
  let body: { propertyId?: string; imageBase64?: string; mediaType?: string; textInput?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body — expected JSON.' }, { status: 400 });
  }
  const { propertyId, imageBase64, mediaType, textInput } = body;

  if (!propertyId || (!imageBase64 && !textInput)) {
    return NextResponse.json({ error: 'Missing propertyId, and either a photo or typed ingredient list.' }, { status: 400 });
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

  const rateLimit = await checkRateLimit(supabase, 'ingredient_scanner', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  try {
    const { text } = imageBase64
      ? await callClaudeWithImage({
          systemPrompt: SYSTEM_PROMPT,
          userText: 'Read this ingredient label and explain it to me — what each thing does, and whether any of it is actually worth worrying about.',
          imageBase64,
          mediaType: mediaType ?? 'image/jpeg',
          useWebSearch: true,
        })
      : await callClaudeWithText({
          systemPrompt: SYSTEM_PROMPT,
          userText: `Explain this ingredient list to me — what each thing does, and whether any of it is actually worth worrying about: ${textInput}`,
        });
    return NextResponse.json({ result: text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
