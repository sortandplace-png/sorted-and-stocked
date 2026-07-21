// THROWAWAY DIAGNOSTIC ROUTE -- verifying the live By Store deploy, deleted
// after use. Same pattern as the earlier (torn-down) debugauthlink route,
// redirecting through /auth/confirm since that's the real, documented,
// already-working flow for admin-generated links.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/site-url';

const NONCE = 'e4f1a8c3-9d2b-4a67-8e15-3c9f6b2d7a41';
const EMAIL = 'racq1020@gmail.com';
const PROPERTY_ID = 'ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a'; // Main

export async function GET(request: Request) {
  if (request.headers.get('x-debug-nonce') !== NONCE) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL,
    options: { redirectTo: `${SITE_URL}/auth/confirm?redirectTo=/properties/${PROPERTY_ID}/shopping-list` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ actionLink: data.properties.action_link });
}
