// app/properties/[id]/staff/sops/page.tsx
// The SOP Library moved into the Staff Handbook as its Procedures tab.
// This route is kept, not deleted (R21) -- it is linked from the nav, from
// lib/app-routes.ts, and from anyone's bookmarks.
//
// ?sop=<id> is forwarded rather than dropped. The Task Center's "View full
// procedure" link opens a specific SOP, and a redirect that discarded the
// query would land everyone on the top of a 55-row list -- which is exactly
// the half-working link that deep link was added to avoid.
import { redirect } from 'next/navigation';

export default async function SopLibraryRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sop?: string }>;
}) {
  const { id } = await params;
  const { sop } = await searchParams;
  const query = new URLSearchParams({ tab: 'procedures' });
  if (sop) query.set('sop', sop);
  redirect(`/properties/${id}/staff/handbook?${query.toString()}`);
}
