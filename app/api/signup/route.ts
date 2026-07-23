// app/api/signup/route.ts
// Invite-code-gated self-service signup. The code check happens here,
// server-side, before admin.auth.admin.createUser() runs -- that's what
// makes the gate real regardless of whether Supabase's own public
// signUp() is enabled (Racquel still needs to disable "Allow new users to
// sign up" in Auth settings for the gate to be airtight against someone
// calling supabase.auth.signUp() directly with the public anon key -- a
// dashboard-only toggle, no tool access to flip it here).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const { code, email, password, householdName } = await request.json();

  if (!code || !email || !password || !householdName) {
    return NextResponse.json({ error: 'Missing code, email, password, or household name.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // No per-request rate limit here -- check_and_record_rate_limit (used
  // everywhere else) requires a real auth.uid(), which doesn't exist yet
  // at this pre-account-creation point. Codes are long, random, single-use
  // strings (see the generation note in migration 079), so brute-forcing
  // one before its real owner redeems it isn't practical without one.
  const { data: signupCode } = await admin
    .from('signup_codes')
    .select('id, used_by')
    .eq('code', code.trim())
    .maybeSingle();

  if (!signupCode) {
    return NextResponse.json({ error: 'Invalid signup code.' }, { status: 400 });
  }
  if (signupCode.used_by) {
    return NextResponse.json({ error: 'This signup code has already been used.' }, { status: 400 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const alreadyExists = /already registered|already exists/i.test(createError.message);
    return NextResponse.json(
      { error: alreadyExists ? 'This email already has an account. Try signing in instead.' : createError.message },
      { status: 400 }
    );
  }

  const newUserId = created.user.id;

  // Mark the code used immediately -- if anything below fails, the
  // account already exists and the code is correctly burned rather than
  // reusable, matching the invite flow's own "account already created,
  // cleanup is best-effort" precedent (app/api/invite/route.ts).
  await admin
    .from('signup_codes')
    .update({ used_by: newUserId, used_at: new Date().toISOString() })
    .eq('id', signupCode.id);

  const { data: household, error: householdError } = await admin
    .from('households')
    .insert({ name: householdName.trim(), created_by: newUserId })
    .select('id')
    .single();

  if (householdError) {
    return NextResponse.json({ error: householdError.message }, { status: 400 });
  }

  // property_members' owner row is created automatically by the existing
  // trg_property_created trigger (003_auto_owner_membership.sql) -- no
  // separate insert needed here, same as NewPropertyForm.tsx.
  const { error: propertyError } = await admin
    .from('properties')
    .insert({ name: 'Main', household_id: household.id, created_by: newUserId });

  if (propertyError) {
    return NextResponse.json({ error: propertyError.message }, { status: 400 });
  }

  return NextResponse.json({ status: 'created' });
}
