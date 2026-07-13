// scripts/generate-recipe-photos.mjs
// Generates a food-photography image per recipe via OpenAI's Images API,
// uploads it into the recipe-photos Supabase Storage bucket (never
// hotlinks, matching every other photo pipeline in this repo), and sets
// photo_url + photo_is_ai_generated = true on the recipe.
//
// Usage: node scripts/generate-recipe-photos.mjs [limit]
// Reads OPENAI_API_KEY and Supabase creds from .env.local -- never hardcode
// these values in committed code.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: 'C:/Users/rockl/OneDrive/Desktop/sorted-and-stocked-files/.env.local' });

const limit = Number(process.argv[2] ?? 12);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024',
      quality: 'medium',
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in OpenAI response');
  return Buffer.from(b64, 'base64');
}

function buildPrompt(recipe) {
  // Plain overhead food-photography framing -- no plating/garnish
  // invention beyond what the name implies, no text/watermarks.
  return `Professional overhead food photography of "${recipe.name}", a home-cooked ${recipe.course ?? 'dish'}. Natural light, simple white or wood table setting, no text, no watermark, no hands, realistic and appetizing.`;
}

async function main() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, name, course, property_id')
    .is('photo_url', null)
    .order('name')
    .limit(limit);

  if (error) {
    console.error('FAILED to fetch recipes:', error.message);
    process.exit(1);
  }
  if (!recipes || recipes.length === 0) {
    console.log('No recipes missing photo_url.');
    return;
  }

  console.log(`Generating photos for ${recipes.length} recipes...`);
  let ok = 0;
  let failed = 0;

  for (const recipe of recipes) {
    try {
      const imageBuffer = await generateImage(buildPrompt(recipe));
      const path = `${recipe.property_id}/${recipe.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('recipe-photos')
        .upload(path, imageBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`upload: ${uploadError.message}`);

      const { data: pub } = supabase.storage.from('recipe-photos').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('recipes')
        .update({ photo_url: pub.publicUrl, photo_is_ai_generated: true })
        .eq('id', recipe.id);
      if (updateError) throw new Error(`db update: ${updateError.message}`);

      console.log(`OK  ${recipe.name} -> ${pub.publicUrl}`);
      ok++;
    } catch (err) {
      console.error(`FAIL ${recipe.name}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
}

main();
