// components/HouseholdContactsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';

type Contact = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  tags: string[] | null;
  notes: string | null;
};

export default function HouseholdContactsClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('household_contacts')
      .select('id, name, role, phone, email, tags, notes')
      .eq('property_id', propertyId)
      .order('name');
    setContacts(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addContact() {
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const result = await resilientInsert(supabase, 'household_contacts', {
      property_id: propertyId,
      name: name.trim(),
      role: contactRole.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      tags,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added.', { variant: 'success' });
    setName('');
    setContactRole('');
    setPhone('');
    setEmail('');
    setTagsInput('');
    load();
  }

  async function removeContact(id: string) {
    const result = await resilientDelete(supabase, 'household_contacts', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q) ||
      c.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-charcoal mb-1">Contacts &amp; Vendors</h1>
      <p className="text-sm text-charcoal/50 mb-4">Everyone the household calls on — repairs, deliveries, help.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, role, or tag…"
        className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white mb-4 text-sm"
      />

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Add a contact</h2>
          <div>
            <FieldLabel>Name</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <input
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              placeholder="e.g. Plumber, Cleaning, Handyman"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <FieldLabel>Phone</FieldLabel>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Email</FieldLabel>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Tags</FieldLabel>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Comma separated (e.g. plumbing, urgent)"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addContact}
            disabled={saving || !name.trim()}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          {contacts.length === 0 ? 'No contacts yet.' : 'No matches.'}
        </p>
      )}

      <ul className="space-y-2">
        {filtered.map((c) => (
          <li key={c.id} className="bg-white rounded-xl shadow-sm shadow-charcoal/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-charcoal">{c.name}</p>
                {c.role && <p className="text-xs text-gold-dark">{c.role}</p>}
              </div>
              {canManage(role) && (
                <button
                  onClick={() => removeContact(c.id)}
                  className="text-xs text-charcoal/30 hover:text-rust shrink-0"
                  aria-label="Delete contact"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="text-charcoal/70 hover:text-charcoal">
                  📞 {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="text-charcoal/70 hover:text-charcoal">
                  ✉️ {c.email}
                </a>
              )}
            </div>
            {c.tags && c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.tags.map((t) => (
                  <span key={t} className="text-[11px] bg-gold-light/30 text-charcoal/70 px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
