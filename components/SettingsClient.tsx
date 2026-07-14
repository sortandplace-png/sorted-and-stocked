// components/SettingsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { canManage, type PropertyRole } from '@/components/PropertyRoleContext';
import { SITE_URL } from '@/lib/site-url';

type SignupCode = {
  id: string;
  code: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
};

// Twilio (and most carriers) require E.164 -- a leading "+" and country
// code, digits only after that. Rather than reject a US number typed the
// normal way ("(555) 123-4567"), strip everything but digits and assume US
// (+1) when nothing else was given, same leniency most consumer apps allow
// on a phone field.
function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  const bare = digits.replace(/\D/g, '');
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith('1')) return `+${bare}`;
  return `+${bare}`;
}

export default function SettingsClient({
  propertyId,
  role,
  initialPhoneNumber,
  initialSmsOptIn,
}: {
  propertyId: string;
  role: PropertyRole;
  initialPhoneNumber: string;
  initialSmsOptIn: boolean;
}) {
  const supabase = createClient();
  const showToast = useToast();

  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn);
  const [savingPhone, setSavingPhone] = useState(false);

  const [codes, setCodes] = useState<SignupCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(canManage(role));
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const loadCodes = useCallback(async () => {
    if (!canManage(role)) return;
    setLoadingCodes(true);
    const { data } = await supabase
      .from('signup_codes')
      .select('id, code, used_by, used_at, created_at')
      .order('created_at', { ascending: false });
    setCodes(data ?? []);
    setLoadingCodes(false);
  }, [role, supabase]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  async function saveNotificationSettings() {
    setSavingPhone(true);
    const normalized = phoneNumber.trim() ? normalizePhoneNumber(phoneNumber) : null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingPhone(false);
      return;
    }
    const result = await resilientUpdate(
      supabase,
      'profiles',
      { id: user.id },
      { phone_number: normalized, sms_opt_in: normalized ? smsOptIn : false }
    );
    setSavingPhone(false);
    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    if (normalized) setPhoneNumber(normalized);
    if (!normalized) setSmsOptIn(false);
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Saved.', { variant: 'success' });
  }

  async function generateCode() {
    setGenerating(true);
    const { data, error } = await supabase.rpc('generate_signup_code');
    setGenerating(false);
    if (error || !data) {
      showToast(error?.message ?? 'Failed to generate a code.', { variant: 'error' });
      return;
    }
    setNewCode(data as string);
    loadCodes();
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied.`, { variant: 'success' });
    } catch {
      showToast('Failed to copy — copy it manually.', { variant: 'error' });
    }
  }

  async function sendBroadcast() {
    if (!broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, trigger: 'broadcast', message: broadcastMessage.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        showToast(body.error ?? 'Failed to send broadcast.', { variant: 'error' });
        return;
      }
      showToast(`Sent to ${body.sent} of ${body.total} opted-in staff.`, { variant: 'success' });
      setBroadcastMessage('');
    } catch {
      showToast('Network error — try again.', { variant: 'error' });
    } finally {
      setSendingBroadcast(false);
    }
  }

  async function revokeCode(id: string) {
    if (!confirm('Revoke this signup code? It can no longer be used.')) return;
    const { error } = await supabase.from('signup_codes').delete().eq('id', id);
    if (error) {
      showToast('Failed to revoke — it may already be used.', { variant: 'error' });
      return;
    }
    showToast('Code revoked.', { variant: 'success' });
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-display text-charcoal mb-1">Settings</h1>

      <section className="space-y-3">
        <h2 className="font-display text-lg text-charcoal">Notifications</h2>
        <div className="bg-white rounded-2xl border border-gold-light/40 p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-charcoal/60 mb-1 block">Phone number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-white text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-charcoal">Text me updates</p>
              <p className="text-xs text-charcoal/50">Task assignments, shift handover notes, and broadcasts.</p>
            </div>
            <button
              onClick={() => setSmsOptIn((v) => !v)}
              disabled={!phoneNumber.trim()}
              role="switch"
              aria-checked={smsOptIn}
              aria-label="Toggle SMS notifications"
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
                smsOptIn ? 'bg-gold-dark' : 'bg-gold-light/50'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  smsOptIn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            onClick={saveNotificationSettings}
            disabled={savingPhone}
            className="w-full py-2 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
          >
            {savingPhone ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>

      {canManage(role) && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-charcoal">Invite Codes</h2>
          <div className="bg-white rounded-2xl border border-gold-light/40 p-4 space-y-3">
            <p className="text-xs text-charcoal/50">
              Generate a one-time code for a new client to create their own account.
            </p>
            <button
              onClick={generateCode}
              disabled={generating}
              className="w-full py-2 rounded-full bg-gold-dark text-white text-sm font-medium disabled:opacity-40"
            >
              {generating ? 'Generating…' : 'Generate invite code'}
            </button>

            {newCode && (
              <div className="rounded-xl bg-gold-light/15 border border-gold-light/40 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-charcoal font-medium">{newCode}</span>
                  <button
                    onClick={() => copyToClipboard(newCode, 'Code')}
                    className="text-xs font-medium text-gold-dark px-2 py-1 rounded-full bg-white shrink-0"
                  >
                    Copy code
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-charcoal/60 truncate">{`${SITE_URL}/signup?code=${newCode}`}</span>
                  <button
                    onClick={() => copyToClipboard(`${SITE_URL}/signup?code=${newCode}`, 'Signup link')}
                    className="text-xs font-medium text-gold-dark px-2 py-1 rounded-full bg-white shrink-0"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            )}
          </div>

          {loadingCodes ? (
            <SkeletonList rows={2} />
          ) : codes.length === 0 ? (
            <p className="text-sm text-charcoal/40 text-center py-4">No codes generated yet.</p>
          ) : (
            <ul className="space-y-2">
              {codes.map((c) => (
                <li
                  key={c.id}
                  className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-charcoal truncate">{c.code}</p>
                    <p className="text-xs text-charcoal/40">
                      {c.used_by ? `Used ${new Date(c.used_at!).toLocaleDateString()}` : `Created ${new Date(c.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {c.used_by ? (
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-sage/10 text-sage shrink-0">Used</span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-gold-light/30 text-charcoal/60">
                        Unused
                      </span>
                      <button onClick={() => revokeCode(c.id)} className="text-xs text-rust font-medium">
                        Revoke
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canManage(role) && (
        <section className="space-y-3">
          <h2 className="font-display text-lg text-charcoal">Send Broadcast</h2>
          <div className="bg-white rounded-2xl border border-gold-light/40 p-4 space-y-3">
            <p className="text-xs text-charcoal/50">Texts every opted-in staff member on this property.</p>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="e.g. Reminder: early close today at 3pm."
              rows={3}
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-3 bg-white text-sm"
            />
            <button
              onClick={sendBroadcast}
              disabled={!broadcastMessage.trim() || sendingBroadcast}
              className="w-full py-2 rounded-full bg-charcoal text-cream text-sm font-medium disabled:opacity-40"
            >
              {sendingBroadcast ? 'Sending…' : 'Send broadcast'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
