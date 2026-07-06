// lib/offline-queue.ts
// Requires: npm install idb-keyval
//
// Writes (toggling a shopping list item, adjusting a qty) are queued locally
// when offline and flushed to Supabase as soon as connectivity returns.
// This is what makes the PWA caching in next.config.js actually useful —
// without this, a "read cached page, write nothing" app just looks broken.

import { get, set, del } from 'idb-keyval';
import type { SupabaseClient } from '@supabase/supabase-js';

const QUEUE_KEY = 'offline-write-queue';

export type QueuedWrite = {
  id: string;              // crypto.randomUUID()
  table: string;
  operation: 'insert' | 'update' | 'delete';
  match?: Record<string, unknown>; // for update/delete
  values?: Record<string, unknown>; // for insert/update
  createdAt: number;
};

export async function enqueueWrite(write: Omit<QueuedWrite, 'id' | 'createdAt'>) {
  const queue: QueuedWrite[] = (await get(QUEUE_KEY)) ?? [];
  queue.push({ ...write, id: crypto.randomUUID(), createdAt: Date.now() });
  await set(QUEUE_KEY, queue);
}

export async function flushQueue(supabase: SupabaseClient) {
  const queue: QueuedWrite[] = (await get(QUEUE_KEY)) ?? [];
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  const remaining: QueuedWrite[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      let query = supabase.from(item.table);
      if (item.operation === 'insert') {
        const { error } = await query.insert(item.values);
        if (error) throw error;
      } else if (item.operation === 'update') {
        let q = query.update(item.values!);
        for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v);
        const { error } = await q;
        if (error) throw error;
      } else if (item.operation === 'delete') {
        let q = query.delete();
        for (const [k, v] of Object.entries(item.match ?? {})) q = q.eq(k, v);
        const { error } = await q;
        if (error) throw error;
      }
      flushed++;
    } catch {
      // Network still down or a real error — keep it queued and retry later.
      remaining.push(item);
    }
  }

  if (remaining.length > 0) {
    await set(QUEUE_KEY, remaining);
  } else {
    await del(QUEUE_KEY);
  }

  return { flushed, failed: remaining.length };
}

// Call this once at app root: flushes on load and whenever the browser
// regains connectivity.
export function registerOfflineSync(supabase: SupabaseClient) {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => flushQueue(supabase));
  flushQueue(supabase);
}
