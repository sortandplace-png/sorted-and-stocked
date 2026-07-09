// components/StaffClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Member = {
  id: string; // property_members row id
  user_id: string;
  role: PropertyRole;
  full_name: string | null;
};

export default function StaffClient({ propertyId }: { propertyId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PropertyRole>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  // Set when get_user_id_by_email comes back empty — offers the
  // email-a-signup-link fallback instead of a dead end.
  const [noAccountFor, setNoAccountFor] = useState<string | null>(null);
  const [sendingInviteEmail, setSendingInviteEmail] = useState(false);

  const supabase = createClient();
  const showToast = useToast();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('property_members')
      .select('id, user_id, role, profiles(full_name)')
      .eq('property_id', propertyId)
      .order('joined_at');

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setMembers(
      (data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as PropertyRole,
        full_name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
      }))
    );
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setInviting(true);
    setInviteMessage(null);
    setNoAccountFor(null);
    setError(null);

    // Step 1: resolve email → user_id via the narrow lookup function
    // (004_invite_by_email.sql).
    const { data: userId, error: lookupError } = await supabase.rpc('get_user_id_by_email', {
      p_email: email,
    });

    if (lookupError) {
      setError(lookupError.message);
      setInviting(false);
      return;
    }

    if (!userId) {
      // No existing account — offer the email-invite fallback instead of
      // a dead end.
      setNoAccountFor(email);
      setInviting(false);
      return;
    }

    // Step 2: add membership. RLS (property_members_insert_owner_manager)
    // enforces that only an owner/manager of this property can do this —
    // this client-side check is just for UX, not security.
    const { error: insertError } = await supabase
      .from('property_members')
      .insert({ property_id: propertyId, user_id: userId, role: inviteRole });

    setInviting(false);

    if (insertError) {
      // Postgres unique_violation on (property_id, user_id)
      if (insertError.code === '23505') {
        setInviteMessage(`${email} is already on this property.`);
      } else {
        setError(insertError.message);
      }
      return;
    }

    setInviteEmail('');
    setNoAccountFor(null);
    setInviteMessage(`Added ${email} as ${inviteRole}.`);
    showToast(`${email} added as ${inviteRole}.`, { variant: 'success' });
    loadMembers();
  }

  async function sendInviteEmail() {
    if (!noAccountFor) return;
    setSendingInviteEmail(true);
    setError(null);

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, email: noAccountFor, role: inviteRole }),
    });
    const body = await res.json();

    setSendingInviteEmail(false);

    if (!res.ok) {
      setError(body.error ?? 'Failed to send invite.');
      return;
    }

    setInviteMessage(`Invite sent to ${noAccountFor}. They'll appear here once they accept.`);
    showToast(`Invite sent to ${noAccountFor}.`, { variant: 'success' });
    setNoAccountFor(null);
    setInviteEmail('');
    loadMembers();
  }

  async function changeRole(memberId: string, role: PropertyRole) {
    const previous = members.find((m) => m.id === memberId)?.role;
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));

    const { error: updateError } = await supabase
      .from('property_members')
      .update({ role })
      .eq('id', memberId);

    if (updateError) {
      // Roll back optimistic change — this is also where the
      // 006_prevent_last_owner_removal.sql trigger's error surfaces if
      // someone tries to demote the property's only owner.
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId && previous ? { ...m, role: previous } : m))
      );
      setError(updateError.message);
      showToast(updateError.message, { variant: 'error', durationMs: 6000 });
      return;
    }

    showToast('Role updated.', { variant: 'success' });
  }

  async function removeMember(memberId: string, name: string | null) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    if (!confirm(`Remove ${name ?? 'this person'} from the property?`)) return;

    setMembers((prev) => prev.filter((m) => m.id !== memberId));

    const { error: deleteError } = await supabase.from('property_members').delete().eq('id', memberId);

    if (deleteError) {
      // Also where the last-owner guard can fire — restore the row and
      // show the real reason rather than a generic failure.
      setMembers((prev) => [...prev, member]);
      setError(deleteError.message);
      showToast(deleteError.message, { variant: 'error', durationMs: 6000 });
      return;
    }

    showToast(`Removed ${name ?? 'member'}.`);
  }

  if (loading) return <SkeletonList rows={3} />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-4">Staff</h1>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-charcoal/5 mb-6 overflow-hidden">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 truncate text-charcoal">{member.full_name ?? 'Unnamed user'}</span>
            <select
              value={member.role}
              onChange={(e) => changeRole(member.id, e.target.value as PropertyRole)}
              className="text-sm border border-gold-light/60 rounded-full px-3 py-1 bg-cream/40"
              disabled={member.role === 'owner'}
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
            {member.role !== 'owner' && (
              <button
                onClick={() => removeMember(member.id, member.full_name)}
                className="text-rust text-sm"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="font-display text-lg text-charcoal mb-2">Invite someone</h2>
      <form onSubmit={handleInvite} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 space-y-3">
        <input
          type="email"
          placeholder="Email address"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
          required
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as PropertyRole)}
          className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
        >
          <option value="staff">Staff</option>
          <option value="manager">Manager</option>
        </select>
        {inviteMessage && <p className="text-sm text-charcoal/60">{inviteMessage}</p>}

        {noAccountFor && (
          <div className="bg-gold-light/30 rounded-2xl p-3 text-sm">
            <p className="text-charcoal mb-2">
              No account found for {noAccountFor}. Send them a signup invite email?
            </p>
            <button
              type="button"
              onClick={sendInviteEmail}
              disabled={sendingInviteEmail}
              className="w-full py-2 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
            >
              {sendingInviteEmail ? 'Sending…' : `Send invite to ${noAccountFor}`}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={inviting || !inviteEmail.trim()}
          className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
        >
          {inviting ? 'Adding…' : 'Add to property'}
        </button>
        <p className="text-xs text-charcoal/40">
          If they don't have an account yet, you'll be offered the option to email them a signup invite.
        </p>
      </form>

      <p className="text-xs text-charcoal/40 mt-4">
        Owner role can only be granted from this list by promoting an existing member — invites max out at Manager.
      </p>
    </div>
  );
}
