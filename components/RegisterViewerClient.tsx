// components/RegisterViewerClient.tsx
// SS-457: the live register viewer body. Layout follows the delivered
// REGISTER-LIVE-VIEWER spec: six tappable stat tiles (Total / Open /
// Partial / Resolved / Superseded / Parked), the honesty row
// (verified-live count + %, lost prompts, touched today, open split by
// owner), then filters (status chips · evidence dots · owner) + search,
// then the full table. Concept B tokens, Cormorant (font-display)
// numerals in denim (D-01: brass is never display type), pin dots on
// the tiles -- SS-455 is Racquel's direct ruling that the pins STAY;
// SS-453 is ignored on her instruction.
//
// English-only on purpose: this is an operator surface behind the
// operator-console gate; staff never see it (same convention as the
// SS-436 console).
'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Pin from '@/components/ui/Pin';

export type WorkItemRow = {
  id: string;
  title: string | null;
  detail: string | null;
  status: string;
  evidence: string | null;
  owner: string | null;
  sent_to_code_at: string | null;
  code_reported_at: string | null;
  verified_at: string | null;
  verified_how: string | null;
  screenshot_ref: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string | null;
};

const STATUSES = ['open', 'partial', 'resolved', 'superseded', 'parked'] as const;

const STATUS_PILL: Record<string, string> = {
  open: 'border-rust/60 text-rust',
  partial: 'border-brass text-denim',
  resolved: 'border-denim/40 text-denim',
  superseded: 'border-cardBorder text-denim/50',
  parked: 'border-cardBorder text-denim/60',
};

// The register's own evidence-tier vocabulary, dots included.
const EVIDENCE: { key: string; dot: string; label: string }[] = [
  { key: 'verified_live', dot: '🟢', label: 'Verified live' },
  { key: 'claimed', dot: '🟡', label: 'Claimed' },
  { key: 'schema_confirmed', dot: '🔵', label: 'Schema' },
  { key: 'inference', dot: '⚪', label: 'Inference' },
];
const EVIDENCE_DOT: Record<string, string> = Object.fromEntries(EVIDENCE.map((e) => [e.key, e.dot]));

/** SS-100 sorts after SS-99: numeric on the suffix, never lexicographic. */
function idNum(id: string): number {
  return parseInt(id.replace(/\D/g, ''), 10) || 0;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// SS-681. The register is kept on Eastern time because the person who
// polices it works on Eastern time, and "today" is a question about her
// day, not about UTC's.
//
// THE BUG THIS REPLACES: touchedToday compared row dates against
// new Date().toISOString().slice(0,10), which is the UTC date. From 8pm
// Eastern (00:00 UTC) the UTC date rolls to tomorrow, so every row touched
// during the working day stopped matching and the number read 0 all
// evening. It was not an off-by-one, it was the count silently emptying at
// the same time every night.
//
// en-CA is not cosmetic: it is the locale that formats as YYYY-MM-DD, so
// these strings sort and compare correctly.
const EASTERN = 'America/New_York';
const easternDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: EASTERN,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in New York for a given instant, as YYYY-MM-DD. */
function easternDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return easternDayFormatter.format(d);
}

const readAtFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EASTERN,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default function RegisterViewerClient({
  rows,
  readAt,
}: {
  rows: WorkItemRow[];
  /** Server read time (SS-681). Stale if this render came from a cache. */
  readAt: string;
}) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [evidenceFilter, setEvidenceFilter] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // id DESC (2 Aug directive): newest findings first -- the register is
  // read from a phone to see what just happened, not from SS-001 up.
  const sorted = useMemo(() => [...rows].sort((a, b) => idNum(b.id) - idNum(a.id)), [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length };
    for (const s of STATUSES) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  // The honesty row: the numbers Racquel actually polices the register by.
  const honesty = useMemo(() => {
    // Measured against the READ time, not the browser clock, so every
    // number in this row answers "as of when the table was read" and the
    // timestamp shown beside them is the answer to "when was that".
    const today = easternDay(readAt);
    const verifiedLive = rows.filter((r) => r.evidence === 'verified_live').length;
    // SS-629: this line used to compute ONE number and label it "lost
    // prompts", which read as "fourteen things adrift this minute" while
    // v_lost_prompts returned zero rows at the same moment. Both counts
    // were right; they answered different questions. The view applies a
    // status filter (what is adrift NOW); this banner omitted it (what
    // Code has never acknowledged, EVER). Now both are computed with the
    // view's exact predicate for the live figure, and labelled so the
    // page and the view can never give two answers to one number again.
    const adriftNow = rows.filter(
      (r) =>
        r.sent_to_code_at &&
        !r.code_reported_at &&
        !['resolved', 'superseded', 'parked'].includes(r.status)
    ).length;
    const neverAcknowledged = rows.filter((r) => r.sent_to_code_at && !r.code_reported_at).length;
    const everSent = rows.filter((r) => r.sent_to_code_at).length;
    // Each row's timestamp is converted to its EASTERN calendar date too.
    // Comparing a UTC-sliced row date against an Eastern boundary would
    // just move the off-by-one rather than remove it: both sides of the
    // comparison have to be in the same zone.
    const touchedToday = rows.filter(
      (r) => easternDay(r.updated_at ?? r.created_at) === today
    ).length;
    const openByOwner = new Map<string, number>();
    for (const r of rows) {
      if (r.status !== 'open') continue;
      const o = r.owner ?? '—';
      openByOwner.set(o, (openByOwner.get(o) ?? 0) + 1);
    }
    return {
      verifiedLive,
      verifiedPct: rows.length ? Math.round((verifiedLive / rows.length) * 100) : 0,
      adriftNow,
      neverAcknowledged,
      everSent,
      touchedToday,
      openByOwner: [...openByOwner.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const owners = useMemo(
    () => [...new Set(rows.map((r) => r.owner).filter((o): o is string => !!o))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (evidenceFilter && r.evidence !== evidenceFilter) return false;
      if (ownerFilter && r.owner !== ownerFilter) return false;
      if (q && !`${r.id} ${r.title ?? ''} ${r.detail ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, statusFilter, evidenceFilter, ownerFilter, search]);

  const tiles: { key: string | null; label: string; count: number }[] = [
    { key: null, label: 'Total', count: counts.total },
    ...STATUSES.map((s) => ({ key: s as string, label: s.charAt(0).toUpperCase() + s.slice(1), count: counts[s] ?? 0 })),
  ];

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs font-medium transition ${
      active ? 'bg-denim text-white border-denim shadow-sm' : 'bg-card text-denim/70 border-cardBorder hover:bg-mist'
    }`;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      <h1 className="font-display text-3xl text-denim mb-1">Register</h1>
      {/* SS-681. The claim and the proof now sit together. This subtitle
          promised "read on every load" while the page was being served
          from a cache showing 629 rows against a table holding 637, and
          listing SS-670 and SS-671 as open after both were resolved. The
          sentence could not be checked, so it was believed.
          The timestamp is the server's read time, rendered into the HTML.
          If this document is ever cached again, this clock is cached with
          it and visibly falls behind. */}
      <p className="text-[13px] text-denim/70 mb-5">
        Live from work_items, {counts.total} rows. The table is the truth.{' '}
        <span className="text-denim/50">
          Read {readAtFormatter.format(new Date(readAt))} ET.
        </span>
      </p>

      {/* Six tappable stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {tiles.map((tile) => {
          const active = statusFilter === tile.key || (tile.key === null && statusFilter === null);
          return (
            <button
              key={tile.label}
              onClick={() => setStatusFilter(tile.key)}
              aria-pressed={active}
              className={`relative bg-card rounded-xl2 border shadow-card p-4 pr-7 text-left transition hover:shadow-cardHover ${
                active ? 'border-denim ring-1 ring-denim/40' : 'border-cardBorder'
              }`}
            >
              <Pin size="sm" />
              <p className="text-[9px] font-semibold tracking-[0.14em] uppercase text-brass">{tile.label}</p>
              <p className="font-display text-[30px] leading-tight text-denim tabular-nums">{tile.count}</p>
            </button>
          );
        })}
      </div>

      {/* The honesty row */}
      <div className="bg-mist rounded-xl2 border border-brass/30 px-[18px] py-[14px] mb-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-denim">
        <span>
          <span className="font-semibold tabular-nums">🟢 {honesty.verifiedLive}</span> verified live (
          {honesty.verifiedPct}%)
        </span>
        <span>
          <span className="font-semibold tabular-nums">{honesty.adriftNow}</span> adrift now
          <span className="text-denim/60"> (sent to Code, no report, still open)</span>
        </span>
        <span className="text-denim/70">
          <span className="font-semibold tabular-nums">{honesty.neverAcknowledged}</span> never acknowledged
          <span className="text-denim/60">
            {' '}
            of {honesty.everSent} ever sent, all since closed
          </span>
        </span>
        <span>
          <span className="font-semibold tabular-nums">{honesty.touchedToday}</span> touched today
        </span>
        <span>
          open:{' '}
          {honesty.openByOwner.map(([owner, n], i) => (
            <span key={owner}>
              {i > 0 && ' · '}
              {owner} <span className="font-semibold tabular-nums">{n}</span>
            </span>
          ))}
        </span>
      </div>

      {/* Filters + search */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? null : s)} className={chipClass(statusFilter === s)}>
              {s}
            </button>
          ))}
          <span className="w-px h-5 bg-cardBorder mx-1" aria-hidden="true" />
          {EVIDENCE.map((e) => (
            <button
              key={e.key}
              onClick={() => setEvidenceFilter(evidenceFilter === e.key ? null : e.key)}
              className={chipClass(evidenceFilter === e.key)}
              title={e.label}
            >
              {e.dot} {e.label}
            </button>
          ))}
          <span className="w-px h-5 bg-cardBorder mx-1" aria-hidden="true" />
          {owners.map((o) => (
            <button key={o} onClick={() => setOwnerFilter(ownerFilter === o ? null : o)} className={chipClass(ownerFilter === o)}>
              {o}
            </button>
          ))}
        </div>
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-denim/50" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search id, title, detail…"
            className="w-full bg-mist border border-brass/30 rounded-xl2 pl-9 pr-4 py-3 text-sm text-denim placeholder:text-denim/50 focus:outline-none focus:ring-1 focus:ring-denim/40"
          />
        </div>
      </div>

      {/* Mobile-first card list (2 Aug directive: Racquel reads this from
          her phone) -- one card per row, tap to expand the same detail
          block the table shows. The table below stays for md+ screens;
          a five-column table squeezed into a phone was the thing this
          replaces, not a layout worth shrinking. */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-denim/60 text-sm bg-card rounded-xl2 border border-cardBorder">
            Nothing matches these filters.
          </p>
        )}
        {filtered.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} className="bg-card rounded-xl2 border border-cardBorder shadow-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : r.id)}
                aria-expanded={expanded}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-display text-[15px] text-denim tabular-nums">{r.id}</span>
                  <span
                    className={`inline-block border rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      STATUS_PILL[r.status] ?? 'border-cardBorder text-denim/60'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span title={r.evidence ?? undefined}>{EVIDENCE_DOT[r.evidence ?? ''] ?? '·'}</span>
                  <span className="text-[11px] text-denim/70">{r.owner ?? '—'}</span>
                  {(r.updated_at ?? r.created_at) && (
                    <span className="text-[11px] text-denim/60 ml-auto">{fmtDate(r.updated_at ?? r.created_at)}</span>
                  )}
                </div>
                <p className={`text-[13px] leading-snug ${r.status === 'superseded' ? 'text-denim/50' : 'text-denim'}`}>
                  {r.title}
                </p>
              </button>
              {expanded && (
                <div className="border-t border-cardBorder/60 bg-mist/60 px-4 py-3">
                  {r.detail && (
                    <p className="text-[13px] text-denim leading-relaxed whitespace-pre-wrap mb-2">{r.detail}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-denim/70">
                    {r.verified_how && <span>verified: {r.verified_how}</span>}
                    {r.superseded_by && <span>superseded by {r.superseded_by}</span>}
                    {r.updated_at && <span>updated {fmtDate(r.updated_at)}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The full table (md+) */}
      <div className="hidden md:block bg-card rounded-xl3 border border-cardBorder shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              {/* Column names per Racquel (3 Aug late), grounded in SS-602:
                  evidence and status are INDEPENDENT axes -- a green dot
                  beside a red pill is a proven finding whose work is not
                  done, not a contradiction. "Finding" = was it proven;
                  "Work" = is it finished. Data unchanged, labels only. */}
              <tr className="bg-denim text-white text-[10px] font-semibold tracking-[0.14em] uppercase">
                <th className="py-[11px] pl-5 pr-3">ID</th>
                <th className="py-[11px] px-3">Work</th>
                <th className="py-[11px] px-3">Finding</th>
                <th className="py-[11px] px-3">Owner</th>
                <th className="py-[11px] px-3 pr-5 w-full">Title</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-denim/60">
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const expanded = expandedId === r.id;
                return (
                  <RowPair
                    key={r.id}
                    row={r}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : r.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-denim/60 mt-2 tabular-nums">
        {filtered.length} of {counts.total} rows
      </p>
    </div>
  );
}

function RowPair({ row, expanded, onToggle }: { row: WorkItemRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={expanded}
        className={`border-t border-cardBorder cursor-pointer transition-colors ${expanded ? 'bg-mist' : 'hover:bg-linen'}`}
      >
        <td className="py-2.5 pl-5 pr-3 font-display text-[15px] text-denim whitespace-nowrap tabular-nums">{row.id}</td>
        <td className="py-2.5 px-3">
          <span className={`inline-block border rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_PILL[row.status] ?? 'border-cardBorder text-denim/60'}`}>
            {row.status}
          </span>
        </td>
        <td className="py-2.5 px-3" title={row.evidence ?? undefined}>
          {EVIDENCE_DOT[row.evidence ?? ''] ?? '·'}
        </td>
        <td className="py-2.5 px-3 text-denim/80 whitespace-nowrap">{row.owner ?? '—'}</td>
        <td className={`py-2.5 px-3 pr-5 text-denim ${row.status === 'superseded' ? 'text-denim/50' : ''}`}>{row.title}</td>
      </tr>
      {expanded && (
        <tr className="border-t border-cardBorder/60 bg-mist/60">
          <td colSpan={5} className="py-3 pl-5 pr-5">
            {row.detail && <p className="text-[13px] text-denim leading-relaxed whitespace-pre-wrap mb-2">{row.detail}</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-denim/70">
              {row.verified_how && <span>verified: {row.verified_how}</span>}
              {row.screenshot_ref && <span>screenshot: {row.screenshot_ref}</span>}
              {row.superseded_by && <span>superseded by {row.superseded_by}</span>}
              {row.sent_to_code_at && <span>sent to Code {fmtDate(row.sent_to_code_at)}</span>}
              {row.code_reported_at ? (
                <span>Code reported {fmtDate(row.code_reported_at)}</span>
              ) : (
                row.sent_to_code_at && <span className="text-rust">no Code report</span>
              )}
              {row.verified_at && <span>verified {fmtDate(row.verified_at)}</span>}
              <span>updated {fmtDate(row.updated_at ?? row.created_at)}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
