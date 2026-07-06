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
    await enqueueWrite({ table, operation: 'insert', values });
    return { ok: true, queued: true };
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
    await enqueueWrite({ table, operation: 'update', match, values });
    return { ok: true, queued: true };
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
    await enqueueWrite({ table, operation: 'delete', match });
    return { ok: true, queued: true };
  }
  return { ok: true, queued: false };
}
