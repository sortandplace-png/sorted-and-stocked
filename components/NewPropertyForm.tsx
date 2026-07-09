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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Your session expired — please sign in again.');
      setSaving(false);
      return;
    }

    // The 003_auto_owner_membership.sql trigger enrolls `user.id` as
    // 'owner' in property_members automatically — no separate insert
    // needed here. Deliberately no .select() on this insert: INSERT ...
    // RETURNING re-checks the properties SELECT RLS policy against the
    // new row (is_property_member), which 403s here because that check
    // races the trigger's property_members insert. Fetch the new
    // property's id from property_members afterward instead.
    const { error: insertError } = await supabase
      .from('properties')
      .insert({ name: name.trim(), created_by: user.id });

    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }

    // Retry fetching the new property_members row (trigger may not have fired yet)
    let membership = null;
    let membershipError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 100 * attempt));
      const result = await supabase
        .from('property_members')
        .select('property_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .single();
      if (!result.error) {
        membership = result.data;
        break;
      }
      membershipError = result.error;
    }

    setSaving(false);

    if (membershipError || !membership) {
      setError(membershipError?.message ?? 'Property created, but could not find it afterward.');
      return;
    }

    router.push(`/properties/${membership.property_id}/inventory`);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <h1 className="font-display text-2xl text-charcoal mb-1">Add a property</h1>
        <p className="text-sm text-charcoal/50 mb-6">
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
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-rust">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Creating…' : 'Create property'}
          </button>
        </form>
      </div>
    </div>
  );
}
