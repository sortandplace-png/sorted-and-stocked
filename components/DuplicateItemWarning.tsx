// components/DuplicateItemWarning.tsx
// Shown when adding a new inventory item whose name fuzzy-matches something
// that already exists (pg_trgm similarity via find_similar_inventory_items).
// Non-blocking — the goal is catching accidental duplicates like the real
// Asparagus/Chicken Thighs/Poland Spring pairs found in the DB, not stopping
// anyone from adding a genuinely new item that happens to share words.
'use client';

type Match = {
  id: string;
  name: string;
  location_name: string | null;
  similarity: number;
  opened_date: string | null;
  current_qty: number;
};

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
  // "Open It First" (3e-i): the existing duplicate-detection flow already
  // catches this case, so it gets a distinct message here rather than a
  // second, separate warning system.
  const topIsOpenAndInStock = !!top.opened_date && top.current_qty > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center sm:justify-center z-[60] sm:p-4" onClick={onDismiss}>
      <div
        className="bg-white w-full rounded-t-[2rem] sm:rounded-3xl p-5 max-w-md mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-denim mb-1">
          {topIsOpenAndInStock ? 'Finish the opened one first?' : 'Already have this?'}
        </h2>
        <p className="text-sm text-dusk mb-3">
          {topIsOpenAndInStock ? (
            <>
              You already have an opened <span className="font-medium text-denim">{top.name}</span>
              {top.location_name ? ` in ${top.location_name}` : ''} — worth using that up before adding a new one.
            </>
          ) : (
            <>
              You may already have <span className="font-medium text-denim">{top.name}</span>
              {top.location_name ? ` in ${top.location_name}` : ''}.
            </>
          )}
        </p>

        {matches.length > 1 && (
          <ul className="space-y-1 mb-3 text-xs text-dusk">
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
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium"
          >
            Update existing item instead
          </button>
          <button
            onClick={onAddAnyway}
            className="w-full py-2.5 rounded-full border border-cardBorder text-denim"
          >
            Add &quot;{enteredName}&quot; anyway
          </button>
          <button onClick={onDismiss} className="w-full py-2 text-sm text-dusk">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
