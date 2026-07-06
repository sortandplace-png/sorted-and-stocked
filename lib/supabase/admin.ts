// lib/supabase/admin.ts
// SERVER-ONLY. Never import this from a 'use client' component or a file
// that gets bundled into client JS — SUPABASE_SERVICE_ROLE_KEY bypasses RLS
// entirely and must never reach the browser. Only use inside Route Handlers,
// Server Actions, or other server-only code (e.g. app/api/invite/route.ts).
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // server-only env var, NOT prefixed with NEXT_PUBLIC_
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
