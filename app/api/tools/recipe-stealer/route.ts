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
- If ambiguous, name the most likely interpretation and note the next most likely one.

Bilingual, because the household staff who cook from these are Spanish-speaking. Produce both languages now — never English-only with a promise to translate later.

Do NOT state or guess kosher_type (meat/dairy/pareve), hechsher, or whether the dish is kosher. A person decides that at review. Getting it wrong is a kashrut failure, not a cosmetic one — say nothing rather than guess.

Respond with ONLY a JSON object (no text before or after, no markdown code fence) with exactly these keys:
- "name": string — the dish name in English
- "name_es": string — the dish name in Spanish
- "ingredients": array of objects, each { "name": string (English), "name_es": string (Spanish), "quantity": string (e.g. "2 cups", "1 lb", or "" if not applicable) }
- "instructions_en": string — the full method in English, newline-separated numbered steps, including your caveats about this being a reconstruction and where a home version realistically falls short
- "instructions_es": string — the same method in Spanish
- "uncertain": boolean — true when this is a low-confidence reconstruction that should be double-checked`;

export type ScannedIngredient = { name: string; name_es: string; quantity: string };
export type ScannedRecipe = {
  name: string;
  name_es: string;
  ingredients: ScannedIngredient[];
  instructions_en: string;
  instructions_es: string;
  uncertain: boolean;
};

// Same "don't fail the whole request over a formatting slip" fallback as
// identify-item's parseIdentifyResult. A malformed response degrades to an
// empty, uncertain recipe the person can still edit -- it never invents
// content and never mirrors English into the Spanish fields, which would
// look translated without being translated.
function parseScannedRecipe(raw: string): ScannedRecipe {
  const empty: ScannedRecipe = {
    name: '',
    name_es: '',
    ingredients: [],
    instructions_en: '',
    instructions_es: '',
    uncertain: true,
  };
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  try {
    const p = JSON.parse(candidate.trim());
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    return {
      name: str(p.name),
      name_es: str(p.name_es),
      ingredients: Array.isArray(p.ingredients)
        ? p.ingredients
            .map((i: Record<string, unknown>) => ({
              name: str(i?.name),
              name_es: str(i?.name_es),
              quantity: str(i?.quantity),
            }))
            .filter((i: ScannedIngredient) => i.name || i.name_es)
        : [],
      instructions_en: str(p.instructions_en),
      instructions_es: str(p.instructions_es),
      uncertain: typeof p.uncertain === 'boolean' ? p.uncertain : true,
    };
  } catch {
    return empty;
  }
}

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
    return NextResponse.json({ recipe: parseScannedRecipe(text) });
  } catch (err) {
    // Log the real error server-side (Vercel function logs) -- the raw
    // message (e.g. "Anthropic API error (401): invalid x-api-key") was
    // previously sent straight to the client and rendered verbatim in the
    // modal. A caller has no use for that detail and it isn't safe to show
    // a stranger a live API failure reason.
    console.error('recipe-stealer failed:', err);
    return NextResponse.json(
      { error: "We couldn't process that right now — try again in a moment." },
      { status: 500 }
    );
  }
}
