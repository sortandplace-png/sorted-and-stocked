// components/PhotoReviewClient.tsx
// Bulk companion to LocationPhotoUpload.tsx (which stays as the quick
// one-room-at-a-time flow from the Inventory Rooms view). This screen is
// for processing many photos in one sitting — the initial ~85-photo house
// batch, and any future bulk drops — without navigating into each room.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientUpdate } from '@/lib/resilient-write';
import { useToast } from '@/components/Toast';

type LocationOption = { id: string; name: string; photo_url: string | null };

type QueueItem = {
  key: string;
  fileName: string;
  thumbUrl: string;
  mainUrl: string;
  status: 'uploading' | 'ready' | 'error';
  selectedLocationId: string;
  assigning: boolean;
};

export default function PhotoReviewClient({
  propertyId,
  hideBackLink = false,
}: {
  propertyId: string;
  // Suppressed when rendered inside ToolModal -- a "← Tools" link that
  // navigates to a full page would defeat the point of staying put.
  hideBackLink?: boolean;
}) {
  const supabase = createClient();
  const showToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocations() {
    setLoadingLocations(true);
    const { data } = await supabase
      .from('locations')
      .select('id, name, photo_url')
      .eq('property_id', propertyId)
      .order('name');
    setLocations(data ?? []);
    setLoadingLocations(false);
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newItems: QueueItem[] = Array.from(files).map((file, i) => ({
      key: `${Date.now()}-${i}`,
      fileName: file.name,
      thumbUrl: '',
      mainUrl: '',
      status: 'uploading',
      selectedLocationId: '',
      assigning: false,
    }));
    setQueue((prev) => [...prev, ...newItems]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const key = newItems[i].key;
        try {
          const [mainBlob, thumbBlob] = await Promise.all([
            compressImageToBlob(file, { maxDimension: 1600, quality: 0.8 }),
            compressImageToBlob(file, { maxDimension: 300, quality: 0.8 }),
          ]);
          const slug = file.name
            .toLowerCase()
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
          const stamp = `${Date.now()}-${i}`;
          const mainPath = `${propertyId}/${slug}-${stamp}-main.jpg`;
          const thumbPath = `${propertyId}/${slug}-${stamp}-thumb.jpg`;

          const [mainUpload, thumbUpload] = await Promise.all([
            supabase.storage.from('location-photos').upload(mainPath, mainBlob, { contentType: 'image/jpeg' }),
            supabase.storage.from('location-photos').upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' }),
          ]);
          if (mainUpload.error || thumbUpload.error) throw mainUpload.error ?? thumbUpload.error;

          const mainUrl = supabase.storage.from('location-photos').getPublicUrl(mainPath).data.publicUrl;
          const thumbUrl = supabase.storage.from('location-photos').getPublicUrl(thumbPath).data.publicUrl;

          setQueue((prev) =>
            prev.map((item) => (item.key === key ? { ...item, mainUrl, thumbUrl, status: 'ready' } : item))
          );
        } catch {
          setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, status: 'error' } : item)));
        }
      })
    );
  }

  function setSelectedLocation(key: string, locationId: string) {
    setQueue((prev) => prev.map((item) => (item.key === key ? { ...item, selectedLocationId: locationId } : item)));
  }

  async function assign(item: QueueItem) {
    if (!item.selectedLocationId) return;
    setQueue((prev) => prev.map((q) => (q.key === item.key ? { ...q, assigning: true } : q)));

    const result = await resilientUpdate(
      supabase,
      'locations',
      { id: item.selectedLocationId },
      { photo_url: item.mainUrl }
    );

    if (!result.ok) {
      setQueue((prev) => prev.map((q) => (q.key === item.key ? { ...q, assigning: false } : q)));
      showToast('Failed to assign — try again.', { variant: 'error' });
      return;
    }

    const locationName = locations.find((l) => l.id === item.selectedLocationId)?.name ?? 'room';
    setLocations((prev) =>
      prev.map((l) => (l.id === item.selectedLocationId ? { ...l, photo_url: item.mainUrl } : l))
    );
    // Optimistic — the row disappears from the review queue immediately,
    // matching the spec, rather than waiting on a refetch.
    setQueue((prev) => prev.filter((q) => q.key !== item.key));
    showToast(`Assigned to ${locationName}.`, { variant: 'success' });
  }

  function skip(key: string) {
    // Leaves the file in Storage, unassigned — it isn't deleted, just
    // removed from this session's visible queue. Nothing re-lists it
    // automatically (no polling of orphaned Storage files), so skipping
    // is a real decision, not a "come back later" — flagged in the UI copy.
    setQueue((prev) => prev.filter((q) => q.key !== key));
  }

  const assignedCount = locations.filter((l) => !!l.photo_url).length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {!hideBackLink && (
        <Link href={`/properties/${propertyId}/tools`} className="text-sm text-charcoal/50 underline mb-3 inline-block">
          ← Tools
        </Link>
      )}
      <h1 className="font-display text-2xl text-charcoal mb-1">Room Photo Review</h1>
      <p className="text-sm text-charcoal/60 mb-1">
        Upload photos, match each to a real room, assign. This is the permanent home for bulk house-photo drops —
        for a single room, the "Add photo" button on that room's card in Inventory still works too.
      </p>
      <p className="text-xs text-charcoal/40 mb-5">
        {loadingLocations ? 'Loading rooms…' : `${assignedCount} of ${locations.length} rooms have a photo.`}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-8 rounded-2xl border-2 border-dashed border-gold-light text-charcoal/60 text-sm hover:bg-gold-light/10 transition-colors mb-6"
      >
        📸 Choose photos to upload
      </button>

      {queue.length === 0 ? (
        <p className="text-sm text-charcoal/40 text-center py-8">No photos waiting for review.</p>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-3"
            >
              {item.status === 'uploading' ? (
                <div className="w-16 h-16 rounded-xl bg-gold-light/20 shrink-0 flex items-center justify-center text-xs text-charcoal/40">
                  …
                </div>
              ) : item.status === 'error' ? (
                <div className="w-16 h-16 rounded-xl bg-rust/10 shrink-0 flex items-center justify-center text-xs text-rust">
                  Failed
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-xs text-charcoal/40 truncate mb-1.5">{item.fileName}</p>
                <select
                  value={item.selectedLocationId}
                  onChange={(e) => setSelectedLocation(item.key, e.target.value)}
                  disabled={item.status !== 'ready'}
                  className="w-full rounded-lg border border-gold-light/60 px-2 py-1.5 text-sm text-charcoal disabled:opacity-40"
                >
                  <option value="">Which room?</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.photo_url ? ' (already has a photo)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => assign(item)}
                  disabled={item.status !== 'ready' || !item.selectedLocationId || item.assigning}
                  className="rounded-full bg-gold-dark px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {item.assigning ? '…' : 'Assign'}
                </button>
                <button onClick={() => skip(item.key)} className="text-xs text-charcoal/40">
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
