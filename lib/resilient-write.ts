// lib/resilient-write.ts
//
// The offline queue (lib/offline-queue.ts) is useless if components call
// supabase.from(...).update(...) directly — a failed write just throws and
// the UI shows an error, it doesn't queue. This wrapper is the missing
// connective tissue: every write in the app should go through here.
//
// Behavior:
//   - If the browser is offline, skip the network call entirely and queue.
//   - If the browser is online but the request fails (timeout, dropped
//     connection mid-request — common in a basement/pantry), queue it too.
//   - Either way, the caller gets an optimistic "ok" back immediately so
//     the UI can update right away; the queue reconciles with the server
//     once connectivity returns (see registerOfflineSync).

import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueWrite } from './offline-queue';

type WriteResult = { ok: true; queued: boolean; error?: never } | { ok: false; queued: false; error: string };

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Every error used to get queued for retry forever, including permanent
// ones (RLS denial, a bad constraint, a validation failure) that will never
// succeed no matter how many times the queue retries them — the caller
// never learned the write actually failed. A genuine Postgrest/Postgres
// error always carries a `code`; a network-level failure (dropped
// connection, DNS hiccup — the actual case this queue exists for) doesn't,
// and its message says so.
function isTransientError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code) return false;
  return /fetch|network|timeout|timed out|connection/i.test(error.message ?? '');
}

export async function resilientInsert(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown>
): Promise<WriteResult> {
  if (isOffline()) {
    await enqueueWrite({ table, operation: 'insert', values });
    return { ok: true, queued: true };
  }
  const { error } = await supabase.from(table).insert(values);
  if (error) {
    if (isTransientError(error)) {
      await enqueueWrite({ table, operation: 'insert', values });
      return { ok: true, queued: true };
    }
    return { ok: false, queued: false, error: error.message };
  }
  return { ok: true, queued: false };
}

export async function resilientUpdate(
  supabase: SupabaseClient,
  table: string,
  match: Record<string, unknown>,
  values: Record<string, unknown>
): Promise<WriteResult> {
  if (isOffline()) {
    await enqueueWrite({ table, operation: 'update', match, values });
    return { ok: true, queued: true };
  }
  let query = supabase.from(table).update(values);
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
  const { error } = await query;
  if (error) {
    if (isTransientError(error)) {
      await enqueueWrite({ table, operation: 'update', match, values });
      return { ok: true, queued: true };
    }
    return { ok: false, queued: false, error: error.message };
  }
  return { ok: true, queued: false };
}

export async function resilientDelete(
  supabase: SupabaseClient,
  table: string,
  match: Record<string, unknown>
): Promise<WriteResult> {
  if (isOffline()) {
    await enqueueWrite({ table, operation: 'delete', match });
    return { ok: true, queued: true };
  }
  let query = supabase.from(table).delete();
  for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
  const { error } = await query;
  if (error) {
    if (isTransientError(error)) {
      await enqueueWrite({ table, operation: 'delete', match });
      return { ok: true, queued: true };
    }
    return { ok: false, queued: false, error: error.message };
  }
  return { ok: true, queued: false };
}
