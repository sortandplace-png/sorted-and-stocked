// components/NewPropertyForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import FieldLabel from '@/components/FieldLabel';

type ManageableHousehold = { id: string; name: string };

export default function NewPropertyForm() {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [households, setHouseholds] = useState<ManageableHousehold[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Only households the caller could plausibly join -- purely what
    // populates the picker, not the real authorization boundary. The RPC
    // (migration 140) re-checks owner/manager membership itself server-side
    // regardless of what this query returns, so there's nothing to exploit
    // by tampering with it client-side.
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('property_members')
        .select('role, properties(household_id, archived_at, households(id, name))')
        .eq('user_id', user.id)
        .in('role', ['owner', 'manager']);

      const seen = new Map<string, string>();
      for (const row of data ?? []) {
        const property = row.properties as unknown as {
          household_id: string | null;
          archived_at: string | null;
          households: { id: string; name: string } | null;
        } | null;
        // A household stays offered as long as at least one of the
        // caller's properties in it is still active -- an archived
        // property alone shouldn't be enough to surface it.
        if (property?.archived_at) continue;
        const household = property?.households;
        if (household && !seen.has(household.id)) seen.set(household.id, household.name);
      }
      setHouseholds(Array.from(seen, ([id, householdName]) => ({ id, name: householdName })).sort((a, b) => a.name.localeCompare(b.name)));
    })();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'existing' && !householdId) return;
    setSaving(true);
    setError(null);

    // create_property_with_household (migration 139, extended in 140) --
    // households has no INSERT policy of its own (confirmed: the only
    // policy, households_select_member, requires a property already linked
    // to see a household), so this has to run as a security-definer RPC
    // either way. p_household_id null mints a new household named after the
    // property (matches formatPropertyLabel's single-property-household
    // convention, same as "Lax"); set, it links to that household instead --
    // the RPC re-checks owner/manager membership itself, so this can't be
    // used to attach a property to a household the caller doesn't manage.
    const { data: propertyId, error: rpcError } = await supabase.rpc('create_property_with_household', {
      p_property_name: name.trim(),
      p_household_id: mode === 'existing' ? householdId : null,
    });

    setSaving(false);

    if (rpcError || !propertyId) {
      setError(rpcError?.message ?? 'Property created, but could not find it afterward.');
      return;
    }

    router.push(`/properties/${propertyId}/inventory`);
  }

  return (
    <div className="min-h-screen bg-linen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <h1 className="font-display text-2xl text-denim mb-1">Add a property</h1>
        <p className="text-sm text-dusk mb-6">
          You'll be set as the owner and can invite staff afterward.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <FieldLabel>Property name</FieldLabel>
            <input
              type="text"
              placeholder="e.g. Strauss Residence"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2.5 bg-white"
              autoFocus
              required
            />
          </div>

          {/* Only shown once the caller already manages at least one
              property -- a first-time user has nothing to join, so the
              toggle would just be a confusing extra step in the common
              case of setting up their very first property. */}
          {households.length > 0 && (
            <div>
              <FieldLabel>Household</FieldLabel>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 py-2 rounded-full text-sm font-medium border transition-colors ${
                    mode === 'new' ? 'bg-denim text-white border-denim' : 'text-dusk border-cardBorder bg-white'
                  }`}
                >
                  New household
                </button>
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 py-2 rounded-full text-sm font-medium border transition-colors ${
                    mode === 'existing' ? 'bg-denim text-white border-denim' : 'text-dusk border-cardBorder bg-white'
                  }`}
                >
                  Existing household
                </button>
              </div>
              {mode === 'existing' && (
                <select
                  value={householdId}
                  onChange={(e) => setHouseholdId(e.target.value)}
                  className="w-full border border-cardBorder focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-full px-4 py-2.5 bg-white"
                  required
                >
                  <option value="" disabled>
                    Choose a household…
                  </option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim() || (mode === 'existing' && !householdId)}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create property'}
          </button>
        </form>
      </div>
    </div>
  );
}
