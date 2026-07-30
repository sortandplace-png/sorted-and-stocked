// components/NewPropertyForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import FieldLabel from '@/components/FieldLabel';

export default function NewPropertyForm() {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    // create_property_with_household (migration 139) creates the property
    // AND a new household for it in one security-definer transaction --
    // households has no INSERT policy of its own (confirmed: the only
    // policy, households_select_member, requires a property already linked
    // to see a household, which doesn't exist yet for a brand-new one), so
    // a plain client-side insert here could never have set household_id.
    // That gap is what left "Low" and "QA Demo" as orphans (SS-368).
    //
    // Named after the property, matching the display convention elsewhere
    // (a single-property household with a matching name reads as just the
    // bare name, same as "Lax" already does) -- this form has never asked
    // about a household concept, and still doesn't need to.
    //
    // The 003_auto_owner_membership.sql trigger fires synchronously inside
    // the same INSERT the function runs, so property_members already has
    // the owner row by the time this call returns -- no polling/retry
    // needed the way the old direct-insert version required.
    const { data: propertyId, error: rpcError } = await supabase.rpc('create_property_with_household', {
      p_property_name: name.trim(),
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
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create property'}
          </button>
        </form>
      </div>
    </div>
  );
}
