// app/api/staff/offboard/route.ts
// Full offboarding, distinct from the existing per-property "Remove" on the
// Team page (which only deactivates one property_members row and leaves the
// person's other-property access untouched). This deactivates every
// property_members row for the person and disables their auth account.
//
// SS-627: this used to DELETE every property_members row -- R21 says never
// delete, and task_assignments.member_id was ON DELETE CASCADE, so a "full"
// offboard was silently destroying the person's real assignment history on
// every property at once, not just revoking access. Deactivating
// (active=false, migration 236) instead means RLS (is_property_member/
// has_property_role) blocks all access the instant the row lands, exactly
// like a delete would have, but the row -- and every real completion,
// assignment and activity entry attached to it -- survives.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Supabase has no direct "disabled" flag on auth.users; an effectively
// permanent ban (Supabase's own documented convention for this) is the real
// mechanism -- there's no literal "forever" value the API accepts.
const PERMANENT_BAN = '876000h';

export async function POST(request: Request) {
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'Missing userId.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (userId === user.id) {
    return NextResponse.json({ error: "You can't offboard your own account." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up the target's ACTIVE memberships from the admin client (not
  // trusting a client-supplied property list) so the RLS check below is
  // measuring against the real, complete set. Inactive rows from an
  // earlier removal aren't "still memberships to remove."
  const { data: targetMemberships } = await admin
    .from('property_members')
    .select('id, property_id, role')
    .eq('user_id', userId)
    .eq('active', true);

  if (!targetMemberships || targetMemberships.length === 0) {
    return NextResponse.json({ error: 'This person has no property memberships to remove.' }, { status: 400 });
  }

  // SS-627: deactivate, not delete (migration 236) -- R21, and
  // task_assignments.member_id was ON DELETE CASCADE, so the old DELETE
  // here silently took this person's real assignment history down with it
  // on every property at once. Last-owner protection already exists as a
  // DB trigger on property_members updates (extended in 236 to also cover
  // active flipping to false) -- deliberately not duplicated here, just
  // let it surface if it fires on any one row.
  const supabaseAsCaller = supabase;
  const { error: deleteError } = await supabaseAsCaller
    .from('property_members')
    .update({ active: false })
    .eq('user_id', userId)
    .eq('active', true);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // RLS silently skips rows the caller isn't owner/manager on rather than
  // erroring -- confirm the update actually cleared everything before
  // disabling the account. If ACTIVE rows remain, the caller lacked rights
  // on at least one of this person's properties; leave the account active
  // and say so, rather than disabling someone who still has legitimate
  // access through a property this caller doesn't manage. (Inactive rows
  // now persist forever per R21, so this must check active specifically --
  // a row existing is no longer evidence the removal failed.)
  const { data: remaining } = await admin
    .from('property_members')
    .select('property_id')
    .eq('user_id', userId)
    .eq('active', true);

  if (remaining && remaining.length > 0) {
    return NextResponse.json(
      {
        error:
          "Removed from the properties you manage, but this person still belongs to at least one property you don't manage -- their account was left active.",
        partial: true,
      },
      { status: 207 }
    );
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN });
  if (banError) {
    return NextResponse.json(
      { error: `Removed from all properties, but disabling the account failed: ${banError.message}`, partial: true },
      { status: 207 }
    );
  }

  return NextResponse.json({ status: 'offboarded', propertiesRemoved: targetMemberships.map((m) => m.property_id) });
}
