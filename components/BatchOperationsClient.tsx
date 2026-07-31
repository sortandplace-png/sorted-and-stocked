// components/BatchOperationsClient.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BatchOperationsClient({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any>(null);
  const [appliedResults, setAppliedResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Type-to-confirm, not a native confirm() dialog -- a bulk write against
  // every recipe_ingredients row on the property, with no per-row undo,
  // against a real incident history (SS-001, 240 rows lost to an
  // unidentified source). One shared field for both write actions below;
  // clearing it after each run means a second bulk action always needs its
  // own deliberate retype, not a leftover confirmation from the first.
  const [confirmText, setConfirmText] = useState('');
  const confirmed = confirmText.trim() === propertyName;

  const handleDryRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/batch-shopping-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, dryRun: true, limit: 500 }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to run dry-run');
      } else {
        setDryRunResults(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/batch-shopping-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, dryRun: false, limit: 500 }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to apply updates');
      } else {
        setAppliedResults(data);
        setConfirmText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPhotos = async () => {
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/batch-update-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, limit: 100 }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to fetch photos');
      } else {
        setAppliedResults(data);
        setConfirmText('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linen p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-serif mb-1 text-denim">Batch Operations</h1>
        <p className="text-sm text-dusk mb-6">{propertyName}</p>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <button
            onClick={handleDryRun}
            disabled={loading}
            className="w-full px-4 py-3 bg-denim text-white rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition mb-4"
          >
            {loading ? '⏳ Running...' : '📋 Preview Changes (Dry Run)'}
          </button>

          <div className="border-t border-cardBorder pt-4">
            <label className="block text-sm font-medium text-denim mb-2">
              Type <span className="font-semibold">{propertyName}</span> to enable the actions below
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={propertyName}
              className="w-full px-4 py-2 border border-cardBorder rounded-xl focus:outline-none focus:ring-2 focus:ring-brass/40 mb-3"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleApply}
                disabled={loading || !dryRunResults || !confirmed}
                className="px-4 py-3 bg-green-600 text-white rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition"
              >
                {loading ? '⏳ Applying...' : '✅ Apply Shopping Links'}
              </button>

              <button
                onClick={handleBatchPhotos}
                disabled={loading || !confirmed}
                className="px-4 py-3 bg-orange-600 text-white rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition"
              >
                {loading ? '⏳ Fetching...' : '📸 Batch Fetch Photos'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rust/10 border border-rust rounded-lg text-rust text-sm">
              {error}
            </div>
          )}
        </div>

        {dryRunResults && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-serif mb-4 text-denim">Dry Run Results</h2>
            <p className="text-sm text-dusk mb-4">
              Total ingredients: {dryRunResults.totalIngredients} | Total rows to update: {dryRunResults.totalRows}
            </p>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-mist border-b border-cardBorder">
                  <tr>
                    <th className="text-left px-3 py-2">Ingredient</th>
                    <th className="text-left px-3 py-2">Primary Store</th>
                    <th className="text-left px-3 py-2">Kosher?</th>
                    <th className="text-left px-3 py-2">Recipes</th>
                    <th className="text-left px-3 py-2">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cardBorder">
                  {(dryRunResults.updates || []).slice(0, 50).map((update: any, i: number) => (
                    <tr key={i} className="hover:bg-mist">
                      <td className="px-3 py-2 font-medium text-denim">{update.ingredientName}</td>
                      <td className="px-3 py-2 text-dusk">{update.primary_store}</td>
                      <td className="px-3 py-2">{update.is_strictly_kosher ? '✅' : '—'}</td>
                      <td className="px-3 py-2 text-dusk">{update.affectedRows}</td>
                      <td className="px-3 py-2 text-xs text-dusk">{update.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(dryRunResults.updates || []).length > 50 && (
                <p className="text-xs text-dusk mt-2">Showing 50 of {dryRunResults.updates.length} changes...</p>
              )}
            </div>
          </div>
        )}

        {appliedResults && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h2 className="text-xl font-serif mb-2 text-green-900">✅ Updates Applied</h2>
            <p className="text-sm text-green-800">
              {appliedResults.totalIngredients != null
                ? `${appliedResults.totalIngredients} unique ingredients updated • ${appliedResults.totalRows} total rows affected`
                : appliedResults.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
