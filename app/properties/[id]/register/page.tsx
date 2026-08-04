// app/properties/[id]/register/page.tsx
// SS-457: the live register viewer. Lax only, owner/manager only -- the
// exact SS-436/SS-410 operator-console gate, server-side, not a hidden
// nav tile (SS-381). Reads work_items LIVE on every load (no caching:
// auth cookies already force dynamic rendering) through the caller's own
// session, so work_items_select_operator (migration 156) is what actually
// decides access -- this page never widens read access to the register
// (and must not: that removal is a standing rule).
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOperatorConsole } from '@/lib/module-flags';
import RegisterViewerClient, { type WorkItemRow } from '@/components/RegisterViewerClient';
import { renderSimpleMarkdown } from '@/lib/simple-markdown';

export const metadata = {
  title: 'Register — Sorted & Stocked',
};

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('property_members')
    .select('role, properties(feature_flags)')
    .eq('property_id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  // Tightened to OWNER exactly (2 Aug directive: MIN_ROLE owner) -- the
  // register is the operator's own working record; a manager tier that
  // can read every finding about every house was wider than ruled.
  if (!membership || membership.role !== 'owner') {
    redirect(`/properties/${id}/inventory`);
  }
  const flags = (membership.properties as unknown as { feature_flags: Record<string, unknown> | null } | null)
    ?.feature_flags;
  if (!isOperatorConsole(flags)) {
    redirect(`/properties/${id}/dashboard`);
  }

  const { data: items, error } = await supabase
    .from('work_items')
    .select(
      'id, title, detail, status, evidence, owner, sent_to_code_at, code_reported_at, verified_at, verified_how, screenshot_ref, superseded_by, created_at, updated_at'
    );

  // Drafts section (Racquel's ruling, 3 Aug late): the unpublished posts
  // had no readable surface anywhere -- she was asked to choose numbering
  // and publish dates for writing she could not read. The register is
  // already the manager-gated list-with-detail surface, so drafts live
  // under it rather than on a new page. Read-only on purpose: no editing,
  // no publish controls -- publishing stays a deliberate act elsewhere.
  // Reads through the caller's session; migration 180's drafts-only
  // SELECT policy (owner/manager members) is what actually grants this.
  const { data: drafts } = await supabase
    .from('blog_posts')
    .select('slug, title, body_markdown')
    .is('published_at', null)
    .order('slug');

  // SS-457 P0 lesson: a permission failure here once rendered as "0 rows",
  // which reads like an empty register -- a lie. A read error must LOOK
  // like an error.
  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <h1 className="font-display text-3xl text-denim mb-2">Register</h1>
        <p className="text-sm text-rust font-medium">
          The register could not be read: {error.message}. This is an access/permission failure, not an
          empty register — the table always has rows.
        </p>
      </div>
    );
  }

  return (
    <>
      <RegisterViewerClient rows={(items ?? []) as WorkItemRow[]} />

      {(drafts ?? []).length > 0 && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-10">
          <h2 className="font-display text-2xl text-denim mb-1">Drafts</h2>
          <p className="text-[13px] text-denim/70 mb-4">
            {drafts!.length} unpublished posts, read-only. Publishing stays a deliberate act elsewhere.
          </p>
          <div className="space-y-2">
            {drafts!.map((d) => {
              const words = (d.body_markdown ?? '').trim().split(/\s+/).filter(Boolean).length;
              return (
                <details key={d.slug} className="bg-card rounded-xl2 border border-cardBorder shadow-card overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 list-none [&::-webkit-details-marker]:hidden">
                    <span className="text-[14px] font-medium text-denim">{d.title}</span>
                    <span className="block text-[11px] text-denim/60 tabular-nums mt-0.5">
                      {d.slug} · {words.toLocaleString()} words
                    </span>
                  </summary>
                  <div className="border-t border-cardBorder/60 bg-mist/40 px-5 py-4">
                    {renderSimpleMarkdown(d.body_markdown ?? '')}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
