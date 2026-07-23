// Downloads an image from a source URL and re-hosts it into the
// inventory-photos Supabase Storage bucket, then updates photo_url on
// every given inventory_items row. Never hotlinks per established
// convention. Usage:
//   node rehost-photo.mjs <sourceImageUrl> <itemId1,itemId2,...>
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: 'C:/Users/rockl/OneDrive/Desktop/Sort and Place/sorted-and-stocked-files/.env.local' });

const [,, sourceUrl, idsArg] = process.argv;
if (!sourceUrl || !idsArg) {
  console.error('Usage: node rehost-photo.mjs <sourceImageUrl> <itemId1,itemId2,...>');
  process.exit(1);
}
const ids = idsArg.split(',').map((s) => s.trim());

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    console.error('FAILED to download source image:', res.status);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : 'jpg';
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('inventory-photos')
    .upload(path, buf, { contentType });
  if (uploadError) {
    console.error('FAILED to upload:', uploadError.message);
    process.exit(1);
  }

  const { data: pub } = supabase.storage.from('inventory-photos').getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updateError, count } = await supabase
    .from('inventory_items')
    .update({ photo_url: publicUrl })
    .in('id', ids)
    .select('id', { count: 'exact' });
  if (updateError) {
    console.error('FAILED to update DB:', updateError.message);
    process.exit(1);
  }

  console.log('OK', publicUrl, 'rows_updated=' + (count ?? ids.length));
}

main();
