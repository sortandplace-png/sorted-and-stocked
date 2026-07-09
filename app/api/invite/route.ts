// app/api/invite/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const { propertyId, email, role } = await request.json();

  if (!propertyId || !email || !role) {
    return NextResponse.json({ error: 'Missing propertyId, email, or role.' }, { status: 400 });
  }
  if (role !== 'manager' && role !== 'staff') {
    return NextResponse.json({ error: 'Invited role must be manager or staff.' }, { status: 400 });
  }

  // Step 1: authenticate the caller and confirm they're an owner/manager of
  // THIS property, using the normal RLS-respecting server client — never
  // trust the request body's propertyId without this check, since the
  // admin client used below bypasses RLS entirely.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('property_members')
    .select('role')
    .eq('property_id', propertyId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || (membership.role !== 'owner' && membership.role !== 'manager')) {
    return NextResponse.json(
      { error: 'Only an owner or manager can invite people to this property.' },
      { status: 403 }
    );
  }

  // 10 invite emails per hour per user — generous for real household use,
  // tight enough to stop a runaway loop or spam from getting far.
  const rateLimit = await checkRateLimit(supabase, 'invite_email', 10, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: rateLimit.error }, { status: 429 });
  }

  // Step 2: create the auth user + send the invite email. This requires the
  // service-role key, hence the separate admin client.
  const admin = createAdminClient();
  // request.url reflects the internal host when running behind a reverse
  // proxy, not the public-facing domain — prefer the standard forwarded
  // headers when present, falling back to request.url's own origin for
  // local dev / hosts that don't set them.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const origin = forwardedHost ? `${forwardedProto ?? 'https'}://${forwardedHost}` : new URL(request.url).origin;

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?redirectTo=/properties`,
  });

  if (inviteError) {
    // Supabase returns a specific message when the email is already
    // registered — surface that distinctly so the UI can suggest using
    // the regular (already-has-an-account) invite path instead.
    const alreadyExists = /already registered|already exists/i.test(inviteError.message);
    return NextResponse.json(
      {
        error: alreadyExists
          ? 'This email already has an account. Use the regular invite instead.'
          : inviteError.message,
      },
      { status: 400 }
    );
  }

  // Step 3: add them to property_members now — inviteUserByEmail creates
  // the auth.users row immediately (the on_auth_user_created trigger from
  // 001_init_schema.sql fires and creates their profiles row too), even
  // though they haven't accepted the email yet. Use the caller's own
  // RLS-respecting client for this insert — the earlier role check already
  // proved they're allowed to do it, no need for the admin client here.
  const { error: memberError } = await supabase.from('property_members').insert({
    property_id: propertyId,
    user_id: invited.user.id,
    role,
  });

  if (memberError) {
    // The auth user + profile row already exist at this point (created by
    // inviteUserByEmail above) — without cleanup, a failed membership
    // insert would leave a stranded account with no way to sign into any
    // property. Best-effort: report the original error either way.
    await admin.auth.admin.deleteUser(invited.user.id).catch(() => {});
    return NextResponse.json({ error: memberError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'invited', userId: invited.user.id });
}
