// THROWAWAY DIAGNOSTIC ROUTE -- SS-202 visual verification, deleted after
// use. Generates a real magiclink action_link for Racquel's own existing
// account via the same admin.auth.admin.generateLink() the real invite
// flow already uses (app/api/invite/route.ts) -- not a bypass, the normal
// mechanism for an existing user, just invoked directly instead of via
// email. Nonce is not a real secret, just prevents accidental/drive-by
// triggering during this route's brief live window.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/lib/site-url';

const NONCE = 'b91e4a2c-5f7d-4c3a-8e19-6a2f0d5b8c34';
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
    options: { redirectTo: `${SITE_URL}/properties/${PROPERTY_ID}/staff` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ actionLink: data.properties.action_link });
}
