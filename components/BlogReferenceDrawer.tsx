// components/BlogReferenceDrawer.tsx
// The Reference drawer on the Blog Drafts tab. A DRAWER, not a route and
// not a nav entry: same ruling as SS-667, which put Drafts on a tab rather
// than giving it a page of its own.
//
// ROWS NOT CODE, and that is the whole point of this component. Every
// section reads its table live. Nothing here hardcodes a rule, a design
// decision or a prompt. When a rule changes, the ROW changes and this
// drawer says something different on the next open. A rule copied into
// this file would be the thing that goes stale, which is exactly how four
// fictional printables reached a live page.
//
// READ ONLY this pass. No editing, no writes, no optimistic state.
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type BlogRule = { section: string; rule_key: string; rule_text: string; sort_order: number };
type DesignRule = {
  id: string;
  rule: string;
  detail: string | null;
  category: string | null;
  superseded_by: string | null;
};
type ContentPrompt = {
  id: string;
  target_slug: string | null;
  sequence: number | null;
  prompt_text: string;
  placement: string | null;
  aspect: string | null;
  status: string | null;
};

type Tab = 'rules' | 'design' | 'prompts';

function groupBy<T>(rows: T[], key: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard is unavailable on an insecure origin. Say so rather
          // than showing a success state for something that did not happen.
          setCopied(false);
        }
      }}
      className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-brass border border-cardBorder rounded-full px-2.5 py-1 hover:border-brass transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function BlogReferenceDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('rules');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blogRules, setBlogRules] = useState<BlogRule[]>([]);
  const [designRules, setDesignRules] = useState<DesignRule[]>([]);
  const [prompts, setPrompts] = useState<ContentPrompt[]>([]);

  // Fetched on OPEN, not on mount: the drawer is a reference someone
  // reaches for occasionally, and three table reads on every Drafts render
  // would be three reads nobody asked for.
  //
  // SS-787, second cause. `loading` was in this effect's own dependency
  // array. setLoading(true) below is synchronous and fires before the
  // first await, so it retriggers THIS effect on the next render -- and
  // React runs the previous invocation's cleanup first, which sets
  // `cancelled = true` on the closure the still-in-flight fetch is about
  // to check. Every branch below (success, the 15s timeout, and the
  // catch) starts with `if (cancelled) return`, so the fetch's own
  // state-setting effect had already cancelled itself: the request
  // completed (or the timeout fired) but the result was silently
  // discarded, loading was never set back to false, and no error ever
  // rendered. `loading` stays in the guard below as a defensive re-entry
  // check; it must not be a dependency, or the effect re-cancels itself
  // every time it runs.
  useEffect(() => {
    if (!open || loading || blogRules.length || designRules.length || prompts.length) return;
    let cancelled = false;
    // SS-787. The drawer used to hang on "Loading." forever with no error,
    // even though the code below already had a real error state. The gap
    // was never a missing error UI -- it was that nothing guaranteed this
    // async block ever REACHED that UI. There was no try/catch around the
    // fetch: a thrown exception (a dropped connection, anything the
    // Postgrest client doesn't itself convert into a returned {error})
    // rejected this IIFE unhandled, so setLoading(false) never ran and the
    // existing error path never got a chance to fire. And a request that
    // truly never settles (hangs at the network layer rather than
    // rejecting) would never trip Promise.all at all, error or not.
    //
    // Two independent fixes, because they cover two different failures:
    // the try/catch/finally catches a THROW; the timeout race catches a
    // request that neither resolves nor rejects.
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15000));
      try {
        const result = await Promise.race([
          Promise.all([
            supabase
              .from('blog_rules')
              .select('section, rule_key, rule_text, sort_order')
              .eq('active', true)
              .order('section')
              .order('sort_order'),
            // Superseded rows are ORDERED IN, not filtered out: R21 says
            // never delete a row, supersede it, and hiding a superseded
            // rule would lose the record of what it replaced.
            supabase
              .from('design_rules')
              .select('id, rule, detail, category, superseded_by')
              .order('category')
              .order('rule'),
            supabase
              .from('content_prompts')
              .select('id, target_slug, sequence, prompt_text, placement, aspect, status')
              .eq('scope', 'blog_post')
              .eq('active', true)
              .order('target_slug')
              .order('sequence'),
          ]),
          timeout,
        ]);
        if (cancelled) return;
        if (result === 'timeout') {
          setError('Timed out waiting for the reference tables. Check your connection and try again.');
          return;
        }
        const [r, d, p] = result;
        // A read failure must LOOK like a failure. An empty drawer that
        // silently means "permission denied" reads as "there are no rules".
        const failed = [r.error, d.error, p.error].filter(Boolean);
        if (failed.length) setError(failed.map((e) => e!.message).join('; '));
        setBlogRules((r.data as BlogRule[]) ?? []);
        setDesignRules((d.data as DesignRule[]) ?? []);
        setPrompts((p.data as ContentPrompt[]) ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not read the reference tables.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, blogRules.length, designRules.length, prompts.length]);

  // Escape closes, which is the one keyboard affordance a drawer must have.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'rules', label: 'Rules', count: blogRules.length },
    { key: 'design', label: 'Design', count: designRules.length },
    { key: 'prompts', label: 'Prompts', count: prompts.length },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold uppercase tracking-[0.12em] text-denim border border-cardBorder rounded-full px-3 py-1.5 hover:border-brass hover:text-brass transition-colors"
      >
        Reference
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Blog reference">
          <button
            aria-label="Close reference"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-denim/30"
          />
          <div className="relative h-full w-full max-w-[560px] bg-linen border-l border-cardBorder shadow-card overflow-y-auto">
            <div className="sticky top-0 bg-linen border-b border-cardBorder px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-[20px] text-denim">Reference</p>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dusk hover:text-denim"
                >
                  Close
                </button>
              </div>
              <p className="text-[11px] text-dusk mt-1">
                Read only. Every section reads its table live: change the row, never the component.
              </p>
              <div className="flex items-center gap-1 bg-mist rounded-full p-1 w-fit mt-3">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                      tab === t.key ? 'bg-denim text-white' : 'text-dusk'
                    }`}
                  >
                    {t.label}
                    {t.count > 0 && <span className="ml-1.5 opacity-70">{t.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 space-y-6">
              {loading && <p className="text-[13px] text-dusk">Loading.</p>}
              {error && (
                <p className="text-[13px] text-rust">
                  Could not read the reference tables: {error}
                </p>
              )}

              {!loading && tab === 'rules' &&
                groupBy(blogRules, (r) => r.section).map(([section, rows]) => (
                  <div key={section}>
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brass mb-2">
                      {section}
                    </p>
                    <ul className="space-y-2.5">
                      {rows.map((r) => (
                        <li key={r.rule_key} className="bg-card border border-cardBorder rounded-xl2 px-4 py-3">
                          <p className="text-[11px] font-mono text-dusk mb-1">{r.rule_key}</p>
                          <p className="text-[13px] text-denim leading-relaxed">{r.rule_text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

              {!loading && tab === 'design' &&
                groupBy(designRules, (r) => r.category ?? 'Uncategorised').map(([cat, rows]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brass mb-2">{cat}</p>
                    <ul className="space-y-2.5">
                      {rows.map((r) => {
                        // Struck through, NEVER hidden. R21: never delete a
                        // row, supersede it. A hidden superseded rule loses
                        // the record of what replaced it.
                        const dead = Boolean(r.superseded_by);
                        return (
                          <li
                            key={r.id}
                            className={`bg-card border border-cardBorder rounded-xl2 px-4 py-3 ${dead ? 'opacity-60' : ''}`}
                          >
                            <p className={`text-[13px] text-denim leading-relaxed ${dead ? 'line-through' : ''}`}>
                              {r.rule}
                            </p>
                            {r.detail && (
                              <p className={`text-[12px] text-dusk leading-relaxed mt-1 ${dead ? 'line-through' : ''}`}>
                                {r.detail}
                              </p>
                            )}
                            {dead && (
                              <p className="text-[10px] uppercase tracking-[0.12em] text-rust mt-1.5">
                                Superseded by {r.superseded_by}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

              {!loading && tab === 'prompts' &&
                groupBy(prompts, (p) => p.target_slug ?? 'Unassigned').map(([slug, rows]) => (
                  <div key={slug}>
                    <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brass mb-2">{slug}</p>
                    <ul className="space-y-2.5">
                      {rows.map((p) => (
                        <li key={p.id} className="bg-card border border-cardBorder rounded-xl2 px-4 py-3">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <p className="text-[11px] text-dusk">
                              {p.sequence !== null && <span className="font-mono">#{p.sequence}</span>}
                              {p.placement && <span className="ml-2">{p.placement}</span>}
                              {p.aspect && <span className="ml-2">{p.aspect}</span>}
                              {p.status && <span className="ml-2 uppercase tracking-[0.1em]">{p.status}</span>}
                            </p>
                            <CopyButton text={p.prompt_text} />
                          </div>
                          <p className="text-[12px] text-denim leading-relaxed whitespace-pre-line">
                            {p.prompt_text}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

              {!loading && !error && (
                (tab === 'rules' && blogRules.length === 0) ||
                (tab === 'design' && designRules.length === 0) ||
                (tab === 'prompts' && prompts.length === 0)
              ) && <p className="text-[13px] text-dusk">No rows in that table yet.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
