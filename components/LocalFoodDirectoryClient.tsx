// components/LocalFoodDirectoryClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SkeletonList } from '@/components/Skeleton';
import { usePropertyRole, canManage } from '@/components/PropertyRoleContext';
import { isJewishObservant } from '@/lib/observance-gating';
import { directoryRadiusMiles, isWithinDirectoryRadius } from '@/lib/directory-radius';

type Restaurant = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string | null;
  hashgacha: string | null;
  hashgacha_confirmed: boolean | null;
  website: string | null;
  hours: string | null;
  delivery_available: boolean | null;
  rating: number | null;
};

type PropertyContext = { city: string | null; state: string | null; zip: string | null; jewish: boolean };

type FormState = {
  name: string;
  category: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  website: string;
  hours: string;
  hashgacha: string;
  hashgacha_confirmed: boolean;
  delivery_available: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  category: '',
  phone: '',
  whatsapp: '',
  address: '',
  city: '',
  website: '',
  hours: '',
  hashgacha: '',
  hashgacha_confirmed: false,
  delivery_available: false,
};

function toRestaurantInsert(propertyId: string, form: FormState) {
  return {
    property_id: propertyId,
    name: form.name.trim(),
    category: form.category.trim() || null,
    phone: form.phone.trim() || null,
    whatsapp: form.whatsapp.trim() || null,
    address: form.address.trim() || null,
    city: form.city.trim() || null,
    website: form.website.trim() || null,
    hours: form.hours.trim() || null,
    hashgacha: form.hashgacha.trim() || null,
    hashgacha_confirmed: form.hashgacha_confirmed,
    delivery_available: form.delivery_available,
  };
}

export default function LocalFoodDirectoryClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const role = usePropertyRole();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hashgachaFilter, setHashgachaFilter] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Observance gating + generated locality: the subtitle, the hashgacha
  // UI and the radius rule all key off the property's own row -- nothing
  // about Lakewood (or any city) is hardcoded here anymore.
  const [propertyCtx, setPropertyCtx] = useState<PropertyContext | null>(null);
  // Real centroid miles per row zip (/api/zip-distance -- the Census ZCTA
  // table is server-only). null value = unmeasurable; absent/undefined =
  // not answered yet. Both render permissively, so rows never blink out
  // and back while the lookup is in flight.
  const [distanceByZip, setDistanceByZip] = useState<Record<string, number | null>>({});

  function loadRestaurants() {
    return supabase
      .from('local_food_directory')
      .select(
        'id, name, phone, whatsapp, address, city, state, zip, category, hashgacha, hashgacha_confirmed, website, hours, delivery_available, rating'
      )
      .eq('property_id', propertyId)
      .order('name')
      .then(({ data }) => {
        setRestaurants(data ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadRestaurants();
    supabase
      .from('properties')
      .select('city, state, zip, calendar_layers')
      .eq('id', propertyId)
      .single()
      .then(({ data }) => {
        setPropertyCtx({
          city: data?.city ?? null,
          state: data?.state ?? null,
          zip: data?.zip ?? null,
          jewish: isJewishObservant(data?.calendar_layers as string[] | null | undefined),
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Default to the observant treatment until the property row answers --
  // hiding then revealing hashgacha on an observant house would flash the
  // wrong (stripped) directory at the household that cares most about it.
  const jewish = propertyCtx?.jewish ?? true;

  // One distance lookup per load: every distinct row zip against the
  // property zip. Skipped entirely when the property has no zip -- the
  // radius rule is permissive then anyway.
  useEffect(() => {
    const propertyZip = propertyCtx?.zip?.trim();
    if (!propertyZip) return;
    const zips = [...new Set(restaurants.map((r) => r.zip?.trim()).filter((z): z is string => !!z))];
    if (zips.length === 0) return;
    fetch('/api/zip-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyZip, zips }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.miles) setDistanceByZip(data.miles);
      })
      .catch(() => {
        // Lookup failure leaves distances unknown -- the filter stays
        // permissive rather than blanking a curated list.
      });
  }, [propertyCtx?.zip, restaurants]);

  // Radius by density (lib/directory-radius.ts): 5 mi in a dense metro,
  // 25 mi otherwise -- Country (Mountain Dale NY 12763) needs the wide
  // rule or its list filters itself empty. Real centroid miles where a
  // row zip resolved; unmeasurable rows stay visible. Applied before the
  // user filters so the chips and counts they see are already local.
  const withinRadius = useMemo(
    () =>
      propertyCtx
        ? restaurants.filter((r) =>
            isWithinDirectoryRadius(propertyCtx, r, r.zip?.trim() ? distanceByZip[r.zip.trim()] : undefined)
          )
        : restaurants,
    [restaurants, propertyCtx, distanceByZip]
  );

  const categories = useMemo(
    () => [...new Set(withinRadius.map((r) => r.category).filter(Boolean))] as string[],
    [withinRadius]
  );

  const hashgachas = useMemo(
    () => [...new Set(withinRadius.map((r) => r.hashgacha).filter(Boolean))] as string[],
    [withinRadius]
  );

  const filtered = withinRadius.filter((r) => {
    const q = search.trim().toLowerCase();
    if (q && !r.name.toLowerCase().includes(q)) return false;
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (hashgachaFilter && r.hashgacha !== hashgachaFilter) return false;
    return true;
  });

  // Generated subtitle -- never a hardcoded town. City present: "near
  // {city}" with the radius the density rule chose; hashgacha mention
  // only for an observant household. City missing: the honest CTA.
  const subtitle = propertyCtx?.city
    ? `Restaurants and takeout within ${directoryRadiusMiles(propertyCtx.zip)} mi of ${propertyCtx.city}${
        jewish ? ', with hashgacha noted.' : '.'
      }`
    : 'Add the places this house orders from.';

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(r: Restaurant) {
    setEditingId(r.id);
    setForm({
      name: r.name ?? '',
      category: r.category ?? '',
      phone: r.phone ?? '',
      whatsapp: r.whatsapp ?? '',
      address: r.address ?? '',
      city: r.city ?? '',
      website: r.website ?? '',
      hours: r.hours ?? '',
      hashgacha: r.hashgacha ?? '',
      hashgacha_confirmed: r.hashgacha_confirmed ?? false,
      delivery_available: r.delivery_available ?? false,
    });
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);

    if (editingId) {
      const { error: updateError } = await supabase
        .from('local_food_directory')
        .update(toRestaurantInsert(propertyId, form))
        .eq('id', editingId);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('local_food_directory')
        .insert(toRestaurantInsert(propertyId, form));
      setSaving(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    closeForm();
    setLoading(true);
    await loadRestaurants();
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this restaurant from the directory?')) return;
    const { error: deleteError } = await supabase.from('local_food_directory').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <SkeletonList />;

  return (
    <div className="max-w-md lg:max-w-4xl mx-auto p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h1 className="text-2xl font-display text-denim">Local Takeout Directory</h1>
        {canManage(role) && !formOpen && (
          <button
            onClick={openAddForm}
            className="shrink-0 text-sm font-medium bg-denim text-white px-3 py-1.5 rounded-full"
          >
            + Add
          </button>
        )}
      </div>
      <p className="text-sm text-dusk mb-4">{subtitle}</p>

      {formOpen && (
        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-4 space-y-2.5">
          <h2 className="font-display text-lg text-denim mb-1">
            {editingId ? 'Edit restaurant' : 'Add restaurant'}
          </h2>
          {error && <p className="text-sm text-rust">{error}</p>}
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name *"
            className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
          />
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Category (e.g. pizza, deli, bakery)"
            className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
            />
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              placeholder="WhatsApp"
              className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
            />
          </div>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Address"
            className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="City"
              className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
            />
            <input
              value={form.hours}
              onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
              placeholder="Hours"
              className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
            />
          </div>
          <input
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            placeholder="Website"
            className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
          />
          {/* Hashgacha entry is observant-household UI -- a civil-only
              house's directory form stays neutral (observance gating). */}
          {jewish && (
            <input
              value={form.hashgacha}
              onChange={(e) => setForm((f) => ({ ...f, hashgacha: e.target.value }))}
              placeholder="Hashgacha"
              className="w-full border border-cardBorder rounded-full px-4 py-2 bg-card text-sm"
            />
          )}
          <div className="flex gap-4 px-1">
            {jewish && (
              <label className="flex items-center gap-1.5 text-sm text-dusk">
                <input
                  type="checkbox"
                  checked={form.hashgacha_confirmed}
                  onChange={(e) => setForm((f) => ({ ...f, hashgacha_confirmed: e.target.checked }))}
                  className="rounded border-cardBorder text-brass"
                />
                Hashgacha confirmed
              </label>
            )}
            <label className="flex items-center gap-1.5 text-sm text-dusk">
              <input
                type="checkbox"
                checked={form.delivery_available}
                onChange={(e) => setForm((f) => ({ ...f, delivery_available: e.target.checked }))}
                className="rounded border-cardBorder text-brass"
              />
              Delivery available
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-sm font-medium bg-denim text-white px-4 py-2 rounded-full disabled:opacity-40"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add restaurant'}
            </button>
            <button
              onClick={closeForm}
              className="text-sm font-medium border border-brass/30 text-denim px-4 py-2 rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search restaurants…"
        className="w-full border border-cardBorder rounded-full px-4 py-2.5 bg-card mb-3 text-sm"
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                categoryFilter === c ? 'bg-denim text-white' : 'bg-card border border-cardBorder text-dusk'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* "with hashgacha noted" was only ever description text -- this is
          the real filter, same single-select toggle pattern as category
          just above, not a second UI paradigm. Observance-gated: renders
          only for a Jewish-observant household. */}
      {jewish && hashgachas.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hashgachas.map((h) => (
            <button
              key={h}
              onClick={() => setHashgachaFilter(hashgachaFilter === h ? null : h)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                hashgachaFilter === h ? 'bg-sage text-white' : 'bg-card border border-sage/40 text-sage'
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 &&
        (restaurants.length === 0 ? (
          // Nothing curated for this house yet -- the honest empty state,
          // with the same Add action the header already offers managers.
          <div className="text-center py-8">
            <p className="text-sm text-dusk mb-3">Add the places this house orders from.</p>
            {canManage(role) && !formOpen && (
              <button
                onClick={openAddForm}
                className="text-sm font-medium bg-denim text-white px-4 py-2 rounded-full"
              >
                + Add the first place
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-dusk text-center py-8">No matches.</p>
        ))}

      <ul className="space-y-2">
        {filtered.map((r) => (
          <li key={r.id} className="bg-card rounded-xl border border-cardBorder shadow-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-denim">{r.name}</p>
                {r.category && <p className="text-xs text-dusk">{r.category}</p>}
              </div>
              {jewish &&
                (r.hashgacha ? (
                  <span className="text-xs bg-sage/10 text-sage px-2 py-0.5 rounded-full shrink-0">
                    {r.hashgacha}
                    {r.hashgacha_confirmed ? '' : ' (unconfirmed)'}
                  </span>
                ) : (
                  <span className="text-xs bg-rust/10 text-rust px-2 py-0.5 rounded-full shrink-0">No hashgacha found</span>
                ))}
            </div>
            {r.address && <p className="text-xs text-dusk mt-1">{r.address}</p>}
            {(r.hours || r.rating != null || r.delivery_available != null) && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {r.rating != null && (
                  <span className="text-xs text-dusk">⭐ {r.rating.toFixed(1)}</span>
                )}
                {r.delivery_available != null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.delivery_available ? 'bg-sage/10 text-sage' : 'bg-mist text-dusk'
                    }`}
                  >
                    {r.delivery_available ? 'Delivery available' : 'No delivery'}
                  </span>
                )}
                {r.hours && <span className="text-xs text-dusk">{r.hours}</span>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="text-dusk hover:text-denim">
                  📞 {r.phone}
                </a>
              )}
              {r.whatsapp && (
                <a
                  href={`https://wa.me/${r.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dusk hover:text-denim"
                >
                  💬 WhatsApp
                </a>
              )}
              {r.website && (
                <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-brass hover:text-denim">
                  🔗 Website
                </a>
              )}
              {canManage(role) && (
                <>
                  <button onClick={() => openEditForm(r)} className="ml-auto text-dusk hover:text-denim">
                    Edit
                  </button>
                  <button onClick={() => handleRemove(r.id)} className="text-rust/70 hover:text-rust">
                    Remove
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
