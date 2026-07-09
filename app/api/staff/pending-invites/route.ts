// app/api/staff/pending-invites route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// "Pending" isn't a stored state anywhere — inviteUserByEmail creates the
// real auth.users + property_members rows immediately (see
// app/api/invite/route.ts), before the person has actually accepted. The
// only real signal for "invited but never signed in" is auth.users'
// last_sign_in_at, which isn't queryable from the client — hence a
// dedicated admin-privileged route instead of a plain client-side query.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');
  if (!propertyId) {
    return NextResponse.json({ error: 'Missing propertyId.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json({ error: 'Only an owner or manager can view pending invites.' }, { status: 403 });
  }

  const { data: members } = await supabase
    .from('property_members')
    .select('user_id, role, joined_at')
    .eq('property_id', propertyId);

  if (!members || members.length === 0) {
    return NextResponse.json({ pending: [] });
  }

  const admin = createAdminClient();
  const pending: { userId: string; email: string; role: string; invitedAt: string }[] = [];

  // No bulk "get users by id list" exists in the admin API — this is
  // fine at real household-membership scale (single digits), not something
  // that needs to hold up at thousands of rows.
  for (const m of members) {
    const { data: authUser } = await admin.auth.admin.getUserById(m.user_id);
    if (authUser?.user && !authUser.user.last_sign_in_at) {
      pending.push({
        userId: m.user_id,
        email: authUser.user.email ?? '(no email on file)',
        role: m.role,
        invitedAt: m.joined_at,
      });
    }
  }

  return NextResponse.json({ pending });
}
