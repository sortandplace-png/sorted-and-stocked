// app/properties/[id]/tools/sops/page.tsx
// The SOP Library moved to /staff/sops -- a housekeeper does not go to Tools.
// This stub stays so bookmarks and any link already sent out keep working; a
// dead URL has burned the owner here before.
import { redirect } from 'next/navigation';

export default async function ToolsSopsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Straight to the destination, not through /staff/sops -- that route is now
  // itself a redirect, and chaining two of them is a hop nobody needs.
  redirect(`/properties/${id}/staff/handbook?tab=procedures`);
}
