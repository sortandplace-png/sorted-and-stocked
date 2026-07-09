// app/properties/[id]/batch-operations/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BatchOperationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any>(null);
  const [appliedResults, setAppliedResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!confirm('Apply shopping links to all ingredients? This will overwrite existing links.')) {
      return;
    }

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
        alert('Updates applied successfully!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPhotos = async () => {
    if (!confirm('Batch fetch photos for ingredients? This may take a few minutes.')) {
      return;
    }

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
        alert(`Photos updated: ${data.updated} of ${data.total} ingredients`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream p-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="text-sm text-charcoal font-medium mb-4 inline-block"
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-serif mb-6 text-charcoal">Batch Operations</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-charcoal mb-2">
              Property ID
            </label>
            <input
              type="text"
              value={propertyId}
              onChange={e => setPropertyId(e.target.value)}
              placeholder="ba9ed5a7-4e05-4eb6-a315-dfda3ae7e57a"
              className="w-full px-4 py-2 border border-gold-light/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={handleDryRun}
              disabled={!propertyId || loading}
              className="px-4 py-3 bg-charcoal text-cream rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition"
            >
              {loading ? '⏳ Running...' : '📋 Preview Changes (Dry Run)'}
            </button>

            <button
              onClick={handleApply}
              disabled={!propertyId || loading || !dryRunResults}
              className="px-4 py-3 bg-green-600 text-white rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition"
            >
              {loading ? '⏳ Applying...' : '✅ Apply Shopping Links'}
            </button>

            <button
              onClick={handleBatchPhotos}
              disabled={!propertyId || loading}
              className="px-4 py-3 bg-orange-600 text-white rounded-full font-medium hover:opacity-90 disabled:opacity-40 transition md:col-span-2"
            >
              {loading ? '⏳ Fetching...' : '📸 Batch Fetch Photos'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rust/10 border border-rust rounded-lg text-rust text-sm">
              {error}
            </div>
          )}
        </div>

        {dryRunResults && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-xl font-serif mb-4 text-charcoal">Dry Run Results</h2>
            <p className="text-sm text-charcoal/70 mb-4">
              Total ingredients: {dryRunResults.totalIngredients} | Total rows to update: {dryRunResults.totalRows}
            </p>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-stone-50 border-b border-gold-light/30">
                  <tr>
                    <th className="text-left px-3 py-2">Ingredient</th>
                    <th className="text-left px-3 py-2">Primary Store</th>
                    <th className="text-left px-3 py-2">Kosher?</th>
                    <th className="text-left px-3 py-2">Recipes</th>
                    <th className="text-left px-3 py-2">Reasoning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-light/20">
                  {(dryRunResults.updates || []).slice(0, 50).map((update: any, i: number) => (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="px-3 py-2 font-medium text-charcoal">{update.ingredientName}</td>
                      <td className="px-3 py-2 text-charcoal/70">{update.primary_store}</td>
                      <td className="px-3 py-2">{update.is_strictly_kosher ? '✅' : '—'}</td>
                      <td className="px-3 py-2 text-charcoal/70">{update.affectedRows}</td>
                      <td className="px-3 py-2 text-xs text-charcoal/50">{update.reasoning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(dryRunResults.updates || []).length > 50 && (
                <p className="text-xs text-charcoal/40 mt-2">Showing 50 of {dryRunResults.updates.length} changes...</p>
              )}
            </div>
          </div>
        )}

        {appliedResults && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h2 className="text-xl font-serif mb-2 text-green-900">✅ Updates Applied</h2>
            <p className="text-sm text-green-800">
              {appliedResults.totalIngredients} unique ingredients updated • {appliedResults.totalRows} total rows affected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
