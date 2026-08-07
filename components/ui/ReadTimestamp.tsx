// components/ui/ReadTimestamp.tsx
// SS-857. One implementation instead of nine near-identical copies. The
// value must come from the SAME server request as the data it describes
// (stamp it right after the page's own data fetch, pass it down) -- a
// timestamp computed anywhere else, including client-side, would read
// "now" on a cached render and hide exactly the defect it exists to
// expose. Same rule and the same "Read {time} ET" phrasing
// RegisterViewerClient.tsx already established for the Register (SS-681);
// this is that pattern generalized rather than reinvented per surface.
const readAtFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

export default function ReadTimestamp({
  readAt,
  className = 'text-[11px] text-dusk',
}: {
  /** ISO timestamp, server-stamped immediately after the page's own read. */
  readAt: string;
  className?: string;
}) {
  return <p className={className}>Read {readAtFormatter.format(new Date(readAt))} ET.</p>;
}
