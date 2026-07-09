// components/DuplicateItemWarning.tsx
// Shown when adding a new inventory item whose name fuzzy-matches something
// that already exists (pg_trgm similarity via find_similar_inventory_items).
// Non-blocking — the goal is catching accidental duplicates like the real
// Asparagus/Chicken Thighs/Poland Spring pairs found in the DB, not stopping
// anyone from adding a genuinely new item that happens to share words.
'use client';

type Match = { id: string; name: string; location_name: string | null; similarity: number };

export default function DuplicateItemWarning({
  enteredName,
  matches,
  onAddAnyway,
  onUpdateExisting,
  onDismiss,
}: {
  enteredName: string;
  matches: Match[];
  onAddAnyway: () => void;
  onUpdateExisting: (matchId: string) => void;
  onDismiss: () => void;
}) {
  const top = matches[0];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-[60] sm:p-4" onClick={onDismiss}>
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-charcoal mb-1">Already have this?</h2>
        <p className="text-sm text-charcoal/60 mb-3">
          You may already have <span className="font-medium text-charcoal">{top.name}</span>
          {top.location_name ? ` in ${top.location_name}` : ''}.
        </p>

        {matches.length > 1 && (
          <ul className="space-y-1 mb-3 text-xs text-charcoal/50">
            {matches.slice(1).map((m) => (
              <li key={m.id}>
                Also similar: {m.name}
                {m.location_name ? ` (${m.location_name})` : ''}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <button
            onClick={() => onUpdateExisting(top.id)}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium"
          >
            Update existing item instead
          </button>
          <button
            onClick={onAddAnyway}
            className="w-full py-2.5 rounded-full border border-gold-light/60 text-charcoal"
          >
            Add &quot;{enteredName}&quot; anyway
          </button>
          <button onClick={onDismiss} className="w-full py-2 text-sm text-charcoal/40">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
