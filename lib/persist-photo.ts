// lib/persist-photo.ts
// Downloads an externally-hosted image once and re-hosts it in Supabase
// Storage, so ingredient photos survive the source API changing or
// disappearing (e.g. Unsplash Source's shutdown broke every hotlinked URL).
import { SupabaseClient } from '@supabase/supabase-js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

async function persistOne(
  supabase: SupabaseClient,
  bucket: string,
  itemName: string,
  sourceUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const buffer = Buffer.from(await response.arrayBuffer());
    const path = `${slugify(itemName)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error(`[STORAGE ERROR] ${itemName}:`, uploadError);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error(`[STORAGE FETCH ERROR] ${itemName}:`, err);
    return null;
  }
}

// Tries each candidate URL in order, since a meaningful fraction of
// Openverse thumbnail links are dead (424 from their proxy when the
// original third-party host no longer serves the image).
export async function persistPhoto(
  supabase: SupabaseClient,
  itemName: string,
  sourceUrls: string | string[],
  bucket: string = 'ingredient-photos'
): Promise<string | null> {
  const candidates = Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls];

  for (const url of candidates) {
    const result = await persistOne(supabase, bucket, itemName, url);
    if (result) return result;
  }

  return null;
}
