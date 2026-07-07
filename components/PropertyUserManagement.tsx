'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Trash2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

type PropertyUser = {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff' | 'viewer';
  invited_at: string;
  accepted_at: string | null;
  email?: string;
};

export default function PropertyUserManagement({ propertyId }: { propertyId: string }) {
  const [users, setUsers] = useState<PropertyUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'staff' | 'viewer'>('staff');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const supabase = createClient();
  const showToast = useToast();

  useEffect(() => {
    loadUsers();
  }, [propertyId]);

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('property_users')
      .select('*')
      .eq('property_id', propertyId);

    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    const { error } = await supabase
      .from('property_users')
      .insert({
        property_id: propertyId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        role: inviteRole
      });

    setInviting(false);

    if (error) {
      showToast('Failed to invite user', { variant: 'error' });
      return;
    }

    showToast(`Invitation sent to ${inviteEmail}`, { variant: 'success' });
    setInviteEmail('');
    loadUsers();
  };

  const removeUser = async (userId: string) => {
    const { error } = await supabase
      .from('property_users')
      .delete()
      .eq('property_id', propertyId)
      .eq('user_id', userId);

    if (!error) {
      loadUsers();
      showToast('User removed', { variant: 'success' });
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('property_users')
      .update({ role: newRole })
      .eq('property_id', propertyId)
      .eq('user_id', userId);

    if (!error) {
      loadUsers();
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-ink/50">Loading team members...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Team Members & Permissions
        </h3>
      </div>

      {/* Invite Section */}
      <div className="bg-gold-light/10 rounded-2xl p-4 border border-gold-light/20">
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email to invite"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="w-full border border-gold-light/40 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <div className="flex gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="flex-1 border border-gold-light/40 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={inviteUser}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2 rounded-lg bg-aubergine text-cream text-sm font-medium disabled:opacity-40"
            >
              {inviting ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Users */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-sm text-ink/40">No team members yet</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gold-light/20"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-ink">{user.email || `User ${user.user_id.slice(0, 8)}`}</p>
                {user.accepted_at && <p className="text-xs text-ink/50 mt-0.5">✓ Active</p>}
              </div>

              <select
                value={user.role}
                onChange={(e) => updateRole(user.user_id, e.target.value)}
                className="text-xs px-2 py-1 border border-gold-light/40 rounded bg-white"
              >
                <option value="viewer">Viewer</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>

              <button
                onClick={() => removeUser(user.user_id)}
                className="ml-2 p-1.5 text-ink/40 hover:text-rust transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Role Legend */}
      <div className="text-xs text-ink/50 space-y-1 pt-4 border-t border-gold-light/20">
        <p><strong>Owner:</strong> Full access + user management</p>
        <p><strong>Manager:</strong> Can manage inventory & shopping lists</p>
        <p><strong>Staff:</strong> Can audit items & add to lists</p>
        <p><strong>Viewer:</strong> Read-only access</p>
      </div>
    </div>
  );
}
