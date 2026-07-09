// components/RecipeHistoryModal.tsx
'use client';

import { useEffect, useState } from 'react';

type HistoryEntry = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  editor_name: string | null;
  created_at: string;
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  instructions_en: 'Instructions (English)',
  instructions_es: 'Instructions (Spanish)',
  servings: 'Servings',
  course: 'Course',
  kosher_type: 'Kosher type',
  family_notes: 'Family notes',
  photo_url: 'Photo',
};

function truncate(value: string | null, max = 140): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export default function RecipeHistoryModal({ recipeId, onClose }: { recipeId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/recipes/${recipeId}/history`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? 'Failed to load history.');
          return;
        }
        setEntries(body.history);
      } catch {
        setError('Network error — check your connection and try again.');
      }
    })();
  }, [recipeId]);

  return (
    <div
      className="fixed inset-0 bg-charcoal/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gold-light/40">
          <h2 className="font-display text-lg text-charcoal">Edit history</h2>
          <button onClick={onClose} className="text-charcoal/50 hover:text-charcoal text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {error && <p className="text-sm text-rust">{error}</p>}
          {!error && entries === null && <p className="text-sm text-charcoal/40">Loading…</p>}
          {entries?.length === 0 && (
            <p className="text-sm text-charcoal/40">No edits recorded for this recipe yet.</p>
          )}
          {entries?.map((entry) => (
            <div key={entry.id} className="border border-gold-light/30 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-charcoal bg-gold-light/30 px-2 py-0.5 rounded-full">
                  {FIELD_LABELS[entry.field_name] ?? entry.field_name}
                </span>
                <span className="text-xs text-charcoal/40">
                  {new Date(entry.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-charcoal/70">
                <span className="line-through text-charcoal/40">{truncate(entry.old_value)}</span>
                {' → '}
                <span className="text-charcoal">{truncate(entry.new_value)}</span>
              </p>
              {entry.editor_name && (
                <p className="text-xs text-charcoal/40 mt-1">by {entry.editor_name}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
