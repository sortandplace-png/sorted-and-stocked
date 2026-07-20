// app/api/staff/offboard/route.ts
// Full offboarding, distinct from the existing per-property "Remove" on the
// Team page (which only drops one property_members row and leaves the
// person's other-property access untouched). This removes every
// property_members row for the person and disables their auth account --
// per spec, disabled rather than hard-deleted, so historic task_completions
// and other attributed rows keep a real name/email to show instead of
// turning into an orphaned user_id.
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

  // Look up the target's memberships from the admin client (not trusting a
  // client-supplied property list) so the RLS check below the delete is
  // measuring against the real, complete set.
  const { data: targetMemberships } = await admin
    .from('property_members')
    .select('id, property_id, role')
    .eq('user_id', userId);

  if (!targetMemberships || targetMemberships.length === 0) {
    return NextResponse.json({ error: 'This person has no property memberships to remove.' }, { status: 400 });
  }

  // Last-owner protection already exists as a DB trigger on property_members
  // deletes -- deliberately not duplicated here, just let it surface if it
  // fires on any one row.
  const supabaseAsCaller = supabase;
  const { error: deleteError } = await supabaseAsCaller
    .from('property_members')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // RLS silently skips rows the caller isn't owner/manager on rather than
  // erroring -- confirm the delete actually cleared everything before
  // disabling the account. If rows remain, the caller lacked rights on at
  // least one of this person's properties; leave the account active and say
  // so, rather than disabling someone who still has legitimate access
  // through a property this caller doesn't manage.
  const { data: remaining } = await admin.from('property_members').select('property_id').eq('user_id', userId);

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
