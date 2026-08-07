// components/ConsoleInviteCard.tsx
// SS-425/SS-436: the invite-by-email flow folded into the console's
// PEOPLE section -- previously a link out to /staff, which was exactly
// the three-pages-for-one-thought split the console exists to end.
// Compact on purpose: name, email, role, which houses. Posts to the SAME
// /api/staff/provision route the Staff page uses, so there is one invite
// implementation, not two that drift. The fuller flow (issued-password
// accounts, pending-invite management, offboarding) stays on /staff.
// English-only on purpose (SS-436 carve-out).
//
// SS-824: this card's own chrome (border/bg/padding) and title paragraph
// are GONE -- the caller (console/page.tsx) now wraps this in a
// CollapsibleCard blue tile, which owns both (title lives in the header,
// so it stays visible when collapsed instead of vanishing with the form).
'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function ConsoleInviteCard({
  properties,
  defaultPropertyId,
}: {
  properties: { id: string; label: string }[];
  defaultPropertyId: string;
}) {
  const showToast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'staff' | 'manager'>('staff');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    properties.some((p) => p.id === defaultPropertyId) ? [defaultPropertyId] : []
  );
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleProperty(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || selectedIds.length === 0) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyIds: selectedIds,
          fullName: fullName.trim(),
          role,
          authMode: 'email',
          email: email.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body.error ?? 'Invite failed.');
        showToast(body.error ?? 'Invite failed.', { variant: 'error' });
        return;
      }
      setMessage(`Invited ${email.trim()} as ${role}.`);
      showToast(`Invited ${email.trim()}.`, { variant: 'success' });
      setFullName('');
      setEmail('');
    } catch {
      setMessage('Network error. Try again.');
      showToast('Network error. Try again.', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-dusk">
        Issued-password accounts, pending invites, and offboarding stay on the Team page.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          required
          className="border border-brass/30 bg-mist rounded-xl2 px-3 py-2 text-sm text-denim focus:outline-none focus:ring-2 focus:ring-brass/40"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="border border-brass/30 bg-mist rounded-xl2 px-3 py-2 text-sm text-denim focus:outline-none focus:ring-2 focus:ring-brass/40"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-denim">Role:</span>
        {(['staff', 'manager'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            aria-pressed={role === r}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              role === r ? 'bg-denim text-white' : 'bg-mist text-denim border border-cardBorder'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {properties.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5 text-sm text-denim">
            <input
              type="checkbox"
              checked={selectedIds.includes(p.id)}
              onChange={() => toggleProperty(p.id)}
              className="rounded border-cardBorder text-brass focus:ring-brass/40"
            />
            {p.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={sending || !fullName.trim() || !email.trim() || selectedIds.length === 0}
          className="text-sm font-medium text-white bg-denim px-5 py-2 rounded-full disabled:opacity-40"
        >
          {sending ? 'Inviting…' : 'Send invite'}
        </button>
        {message && <span className="text-xs text-dusk">{message}</span>}
      </div>
    </form>
  );
}
