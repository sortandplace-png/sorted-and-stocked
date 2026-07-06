// lib/rate-limit.ts
// Server-only helper. Call after confirming the user is authenticated and
// authorized, before doing the expensive/costly work (sending an email,
// calling the Anthropic API, etc.) — a rate-limited request should never
// reach that point.
import type { SupabaseClient } from '@supabase/supabase-js';

export async function checkRateLimit(
  supabase: SupabaseClient,
  action: string,
  maxCount: number,
  windowSeconds: number
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const { data, error } = await supabase.rpc('check_and_record_rate_limit', {
    p_action: action,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail closed on unexpected errors rather than silently allowing
    // unlimited requests if the rate-limit check itself breaks.
    return { allowed: false, error: `Rate limit check failed: ${error.message}` };
  }

  if (!data) {
    return {
      allowed: false,
      error: `Too many requests. Please wait before trying again.`,
    };
  }

  return { allowed: true };
}
