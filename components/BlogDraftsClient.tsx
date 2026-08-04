// components/BlogDraftsClient.tsx
// SS-667: the 32 unpublished blog_posts rows as tiles, not the old
// details/summary list -- Racquel: "NOT PILLS OR LISTS!!!! i want tiles
// with picture preview, date its drfted for ect ect". Concept B: rounded-xl2,
// 1px cardBorder, card ground, pin dot top right, the blue-grey shadow.
//
// intended_publish_date and draft_order are already live and seeded on all
// 32 rows (migration 187) -- date is set by Claude, edited here by Racquel.
// Everything else about a draft (title, body, slug) stays read-only; only
// the date is ever written from this tile. Same RLS blog_posts_update_managers
// already gates every other write on this table (owner/manager,
// operator-console property) -- confirmed live, no new policy needed.
//
// 5 of 32 (blog-39 through blog-43, first in the intended schedule) have no
// header_image_url -- same visual fallback BlogPostsList.tsx already uses
// for the public blog grid, not a new pattern.
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { storageThumbnail } from '@/lib/storage-image';
import Pin from '@/components/ui/Pin';

export type DraftRow = {
  slug: string;
  title: string;
  body_markdown: string;
  header_image_url: string | null;
  intended_publish_date: string | null;
  draft_order: number | null;
};

function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

export default function BlogDraftsClient({ drafts, propertyId }: { drafts: DraftRow[]; propertyId: string }) {
  void propertyId; // reserved: RLS already scopes this table, not read by any query here yet
  const supabase = createClient();
  const [dates, setDates] = useState<Record<string, string | null>>(
    Object.fromEntries(drafts.map((d) => [d.slug, d.intended_publish_date]))
  );
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [errorSlug, setErrorSlug] = useState<string | null>(null);

  async function saveDate(slug: string, value: string) {
    const previous = dates[slug] ?? null;
    const next = value || null;
    setDates((prev) => ({ ...prev, [slug]: next }));
    setSavingSlug(slug);
    setErrorSlug(null);
    const { error } = await supabase.from('blog_posts').update({ intended_publish_date: next }).eq('slug', slug);
    setSavingSlug(null);
    if (error) {
      setDates((prev) => ({ ...prev, [slug]: previous }));
      setErrorSlug(slug);
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <p className="text-sm text-denim/70">No drafts right now.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      <p className="text-[13px] text-denim/70 mb-4">
        {drafts.length} unpublished posts. Title, body and slug are read-only here; the intended date is editable.
        Publishing stays a deliberate act elsewhere.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drafts.map((d) => {
          const words = wordCount(d.body_markdown);
          const date = dates[d.slug] ?? '';
          return (
            <div
              key={d.slug}
              className="relative bg-card rounded-xl2 border border-cardBorder shadow-card overflow-hidden flex flex-col"
            >
              <Pin size="sm" />
              {d.header_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storageThumbnail(d.header_image_url, 400)}
                  alt=""
                  className="w-full h-32 object-cover bg-mist"
                />
              ) : (
                <div className="w-full h-32 bg-gradient-to-br from-brass/20 to-brass/5 flex items-center justify-center">
                  <span className="text-4xl">📖</span>
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <p className="text-[14px] font-medium text-denim leading-snug">{d.title}</p>
                <p className="text-[11px] text-denim/60 tabular-nums">
                  {d.slug} · {words.toLocaleString()} words
                </p>
                <div className="mt-auto pt-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-denim/50 mb-1">
                    Intended date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => saveDate(d.slug, e.target.value)}
                    disabled={savingSlug === d.slug}
                    className="w-full text-[13px] border border-cardBorder rounded-lg px-2 py-1.5 bg-linen text-denim disabled:opacity-50"
                  />
                  {errorSlug === d.slug && (
                    <p className="text-[11px] text-rust mt-1">Could not save — try again.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
