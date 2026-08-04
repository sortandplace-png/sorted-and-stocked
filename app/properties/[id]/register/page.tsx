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
import RegisterTabsClient, { type WorkItemRow, type DraftRow } from '@/components/RegisterTabsClient';

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

  // SS-616 (Racquel, 4 Aug): manager+ on the OPERATOR-CONSOLE property.
  // This was owner-exactly per the 2 Aug directive, which hid the page
  // from sortandplace@gmail.com -- a manager on Lax, and the account she
  // actually works from. Widened by ROLE but not by PROPERTY: the
  // isOperatorConsole check immediately below is what keeps this off
  // client houses, and it is the reason this is safe. Managers hold
  // seats on Main, Country, Low and Henderson, and
  // demo@sortedandstocked.com (Apple App Review) is a manager on QA
  // Demo -- none of those properties carry operator_console, verified
  // against feature_flags, so none of them reach this page.
  //
  // BOTH LAYERS, deliberately: the nav filter alone would have shown a
  // link that 403s. The third layer needed no change -- RLS policy
  // work_items_select_operator (migration 156) already grants owner OR
  // manager on an operator-console property, so the rows are readable.
  // Had it been owner-only this change would have rendered an empty
  // register, which is worse than a redirect.
  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
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

  // Drafts tab (Racquel's ruling, 3 Aug late; reshaped to tiles 4 Aug): the
  // unpublished posts had no readable surface anywhere -- she was asked to
  // choose numbering and publish dates for writing she could not read. The
  // register is already the manager-gated list-with-detail surface, so
  // drafts live on it as a second tab rather than a new page/route/nav
  // entry. intended_publish_date and draft_order are editable inline
  // (migration 187) -- everything else about a draft stays read-only,
  // publishing stays a deliberate act elsewhere. Reads through the
  // caller's session; migration 180's drafts-only SELECT policy
  // (owner/manager members) is what actually grants this.
  const { data: drafts } = await supabase
    .from('blog_posts')
    .select('slug, title, body_markdown, header_image_url, intended_publish_date, draft_order')
    .is('published_at', null)
    .order('draft_order', { ascending: true, nullsFirst: false })
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
    <RegisterTabsClient
      rows={(items ?? []) as WorkItemRow[]}
      drafts={(drafts ?? []) as DraftRow[]}
      propertyId={id}
    />
  );
}
