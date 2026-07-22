// components/LinkCapturedPhotosClient.tsx
// The other half of the redesigned capture flow (CapturePhotoClient.tsx):
// staff just snap photos with no matching decision at capture time; this is
// where that decision actually happens, later, by whoever owns cleanup.
// Lives in Admin Cleanup alongside Duplicate Ingredients/Needs Linking --
// structurally the same shape (a real backlog of loose ends to resolve),
// just photos instead of ingredient names.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Capture = {
  id: string;
  raw_payload: { photo_url?: string };
  submitted_by_name: string | null;
  created_at: string;
};

type Target = { id: string; name: string; photo_url: string | null };

export default function LinkCapturedPhotosClient({ propertyId }: { propertyId: string }) {
  const supabase = createClient();
  const showToast = useToast();

  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetType, setTargetType] = useState<'item' | 'room'>('item');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Target[]>([]);
  const [rooms, setRooms] = useState<Target[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [captureRes, itemRes, roomRes] = await Promise.all([
      supabase
        .from('capture_staging')
        .select('id, raw_payload, created_at, profiles(full_name)')
        .eq('property_id', propertyId)
        .eq('capture_type', 'photo')
        .eq('status', 'pending')
        .order('created_at'),
      supabase.from('inventory_items').select('id, name, photo_url').eq('property_id', propertyId).order('name'),
      supabase.from('locations').select('id, name, photo_url').eq('property_id', propertyId).order('name'),
    ]);
    setCaptures(
      (captureRes.data ?? []).map((c: any) => ({
        id: c.id,
        raw_payload: c.raw_payload ?? {},
        submitted_by_name: c.profiles?.full_name ?? null,
        created_at: c.created_at,
      }))
    );
    setItems(itemRes.data ?? []);
    setRooms(roomRes.data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function assign(captureId: string, photoUrl: string, targetId: string) {
    setProcessingId(captureId);
    const table = targetType === 'item' ? 'inventory_items' : 'locations';
    const { error: assignError } = await supabase.from(table).update({ photo_url: photoUrl }).eq('id', targetId);
    if (assignError) {
      setProcessingId(null);
      showToast('Failed to assign photo.', { variant: 'error' });
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from('capture_staging')
      .update({ status: 'approved', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', captureId);

    setCaptures((prev) => prev.filter((c) => c.id !== captureId));
    setSearch('');
    setProcessingId(null);
    showToast('Photo linked.', { variant: 'success' });
  }

  async function reject(captureId: string) {
    setProcessingId(captureId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from('capture_staging')
      .update({ status: 'rejected', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq('id', captureId);
    setCaptures((prev) => prev.filter((c) => c.id !== captureId));
    setProcessingId(null);
  }

  if (loading) return <SkeletonList />;

  const targets = targetType === 'item' ? items : rooms;
  const filteredTargets = targets
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aHas = a.photo_url ? 1 : 0;
      const bHas = b.photo_url ? 1 : 0;
      if (aHas !== bHas) return aHas - bHas;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Link Captured Photos</h1>
      <p className="text-sm text-dusk mb-5">
        Match each photo staff took to a real inventory item or room.
      </p>

      {captures.length === 0 ? (
        <p className="text-sm text-dusk text-center py-8 bg-white rounded-2xl shadow-sm shadow-charcoal/5">
          Nothing waiting to be linked.
        </p>
      ) : (
        <>
          <p className="text-xs text-dusk mb-3">{captures.length} photo{captures.length === 1 ? '' : 's'} waiting.</p>
          {(() => {
            const current = captures[0];
            const photoUrl = current.raw_payload.photo_url;
            return (
              <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-full h-56 object-contain rounded-xl bg-linen mb-3" />
                )}
                <p className="text-xs text-dusk mb-3">
                  {current.submitted_by_name ?? 'Someone'} · {new Date(current.created_at).toLocaleDateString()}
                </p>

                <div className="inline-flex rounded-full border border-cardBorder bg-linen p-0.5 text-sm mb-3">
                  <button
                    onClick={() => {
                      setTargetType('item');
                      setSearch('');
                    }}
                    className={`rounded-full px-4 py-1.5 ${targetType === 'item' ? 'bg-denim text-white' : 'text-dusk'}`}
                  >
                    Inventory Item
                  </button>
                  <button
                    onClick={() => {
                      setTargetType('room');
                      setSearch('');
                    }}
                    className={`rounded-full px-4 py-1.5 ${targetType === 'room' ? 'bg-denim text-white' : 'text-dusk'}`}
                  >
                    Room
                  </button>
                </div>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={targetType === 'item' ? 'Search for the matching item…' : 'Search for the matching room…'}
                  className="w-full border border-cardBorder rounded-2xl px-4 py-2.5 bg-linen mb-2"
                />
                <div className="max-h-56 overflow-y-auto border border-cardBorder rounded-2xl divide-y divide-cardBorder">
                  {filteredTargets.slice(0, 30).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => photoUrl && assign(current.id, photoUrl, t.id)}
                      disabled={processingId === current.id}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm hover:bg-linen disabled:opacity-40"
                    >
                      <span className="flex-1 truncate text-denim">{t.name}</span>
                      {t.photo_url && <span className="text-xs text-sage shrink-0">has photo</span>}
                    </button>
                  ))}
                  {filteredTargets.length === 0 && (
                    <p className="px-4 py-3 text-sm text-dusk">No matches.</p>
                  )}
                </div>

                <button
                  onClick={() => reject(current.id)}
                  disabled={processingId === current.id}
                  className="w-full text-center text-sm text-dusk mt-3 py-2 disabled:opacity-40"
                >
                  Not useful — discard →
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
