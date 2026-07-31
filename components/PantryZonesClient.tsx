// components/PantryZonesClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import { flattenLocationTree, locationPath } from '@/lib/location-tree';
import { compressImageToBlob, compressImageToDataUrl } from '@/lib/compress-image';
import FieldLabel from '@/components/FieldLabel';
import CameraCapture from '@/components/CameraCapture';
import { Camera } from 'lucide-react';

type Location = { id: string; name: string; parent_location_id: string | null };
type Zone = {
  id: string;
  zone_name: string;
  location_id: string | null;
  description: string | null;
};

// SS-260.
type ScanItem = { name: string; category: string; is_food: boolean };
type ScanState = {
  zoneId: string;
  preview: string;
  step: 'scanning' | 'reviewing' | 'saving' | 'error';
  items: ScanItem[];
  checked: Set<number>;
  error: string | null;
};

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await compressImageToDataUrl(file, { maxDimension: 1200 });
  const base64 = dataUrl.replace(/^data:[^,]*,/, '');
  return { data: base64, mediaType: 'image/jpeg' };
}

// A text-based list grouped by location, deliberately — not a literal
// floor-plan map. pantry_zones has no coordinate/image fields, and this
// covers the actual need ("where does X live") without inventing a
// visual-layout feature nobody asked for.
//
// SS-260 adds a photo SCAN per zone -- not a floor-plan photo of the zone
// itself, so pantry_zones still needs no image column. The photo is
// transient input to a vision call; only its Storage URL survives, and only
// on whichever capture_staging rows a person actually confirms.
export default function PantryZonesClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  // SS-260. Scoped to this file's new scan feature only -- the rest of this
  // page (zone list, "Add a zone" form) was already 100% hardcoded English
  // before this change, a pre-existing gap this ticket did not ask to fix.
  // Flagged separately rather than silently expanded into.
  const t = useTranslations('pantryZoneScan');
  const supabase = createClient();
  const showToast = useToast();

  // SS-260. One scan in flight at a time, keyed to the zone that started
  // it -- opening a second zone's camera while one is reviewing would mean
  // two photos both claiming the same review UI.
  const [scan, setScan] = useState<ScanState | null>(null);
  const [cameraForZone, setCameraForZone] = useState<string | null>(null);
  const scanFileRef = useRef<File | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  const [zoneName, setZoneName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [locRes, zoneRes] = await Promise.all([
      supabase
        .from('locations')
        .select('id, name, parent_location_id')
        .eq('property_id', propertyId)
        .neq('is_active', false)
        .order('sort_order'),
      supabase
        .from('pantry_zones')
        .select('id, zone_name, location_id, description')
        .eq('property_id', propertyId)
        .order('zone_name'),
    ]);
    setLocations(locRes.data ?? []);
    setZones(zoneRes.data ?? []);
    if (!locationId && locRes.data?.length) setLocationId(locRes.data[0].id);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addZone() {
    if (!zoneName.trim() || !locationId) return;
    setSaving(true);
    const result = await resilientInsert(supabase, 'pantry_zones', {
      property_id: propertyId,
      zone_name: zoneName.trim(),
      location_id: locationId,
      description: description.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      showToast('Failed to save.', { variant: 'error' });
      return;
    }
    showToast(result.queued ? 'Saved — will sync when back online.' : 'Added.', { variant: 'success' });
    setZoneName('');
    setDescription('');
    load();
  }

  async function removeZone(id: string) {
    const result = await resilientDelete(supabase, 'pantry_zones', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  // SS-260. A photo of the zone in, candidate items out. Suggestions only --
  // nothing is written until a person checks a box and taps Add, and even
  // then it lands in Capture Inbox for review, never a direct
  // inventory_items write. Two reasons that matters here specifically:
  // inventory_items has a BEFORE INSERT trigger requiring a non-blank
  // Spanish name, and this vision call is English-only (per spec) -- a
  // direct insert would hard-fail on every single suggestion. Capture Inbox
  // is where name_es actually gets filled in, by a person, same as every
  // other AI-suggested item in this app (see IdentifyItemClient).
  async function handleZonePhoto(zoneId: string, file: File) {
    setCameraForZone(null);
    const preview = URL.createObjectURL(file);
    scanFileRef.current = file;
    setScan({ zoneId, preview, step: 'scanning', items: [], checked: new Set(), error: null });

    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch('/api/tools/pantry-zone-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, imageBase64: data, mediaType }),
      });
      const body = await res.json();
      if (!res.ok) {
        setScan((s) => (s ? { ...s, step: 'error', error: body.error ?? t('errorGeneric') } : s));
        return;
      }
      const items: ScanItem[] = Array.isArray(body.items) ? body.items : [];
      setScan((s) => (s ? { ...s, step: 'reviewing', items } : s));
    } catch {
      setScan((s) => (s ? { ...s, step: 'error', error: t('errorUnreachable') } : s));
    }
  }

  function toggleScanItem(i: number) {
    setScan((s) => {
      if (!s) return s;
      const next = new Set(s.checked);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return { ...s, checked: next };
    });
  }

  function closeScan() {
    if (scan) URL.revokeObjectURL(scan.preview);
    scanFileRef.current = null;
    setScan(null);
  }

  async function addCheckedItems() {
    if (!scan || scan.checked.size === 0) return;
    const file = scanFileRef.current;
    const zone = zones.find((z) => z.id === scan.zoneId);
    setScan((s) => (s ? { ...s, step: 'saving' } : s));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Uploaded once and reused across every staged row from this photo --
      // one photo, N candidate items, no reason to upload it N times.
      let photoUrl: string | null = null;
      if (file) {
        const key = crypto.randomUUID();
        const path = `${propertyId}/${key}.jpg`;
        const compressed = await compressImageToBlob(file);
        const { error: uploadError } = await supabase.storage
          .from('item-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (!uploadError) {
          photoUrl = supabase.storage.from('item-photos').getPublicUrl(path).data.publicUrl;
        }
      }

      // The location's own name, not locationPath's "Basement › Wine
      // Fridge" breadcrumb -- CaptureInboxClient matches location_name
      // against locations.name directly (case-insensitive, exact), so the
      // full breadcrumb string would never match anything.
      const zoneLocationName = zone ? locations.find((l) => l.id === zone.location_id)?.name ?? '' : '';
      const rows = [...scan.checked].map((i) => {
        const item = scan.items[i];
        return {
          property_id: propertyId,
          submitted_by: user?.id ?? null,
          capture_type: 'inventory',
          raw_payload: {
            name: item.name,
            // Left blank on purpose, not defaulted to the English name --
            // Capture Inbox already requires a person to fill this in
            // before approving, and a row that looks translated but isn't
            // is worse than an honest blank.
            name_es: '',
            category: item.category || null,
            // Matched by NAME at approval time (CaptureInboxClient), not by
            // id -- pre-filling the zone's own location name means it
            // auto-matches for the common case without inventing a new
            // pantry_zone_id column on inventory_items.
            location_name: zoneLocationName,
            notes:
              `Suggested from a Pantry Zone Map photo of "${zone?.zone_name ?? 'a zone'}."` +
              (item.is_food ? '' : ' Not a food item.'),
            photo_url: photoUrl,
          },
        };
      });

      const { error } = await supabase.from('capture_staging').insert(rows);
      if (error) throw error;

      showToast(t('savedToast', { count: rows.length }), { variant: 'success' });
      closeScan();
    } catch {
      showToast(t('errorSave'), { variant: 'error' });
      setScan((s) => (s ? { ...s, step: 'reviewing' } : s));
    }
  }

  if (loading) return <SkeletonList />;

  const q = search.trim().toLowerCase();
  const filteredZones = zones.filter((z) => {
    if (!q) return true;
    if (z.zone_name.toLowerCase().includes(q)) return true;
    if (z.description?.toLowerCase().includes(q)) return true;
    if (locationPath(locations, z.location_id).toLowerCase().includes(q)) return true;
    return false;
  });

  const grouped = filteredZones.reduce<Record<string, Zone[]>>((acc, z) => {
    const key = locationPath(locations, z.location_id);
    (acc[key] ??= []).push(z);
    return acc;
  }, {});

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Pantry Zone Map</h1>
      <p className="text-sm text-dusk mb-4">Where things live within each storage location.</p>

      {/* SS-260. One shared instance, not one per zone card -- only one
          scan can be in flight at a time (see the `scan` state comment),
          so only one camera needs to exist. */}
      <CameraCapture
        open={cameraForZone !== null}
        onCapture={(file) => cameraForZone && handleZonePhoto(cameraForZone, file)}
        onClose={() => setCameraForZone(null)}
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search zones…"
        className="w-full border border-cardBorder rounded-full px-4 py-2.5 bg-card mb-4 text-sm"
      />

      {canManage(role) && (
        <div className="bg-card rounded-2xl shadow-card p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-denim mb-1">Add a zone</h2>
          <div>
            <FieldLabel>Zone name</FieldLabel>
            <input
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Top shelf, left side"
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm bg-card"
            >
              {locations.length === 0 && <option value="">No locations yet</option>}
              {flattenLocationTree(locations).map((l) => (
                <option key={l.id} value={l.id}>
                  {'  '.repeat(l.depth)}
                  {l.depth > 0 ? '↳ ' : ''}
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Description (optional)</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's kept here (optional)"
              rows={2}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={addZone}
            disabled={saving || !zoneName.trim() || !locationId}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add zone'}
          </button>
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-dusk text-center py-8">
          {q
            ? 'No zones match your search.'
            : canManage(role)
            ? 'No zones mapped yet — use the form above to add one, e.g. "Top shelf, left side."'
            : 'No zones mapped yet. Ask a manager to map one.'}
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(grouped).map(([loc, locZones]) => (
          <div key={loc}>
            <h3 className="text-xs font-medium uppercase tracking-wider text-brass mb-2">{loc}</h3>
            <ul className="space-y-2">
              {locZones.map((z) => (
                <li key={z.id} className="bg-card rounded-xl shadow-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-denim">{z.zone_name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* SS-260. No role gate -- same as the rest of the
                          Capture Inbox pipeline this feeds, submitting a
                          capture is not a manager-only action. */}
                      <button
                        onClick={() => setCameraForZone(z.id)}
                        className="text-dusk hover:text-denim p-1"
                        aria-label={t('scanAria', { zone: z.zone_name })}
                      >
                        <Camera size={15} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      {canManage(role) && (
                        <button
                          onClick={() => removeZone(z.id)}
                          className="text-xs text-dusk hover:text-rust"
                          aria-label="Delete zone"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {z.description && <p className="text-sm text-dusk mt-1">{z.description}</p>}

                  {scan?.zoneId === z.id && (
                    <div className="mt-3 pt-3 border-t border-cardBorder">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={scan.preview} alt="" className="w-full rounded-xl mb-2.5 max-h-48 object-cover" />

                      {scan.step === 'scanning' && (
                        <p className="text-sm text-dusk animate-pulse font-display italic text-center py-2">
                          {t('scanning')}
                        </p>
                      )}

                      {scan.step === 'error' && (
                        <div className="space-y-2">
                          <p className="text-sm text-rust bg-rust/10 rounded-xl px-3 py-2">
                            {scan.error}
                          </p>
                          <button
                            onClick={closeScan}
                            className="w-full py-2 rounded-full border border-cardBorder text-denim text-sm"
                          >
                            {t('close')}
                          </button>
                        </div>
                      )}

                      {(scan.step === 'reviewing' || scan.step === 'saving') && (
                        <div className="space-y-2">
                          {scan.items.length === 0 ? (
                            <p className="text-sm text-dusk text-center py-2">{t('emptyResult')}</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {scan.items.map((item, i) => (
                                <li key={i}>
                                  <label className="flex items-start gap-2.5 bg-mist rounded-xl px-3 py-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={scan.checked.has(i)}
                                      onChange={() => toggleScanItem(i)}
                                      disabled={scan.step === 'saving'}
                                      className="mt-0.5 shrink-0"
                                    />
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-sm text-denim">{item.name}</span>
                                      <span className="block text-[11px] text-dusk">
                                        {item.category || t('uncategorized')}
                                        {!item.is_food && ` · ${t('notFood')}`}
                                      </span>
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={closeScan}
                              disabled={scan.step === 'saving'}
                              className="flex-1 py-2 rounded-full border border-cardBorder text-denim text-sm disabled:opacity-40"
                            >
                              {t('cancel')}
                            </button>
                            {scan.items.length > 0 && (
                              <button
                                onClick={addCheckedItems}
                                disabled={scan.step === 'saving' || scan.checked.size === 0}
                                className="flex-1 py-2 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
                              >
                                {scan.step === 'saving'
                                  ? t('saving')
                                  : scan.checked.size > 0
                                    ? t('addChecked', { count: scan.checked.size })
                                    : t('addCheckedEmpty')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
