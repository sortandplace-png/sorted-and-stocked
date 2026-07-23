// app/api/invite/resend/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/site-url';

// For an already-invited-but-not-yet-accepted user — property_members
// already has their row (created at original invite time), so this only
// re-sends the email via Supabase auth, it doesn't touch property_members.
export async function POST(request: Request) {
  const { propertyId, userId } = await request.json();
  if (!propertyId || !userId) {
    return NextResponse.json({ error: 'Missing propertyId or userId.' }, { status: 400 });
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
    return NextResponse.json({ error: 'Only an owner or manager can resend invites.' }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(supabase, 'invite_email', 10, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!authUser?.user?.email) {
    return NextResponse.json({ error: 'Could not find that invite.' }, { status: 404 });
  }

  // SITE_URL, not the request's own host -- same reasoning as app/api/
  // invite/route.ts: the recipient's browser has nothing to do with
  // whichever machine happened to call this route. /auth/confirm + a
  // /reset-password destination for the same reason as the original
  // invite route -- inviteUserByEmail doesn't use PKCE either, and a
  // resent invite still needs a real password set, not a placeholder one.
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(authUser.user.email, {
    redirectTo: `${SITE_URL}/auth/confirm?redirectTo=/reset-password`,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'resent' });
}
