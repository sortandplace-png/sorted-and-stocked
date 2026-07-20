// components/StaffClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { canManage, usePropertyRole, type PropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import Avatar from '@/components/Avatar';
import FieldLabel from '@/components/FieldLabel';

type Member = {
  id: string; // property_members row id
  user_id: string;
  role: PropertyRole;
  full_name: string | null;
  email: string | null;
  lastActive: string | null; // real auth.users.last_sign_in_at, null if never signed in
};

function formatLastActive(iso: string | null): string {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type PendingInvite = { userId: string; email: string; role: string; invitedAt: string };
type HouseholdProperty = { id: string; name: string };
type ProvisionResult = {
  status: string;
  userId: string;
  createdNew: boolean;
  added: string[];
  alreadyMember: string[];
  emailSent?: boolean;
  emailReason?: string | null;
  issuedLogin?: { login: string; password: string };
};

type TeamActivityRow = {
  person: string;
  email: string;
  role: string;
  last_signed_in: string | null;
  tasks_assigned: number;
  completed_last_7_days: number;
  last_handover: string | null;
};

type ActivityEntry = {
  id: string;
  member_name_snapshot: string | null;
  action_type: 'invited' | 'role_changed' | 'removed';
  actor_name: string | null;
  old_role: string | null;
  new_role: string | null;
  created_at: string;
};

// Grounded in the real access-control code (canManage() and the last-owner
// trigger), not invented — every line here is something the app actually
// enforces, not a marketing description of what the role "should" do.
const ROLE_PERMISSIONS: Record<PropertyRole, string[]> = {
  owner: [
    'Full access to inventory, recipes, meal plans, and shopping lists',
    "Can invite people and change anyone's role",
    'Can remove members',
    "Protected — can't be demoted or removed as the property's last owner",
  ],
  manager: [
    'Can manage inventory, recipes, meal plans, and shopping lists',
    'Can invite new staff or managers',
    "Cannot change an existing member's role (owner-only)",
  ],
  staff: [
    'Can view inventory, recipes, meal plans, and shopping lists',
    'Can update quantities and check off shopping list items',
    'Cannot invite others or change roles',
  ],
};

function describeActivity(a: ActivityEntry): string {
  const who = a.member_name_snapshot ?? 'Someone';
  const by = a.actor_name ? ` by ${a.actor_name}` : '';
  if (a.action_type === 'invited') return `${who} invited as ${a.new_role}${by}`;
  if (a.action_type === 'role_changed') return `${who} changed from ${a.old_role} to ${a.new_role}${by}`;
  return `${who} removed${by}`;
}

export default function StaffClient({ propertyId }: { propertyId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<PropertyRole>('staff');
  const [authMode, setAuthMode] = useState<'email' | 'issued'>('email');
  const [issuedPassword, setIssuedPassword] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [resendingUserId, setResendingUserId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [teamActivity, setTeamActivity] = useState<TeamActivityRow[] | null>(null);
  // Every property the viewer manages -- the Add Person property checklist,
  // and (for a staff hire) the "both houses" default. Deliberately not just
  // [propertyId]: a housekeeper who works both Main and Country needs both
  // checked on the same submission, not a second separate invite.
  const [householdProperties, setHouseholdProperties] = useState<HouseholdProperty[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([propertyId]);
  const [offboardingUserId, setOffboardingUserId] = useState<string | null>(null);

  const supabase = createClient();
  const showToast = useToast();
  const viewerRole = usePropertyRole();
  const viewerIsOwner = viewerRole === 'owner';

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
        email: null,
        lastActive: null,
      }))
    );
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const loadHouseholdProperties = useCallback(async () => {
    if (!canManage(viewerRole)) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('property_members')
      .select('property_id, role, properties(id, name)')
      .eq('user_id', user.id)
      .in('role', ['owner', 'manager']);
    const props = (data ?? [])
      .map((m) => m.properties as unknown as HouseholdProperty | null)
      .filter((p): p is HouseholdProperty => p !== null);
    setHouseholdProperties(props);
    // Staff default to every property the viewer manages (housekeepers work
    // both houses); owner/manager creation defaults to just this property.
    setSelectedPropertyIds(inviteRole === 'staff' ? props.map((p) => p.id) : [propertyId]);
  }, [viewerRole, propertyId, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadHouseholdProperties();
  }, [loadHouseholdProperties]);

  function handleRoleChange(role: PropertyRole) {
    setInviteRole(role);
    setSelectedPropertyIds(role === 'staff' ? householdProperties.map((p) => p.id) : [propertyId]);
  }

  function togglePropertyId(id: string) {
    setSelectedPropertyIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  const loadPendingInvites = useCallback(async () => {
    if (!canManage(viewerRole)) return;
    const res = await fetch(`/api/staff/pending-invites?propertyId=${propertyId}`);
    const body = await res.json();
    if (!res.ok) return;
    setPendingInvites(body.pending ?? []);
    // Same admin-privileged lookup this route already does for the pending
    // check also resolves every member's email — reused here as the Team
    // card fallback when full_name is null, instead of a second mechanism.
    const emailByUserId = new Map<string, string>(
      (body.emails ?? []).map((e: { userId: string; email: string }) => [e.userId, e.email])
    );
    const lastActiveByUserId = new Map<string, string | null>(
      (body.lastActive ?? []).map((e: { userId: string; lastSignInAt: string | null }) => [e.userId, e.lastSignInAt])
    );
    setMembers((prev) =>
      prev.map((m) => ({
        ...m,
        email: emailByUserId.get(m.user_id) ?? m.email,
        lastActive: lastActiveByUserId.has(m.user_id) ? lastActiveByUserId.get(m.user_id)! : m.lastActive,
      }))
    );
  }, [propertyId, viewerRole]);

  const loadActivity = useCallback(async () => {
    const { data } = await supabase
      .from('property_member_activity')
      .select('id, member_name_snapshot, action_type, actor_name, old_role, new_role, created_at')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);
    setActivity((data as ActivityEntry[]) ?? []);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadPendingInvites();
    loadActivity();
  }, [loadPendingInvites, loadActivity]);

  async function resendInvite(userId: string, email: string) {
    setResendingUserId(userId);
    const res = await fetch('/api/invite/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, userId }),
    });
    const body = await res.json();
    setResendingUserId(null);
    if (!res.ok) {
      showToast(body.error ?? 'Failed to resend invite.', { variant: 'error' });
      return;
    }
    showToast(`Invite resent to ${email}.`, { variant: 'success' });
  }

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email || !fullName.trim() || selectedPropertyIds.length === 0) return;

    setInviting(true);
    setInviteMessage(null);
    setProvisionResult(null);
    setError(null);

    const res = await fetch('/api/staff/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyIds: selectedPropertyIds,
        fullName: fullName.trim(),
        role: inviteRole,
        authMode,
        email,
        password: authMode === 'issued' ? issuedPassword : undefined,
      }),
    });
    const body = await res.json();

    setInviting(false);

    if (!res.ok) {
      setError(body.error ?? 'Failed to add person.');
      return;
    }

    const result = body as ProvisionResult;
    const propertyNames = result.added.map((id) => householdProperties.find((p) => p.id === id)?.name ?? id).join(', ');

    if (result.issuedLogin) {
      // The only time the password is ever visible again -- shown inline,
      // not just a toast, until the manager dismisses it themselves.
      setProvisionResult(result);
    } else if (result.createdNew) {
      setInviteMessage(
        result.emailSent
          ? `Invited ${fullName} (${email}) to ${propertyNames}. They'll get an email to set up their account.`
          : `Added ${fullName} (${email}) to ${propertyNames}, but the invite email failed to send${
              result.emailReason ? ` (${result.emailReason})` : ''
            } -- share the sign-in link with them directly.`
      );
    } else {
      setInviteMessage(`${fullName} (${email}) already had an account -- added to ${propertyNames || 'no new properties (already a member everywhere selected)'}.`);
    }

    showToast(`${fullName} added.`, { variant: 'success' });
    setFullName('');
    setInviteEmail('');
    setIssuedPassword('');
    loadMembers();
    loadPendingInvites();
    loadActivity();
  }

  async function offboardMember(userId: string, name: string | null) {
    if (
      !confirm(
        `Remove ${name ?? 'this person'} from every property and disable their account? This can't be undone by re-adding them -- they'd need a brand-new invite to come back.`
      )
    )
      return;
    setOffboardingUserId(userId);
    const res = await fetch('/api/staff/offboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = await res.json();
    setOffboardingUserId(null);

    if (!res.ok) {
      showToast(body.error ?? 'Failed to offboard.', { variant: 'error', durationMs: 6000 });
      return;
    }

    showToast(`${name ?? 'Person'} offboarded.`);
    loadMembers();
    loadActivity();
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
    loadActivity();
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
    loadActivity();
  }

  if (loading) return <SkeletonList rows={3} />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-4">Staff</h1>

      {error && (
        <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}

      <div className="space-y-3 mb-6">
        {members.map((member) => (
          <div key={member.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Avatar fullName={member.full_name} size="md" />
              <span className="flex-1 truncate text-charcoal font-medium">
                {member.full_name ?? member.email ?? 'Unnamed user'}
              </span>
              <span
                className={`text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0 ${
                  member.role === 'owner'
                    ? 'bg-gold-dark text-white'
                    : member.role === 'manager'
                    ? 'bg-gold-light/60 text-gold-dark'
                    : 'bg-charcoal/5 text-charcoal/60'
                }`}
              >
                {member.role}
              </span>
            </div>
            <ul className="text-xs text-charcoal/50 space-y-0.5 mb-3 pl-1">
              {ROLE_PERMISSIONS[member.role].map((perm) => (
                <li key={perm}>· {perm}</li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <select
                value={member.role}
                onChange={(e) => changeRole(member.id, e.target.value as PropertyRole)}
                className="text-sm border border-gold-light/60 rounded-full px-3 py-1 bg-cream/40"
                disabled={!viewerIsOwner}
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="staff">Staff</option>
              </select>
              {member.role !== 'owner' && canManage(viewerRole) && (
                <button
                  onClick={() => removeMember(member.id, member.full_name ?? member.email)}
                  className="text-rust text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            {/* Distinct from Remove above, which only drops this one
                property's membership row -- Offboard clears every property
                this person belongs to and disables their account, for when
                they're leaving the household entirely, not just this house. */}
            {member.role !== 'owner' && canManage(viewerRole) && (
              <button
                onClick={() => offboardMember(member.user_id, member.full_name ?? member.email)}
                disabled={offboardingUserId === member.user_id}
                className="text-[11px] text-charcoal/40 underline mt-1.5 disabled:opacity-40"
              >
                {offboardingUserId === member.user_id ? 'Offboarding…' : 'Offboard (remove from all properties)'}
              </button>
            )}
            <p className="text-[11px] text-charcoal/40 mt-2">Last active: {formatLastActive(member.lastActive)}</p>
          </div>
        ))}
      </div>

      {canManage(viewerRole) && (
        <>
      <h2 className="font-display text-lg text-charcoal mb-2">Add Person</h2>
      <form onSubmit={handleAddPerson} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 space-y-3">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
            required
          />
        </div>

        <div>
          <FieldLabel>Role</FieldLabel>
          <select
            value={inviteRole}
            onChange={(e) => handleRoleChange(e.target.value as PropertyRole)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
          <p className="text-xs text-charcoal/40 mt-1">
            {inviteRole === 'manager'
              ? ROLE_PERMISSIONS.manager[0] + '; ' + ROLE_PERMISSIONS.manager[1].toLowerCase()
              : ROLE_PERMISSIONS.staff[0] + '; ' + ROLE_PERMISSIONS.staff[1].toLowerCase()}
          </p>
        </div>

        {householdProperties.length > 1 && (
          <div>
            <FieldLabel>Properties</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {householdProperties.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border cursor-pointer ${
                    selectedPropertyIds.includes(p.id)
                      ? 'bg-gold-dark text-white border-gold-dark'
                      : 'bg-cream/40 text-charcoal border-gold-light/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPropertyIds.includes(p.id)}
                    onChange={() => togglePropertyId(p.id)}
                    className="sr-only"
                  />
                  {p.name}
                </label>
              ))}
            </div>
            {inviteRole === 'staff' && (
              <p className="text-xs text-charcoal/40 mt-1">Defaults to every property you manage -- housekeepers typically work both houses.</p>
            )}
          </div>
        )}

        <div>
          <FieldLabel>How they'll sign in</FieldLabel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode('email')}
              className={`flex-1 py-2 rounded-full text-sm font-medium border ${
                authMode === 'email' ? 'bg-gold-dark text-white border-gold-dark' : 'bg-cream/40 text-charcoal border-gold-light/60'
              }`}
            >
              Email invite
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('issued')}
              className={`flex-1 py-2 rounded-full text-sm font-medium border ${
                authMode === 'issued' ? 'bg-gold-dark text-white border-gold-dark' : 'bg-cream/40 text-charcoal border-gold-light/60'
              }`}
            >
              Issued login
            </button>
          </div>
          <p className="text-xs text-charcoal/40 mt-1">
            {authMode === 'email'
              ? 'They get an email with a link to set up their own account.'
              : "You set a login and password directly and hand it to them -- no email required. This only applies to a brand-new person; it's ignored if they already have an account."}
          </p>
        </div>

        <div>
          <FieldLabel>{authMode === 'email' ? 'Email address' : 'Login (can be any email-shaped ID, e.g. housekeeper1@sortandplace.app)'}</FieldLabel>
          <input
            type={authMode === 'email' ? 'email' : 'text'}
            placeholder={authMode === 'email' ? 'Email address' : 'housekeeper1@sortandplace.app'}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
            required
          />
        </div>

        {authMode === 'issued' && (
          <div>
            <FieldLabel>Password (at least 6 characters)</FieldLabel>
            <input
              type="text"
              placeholder="Password to hand them"
              value={issuedPassword}
              onChange={(e) => setIssuedPassword(e.target.value)}
              className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2 bg-cream/40"
              minLength={6}
              required
            />
          </div>
        )}

        {inviteMessage && <p className="text-sm text-charcoal/60">{inviteMessage}</p>}

        {provisionResult?.issuedLogin && (
          <div className="bg-gold-light/30 rounded-2xl p-3 text-sm space-y-1">
            <p className="text-charcoal font-medium">Share these with {fullName || 'them'} directly -- shown only once:</p>
            <p className="text-charcoal">
              Login: <span className="font-mono">{provisionResult.issuedLogin.login}</span>
            </p>
            <p className="text-charcoal">
              Password: <span className="font-mono">{provisionResult.issuedLogin.password}</span>
            </p>
            <button type="button" onClick={() => setProvisionResult(null)} className="text-xs text-gold-dark underline">
              Dismiss
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={inviting || !fullName.trim() || !inviteEmail.trim() || selectedPropertyIds.length === 0 || (authMode === 'issued' && issuedPassword.length < 6)}
          className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
        >
          {inviting ? 'Adding…' : 'Add Person'}
        </button>
      </form>

      <p className="text-xs text-charcoal/40 mt-4">
        Owner role can only be granted from this list by promoting an existing member — invites max out at Manager.
      </p>

      {pendingInvites.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg text-charcoal mb-2">Pending Invites</h2>
          <ul className="divide-y divide-gold-light/30 rounded-2xl bg-white shadow-sm shadow-charcoal/5 overflow-hidden">
            {pendingInvites.map((inv) => (
              <li key={inv.userId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal truncate">{inv.email}</p>
                  <p className="text-xs text-charcoal/40">
                    {inv.role} · invited {new Date(inv.invitedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => resendInvite(inv.userId, inv.email)}
                  disabled={resendingUserId === inv.userId}
                  className="text-xs font-medium text-gold-dark underline disabled:opacity-40 shrink-0"
                >
                  {resendingUserId === inv.userId ? 'Sending…' : 'Resend'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activity.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg text-charcoal mb-2">Activity</h2>
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="text-xs text-charcoal/50">
                <span className="text-charcoal/30">{new Date(a.created_at).toLocaleDateString()}</span>{' '}
                — {describeActivity(a)}
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </div>
  );
}
