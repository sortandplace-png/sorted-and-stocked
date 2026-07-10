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
- End the analysis with a one-line honest summary: is this product mostly unremarkable, or does it have a small number of ingredients actually worth a second look?

Also identify, separately from the analysis:
- productName: the product's name if it's visible on the label or given in the input, otherwise null. Do not guess a brand from the ingredients alone.
- allergens: a plain list of allergens actually present or called out on the label (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, sesame, "may contain" notices, etc.) — empty array if none found. Do not infer an allergen that isn't actually indicated.
- kosherGuess: a best-guess read based only on what's visible in the ingredients (e.g. dairy-derived ingredients present -> likely dairy; gelatin/meat-derived ingredients present -> likely meat; no dairy/meat/fish indicators -> possibly pareve). This is never a determination, only a guess from ingredient text — phrase it that way. null if the ingredients don't give enough signal to guess anything.

Respond with ONLY a JSON object (no text before or after it, no markdown code fence) with exactly these keys: "productName" (string or null), "allergens" (array of strings), "kosherGuess" (string or null), "analysis" (string — the full ingredient-by-ingredient explanation and summary described above).`;

type ScannerResult = {
  productName: string | null;
  allergens: string[];
  kosherGuess: string | null;
  analysis: string;
};

// Claude generally complies with "JSON only," but not always — models
// sometimes wrap it in a ```json fence despite being told not to. Falling
// back to treating the whole response as prose (rather than failing the
// request) means a parsing slip degrades to "no structured fields" instead
// of a broken scan.
function parseScannerResult(raw: string): ScannerResult {
  const fallback: ScannerResult = { productName: null, allergens: [], kosherGuess: null, analysis: raw };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const parsed = JSON.parse(candidate.trim());
    return {
      productName: typeof parsed.productName === 'string' ? parsed.productName : null,
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens.filter((a: unknown) => typeof a === 'string') : [],
      kosherGuess: typeof parsed.kosherGuess === 'string' ? parsed.kosherGuess : null,
      analysis: typeof parsed.analysis === 'string' ? parsed.analysis : raw,
    };
  } catch {
    return fallback;
  }
}

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
          userText:
            'Read this ingredient label and explain it to me — what each thing does, and whether any of it is actually worth worrying about. Also identify the product name, any allergens, and give a kosher best-guess, per your instructions.',
          imageBase64,
          mediaType: mediaType ?? 'image/jpeg',
          useWebSearch: true,
        })
      : await callClaudeWithText({
          systemPrompt: SYSTEM_PROMPT,
          userText: `Explain this ingredient list to me — what each thing does, and whether any of it is actually worth worrying about. Also identify the product name, any allergens, and give a kosher best-guess, per your instructions: ${textInput}`,
        });
    return NextResponse.json(parseScannerResult(text));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
