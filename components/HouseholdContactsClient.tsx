// components/HouseholdContactsClient.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientUpdate, resilientDelete } from '@/lib/resilient-write';
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

type ImportRow = { name: string; role: string | null; phone: string | null; email: string | null; tags: string[] };

// Minimal RFC4180-ish CSV parser -- handles quoted fields containing commas,
// not a full spec implementation (no embedded newlines inside quotes), which
// is enough for a contacts export/import roundtrip. Expected columns: name
// (required), role, phone, email, tags (semicolon-separated within the
// cell, since commas are already the column delimiter).
function parseContactsCsv(text: string): ImportRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  }

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = headers.indexOf('name');
  if (nameIdx === -1) return [];
  const roleIdx = headers.indexOf('role');
  const phoneIdx = headers.indexOf('phone');
  const emailIdx = headers.indexOf('email');
  const tagsIdx = headers.indexOf('tags');

  return lines
    .slice(1)
    .map((line) => {
      const cells = parseLine(line);
      const name = cells[nameIdx]?.trim() ?? '';
      if (!name) return null;
      return {
        name,
        role: roleIdx >= 0 ? cells[roleIdx]?.trim() || null : null,
        phone: phoneIdx >= 0 ? cells[phoneIdx]?.trim() || null : null,
        email: emailIdx >= 0 ? cells[emailIdx]?.trim() || null : null,
        tags: tagsIdx >= 0 ? (cells[tagsIdx]?.split(';').map((t) => t.trim()).filter(Boolean) ?? []) : [],
      };
    })
    .filter((row): row is ImportRow => row !== null);
}

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const [importRows, setImportRows] = useState<ImportRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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

  function resetForm() {
    setEditingId(null);
    setName('');
    setContactRole('');
    setPhone('');
    setEmail('');
    setTagsInput('');
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setName(c.name);
    setContactRole(c.role ?? '');
    setPhone(c.phone ?? '');
    setEmail(c.email ?? '');
    setTagsInput((c.tags ?? []).join(', '));
  }

  async function saveContact() {
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const values = {
      name: name.trim(),
      role: contactRole.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      tags,
    };

    const result = editingId
      ? await resilientUpdate(supabase, 'household_contacts', { id: editingId }, values)
      : await resilientInsert(supabase, 'household_contacts', { property_id: propertyId, ...values });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(
      result.queued ? 'Saved — will sync when back online.' : editingId ? 'Saved.' : 'Added.',
      { variant: 'success' }
    );
    resetForm();
    load();
  }

  async function removeContact(id: string) {
    const result = await resilientDelete(supabase, 'household_contacts', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    if (editingId === id) resetForm();
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function handleCsvFile(file: File) {
    setImportError(null);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseContactsCsv(String(reader.result ?? ''));
      if (rows.length === 0) {
        setImportRows(null);
        setImportError('No valid rows found — the CSV needs a "name" column, at minimum.');
        return;
      }
      setImportRows(rows);
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!importRows || importRows.length === 0) return;
    setImporting(true);
    const { error } = await supabase.from('household_contacts').insert(
      importRows.map((r) => ({
        property_id: propertyId,
        name: r.name,
        role: r.role,
        phone: r.phone,
        email: r.email,
        tags: r.tags,
      }))
    );
    setImporting(false);
    if (error) {
      setImportError(error.message);
      return;
    }
    showToast(`Imported ${importRows.length} contact${importRows.length === 1 ? '' : 's'}.`, { variant: 'success' });
    setImportRows(null);
    setImportFileName('');
    load();
  }

  function cancelImport() {
    setImportRows(null);
    setImportFileName('');
    setImportError(null);
  }

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
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
        placeholder="Search name, role, phone, email, or tag…"
        className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-full px-4 py-2.5 bg-white mb-4 text-sm"
      />

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-4">
          <h2 className="font-display text-lg text-charcoal mb-1">Import from CSV</h2>
          <p className="text-xs text-charcoal/50 mb-2">
            Columns: name (required), role, phone, email, tags (semicolon-separated).
          </p>
          {importRows ? (
            <div className="space-y-2">
              <p className="text-sm text-charcoal">
                {importFileName} — {importRows.length} contact{importRows.length === 1 ? '' : 's'} ready to import.
              </p>
              <ul className="max-h-32 overflow-y-auto text-xs text-charcoal/60 space-y-0.5">
                {importRows.slice(0, 8).map((r, i) => (
                  <li key={i}>{r.name}{r.role ? ` — ${r.role}` : ''}</li>
                ))}
                {importRows.length > 8 && <li>…and {importRows.length - 8} more</li>}
              </ul>
              {importError && <p className="text-sm text-rust">{importError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="flex-1 py-2 rounded-full bg-charcoal text-cream font-medium text-sm disabled:opacity-40"
                >
                  {importing ? 'Importing…' : `Import ${importRows.length} contact${importRows.length === 1 ? '' : 's'}`}
                </button>
                <button
                  onClick={cancelImport}
                  className="px-4 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {importError && <p className="text-sm text-rust mb-2">{importError}</p>}
              <label className="block text-center py-2.5 rounded-full border border-charcoal/30 text-charcoal text-sm font-medium cursor-pointer">
                Choose CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      )}

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">{editingId ? 'Edit contact' : 'Add a contact'}</h2>
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
          <div className="flex gap-2">
            <button
              onClick={saveContact}
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add contact'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2.5 rounded-full border border-charcoal/30 text-charcoal font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
          {contacts.length === 0
            ? canManage(role)
              ? 'No contacts yet — use the form above to add your plumber, cleaner, or handyman.'
              : 'No contacts yet. Ask a manager to add one.'
            : 'No matches.'}
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
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-xs text-charcoal/40 hover:text-charcoal"
                    aria-label="Edit contact"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeContact(c.id)}
                    className="text-xs text-charcoal/30 hover:text-rust"
                    aria-label="Delete contact"
                  >
                    ✕
                  </button>
                </div>
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
