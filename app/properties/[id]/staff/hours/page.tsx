// app/properties/[id]/staff/hours/page.tsx
// Hours moved into the Task Center as its own section. "Everyone, by week"
// is a manager question, and that page already carries the owner/manager
// gate the answer needs -- so this route no longer needs its own copy of
// the guard, only the redirect.
//
// Route kept, not deleted (R21): it was in the nav until recently and is
// the kind of page people bookmark.
//
// The #hours fragment lands on the section rather than the top of a long
// roster. Fragments are client-side, so this is a hint rather than a
// guarantee -- but the section carries scroll-mt so it isn't tucked under
// the header when it does apply.
import { redirect } from 'next/navigation';

export default async function StaffHoursRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/properties/${id}/tools/tasks#hours`);
}
