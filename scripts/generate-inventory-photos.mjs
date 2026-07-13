// scripts/generate-inventory-photos.mjs
// Same pipeline as generate-recipe-photos.mjs, pointed at inventory_items
// instead of recipes: generates a product-photography image via OpenAI's
// Images API, uploads into the item-photos Supabase Storage bucket (never
// hotlinks, matching every other photo pipeline in this repo), and sets
// photo_url + photo_sourcing_type = 'generic' (this is an AI-generated
// generic product shot, not a real branded package photo -- the existing
// photo_sourcing_type check constraint only allows 'branded' or 'generic',
// there's no separate AI-generated flag on this table the way recipes has
// photo_is_ai_generated).
//
// Usage: node scripts/generate-inventory-photos.mjs [limit] [priorityNames...]
// priorityNames (optional, comma-separated) are fetched and photographed
// first, before filling the rest of the limit alphabetically -- e.g. to
// front-load specific items someone's actively reviewing right now.
// Reads OPENAI_API_KEY and Supabase creds from .env.local -- never hardcode
// these values in committed code.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: 'C:/dev/sorted-and-stocked-files/.env.local' });

const limit = Number(process.argv[2] ?? 12);
const priorityNames = (process.argv[3] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

function buildPrompt(item) {
  // Plain studio product-photography framing -- no scene/context invention
  // beyond what the name+category imply, no text/watermarks, no brand logos
  // (these are generic replacement photos, not a specific product's real
  // packaging).
  const categoryHint = item.category ? ` (${item.category} household item)` : '';
  return `Professional studio product photography of "${item.name}"${categoryHint}. Plain white or light neutral background, soft even lighting, centered composition, no text, no watermark, no brand logos, no hands, realistic.`;
}

async function main() {
  let selected = [];

  if (priorityNames.length > 0) {
    const { data: priorityItems, error: priorityError } = await supabase
      .from('inventory_items')
      .select('id, name, category, property_id')
      .is('photo_url', null)
      .in('name', priorityNames);
    if (priorityError) {
      console.error('FAILED to fetch priority items:', priorityError.message);
      process.exit(1);
    }
    selected = priorityItems ?? [];
  }

  if (selected.length < limit) {
    const excludeIds = selected.map((i) => i.id);
    let query = supabase
      .from('inventory_items')
      .select('id, name, category, property_id')
      .is('photo_url', null)
      .order('name')
      .limit(limit - selected.length + excludeIds.length);
    const { data: rest, error: restError } = await query;
    if (restError) {
      console.error('FAILED to fetch items:', restError.message);
      process.exit(1);
    }
    for (const item of rest ?? []) {
      if (selected.length >= limit) break;
      if (excludeIds.includes(item.id)) continue;
      selected.push(item);
    }
  }

  if (selected.length === 0) {
    console.log('No inventory items missing photo_url.');
    return;
  }

  console.log(`Generating photos for ${selected.length} inventory items...`);
  let ok = 0;
  let failed = 0;

  for (const item of selected) {
    try {
      const imageBuffer = await generateImage(buildPrompt(item));
      const path = `${item.property_id}/${item.id}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(path, imageBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw new Error(`upload: ${uploadError.message}`);

      const { data: pub } = supabase.storage.from('item-photos').getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ photo_url: pub.publicUrl, photo_sourcing_type: 'generic' })
        .eq('id', item.id);
      if (updateError) throw new Error(`db update: ${updateError.message}`);

      console.log(`OK  ${item.name} -> ${pub.publicUrl}`);
      ok++;
    } catch (err) {
      console.error(`FAIL ${item.name}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
}

main();
