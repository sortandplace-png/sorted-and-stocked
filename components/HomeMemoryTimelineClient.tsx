// components/HomeMemoryTimelineClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import FieldLabel from '@/components/FieldLabel';
import CameraCapture from '@/components/CameraCapture';

type MemoryType = 'photo' | 'milestone' | 'event';

type Memory = {
  id: string;
  type: MemoryType;
  title: string | null;
  body: string | null;
  photo_url: string | null;
  event_date: string;
};

const TYPE_LABELS: Record<MemoryType, string> = {
  photo: 'Photo',
  milestone: 'Milestone',
  event: 'Event',
};

export default function HomeMemoryTimelineClient({ propertyId }: { propertyId: string }) {
  const role = usePropertyRole();
  const supabase = createClient();
  const showToast = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MemoryType | 'all'>('all');
  const [showCamera, setShowCamera] = useState(false);

  const [type, setType] = useState<MemoryType>('event');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('household_memories')
      .select('id, type, title, body, photo_url, event_date')
      .eq('property_id', propertyId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });
    setMemories(data ?? []);
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setTitle('');
    setBody('');
    setEventDate(new Date().toISOString().slice(0, 10));
    setPhotoFile(null);
    setPhotoPreview(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  function handlePhotoSelected(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function addMemory() {
    if (type === 'photo' && !photoFile) return;
    if (type === 'milestone' && !title.trim()) return;
    if (type === 'event' && !body.trim()) return;

    setSaving(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        const path = `${propertyId}/${crypto.randomUUID()}.jpg`;
        const compressed = await compressImageToBlob(photoFile);
        const { error: uploadError } = await supabase.storage
          .from('memory-photos')
          .upload(path, compressed, { contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        photoUrl = supabase.storage.from('memory-photos').getPublicUrl(path).data.publicUrl;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const result = await resilientInsert(supabase, 'household_memories', {
        property_id: propertyId,
        type,
        title: title.trim() || null,
        body: body.trim() || null,
        photo_url: photoUrl,
        event_date: eventDate,
        created_by: user?.id ?? null,
      });

      if (!result.ok) {
        showToast('Failed to save.', { variant: 'error' });
        return;
      }
      showToast(result.queued ? 'Saved — will sync when back online.' : 'Added to the timeline.', {
        variant: 'success',
      });
      resetForm();
      load();
    } catch {
      showToast('Failed to save.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function removeMemory(id: string) {
    const result = await resilientDelete(supabase, 'household_memories', { id });
    if (!result.ok) {
      showToast('Failed to delete.', { variant: 'error' });
      return;
    }
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  if (loading) return <SkeletonList />;

  const visible = filter === 'all' ? memories : memories.filter((m) => m.type === filter);
  const canSave =
    (type === 'photo' && !!photoFile) || (type === 'milestone' && !!title.trim()) || (type === 'event' && !!body.trim());

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Home Memory Timeline</h1>
      <p className="text-sm text-dusk mb-4">
        A running record of what's happened here — photos, milestones, and everyday moments.
      </p>

      {canManage(role) && (
        <div className="bg-card rounded-2xl border border-cardBorder shadow-card p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-denim mb-1">Add to the timeline</h2>
          <div className="flex bg-linen rounded-full border border-cardBorder p-0.5 text-sm">
            {(['event', 'photo', 'milestone'] as MemoryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-full transition-colors ${
                  type === t ? 'bg-denim text-white' : 'text-dusk'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {type === 'milestone' && (
            <div>
              <FieldLabel>Milestone title</FieldLabel>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. First Shabbos in the new house"
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}

          {type === 'event' && (
            <div>
              <FieldLabel>What happened</FieldLabel>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="e.g. Grandma visited for lunch"
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}

          {type === 'photo' && (
            <div>
              <FieldLabel>Caption (optional)</FieldLabel>
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Caption (optional)"
                className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
              />
            </div>
          )}

          {(type === 'photo' || type === 'milestone') && (
            <div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoSelected(e.target.files?.[0] ?? null)}
              />
              <CameraCapture
                open={showCamera}
                onCapture={(f) => {
                  setShowCamera(false);
                  handlePhotoSelected(f);
                }}
                onClose={() => setShowCamera(false)}
              />
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => handlePhotoSelected(null)}
                    className="absolute top-2 right-2 bg-denim/70 text-white text-xs rounded-full h-6 w-6"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowCamera(true)}
                    className="py-4 rounded-xl border-2 border-dashed border-brass/40 text-dusk text-sm hover:bg-mist transition-colors"
                  >
                    📸 {type === 'photo' ? 'Take a photo' : 'Take a photo (optional)'}
                  </button>
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-4 rounded-xl border-2 border-dashed border-brass/40 text-dusk text-sm hover:bg-mist transition-colors"
                  >
                    🖼️ Library
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-dusk block mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border border-cardBorder rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={addMemory}
            disabled={saving || !canSave}
            className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['all', 'event', 'photo', 'milestone'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f
                ? 'bg-denim text-white border-denim'
                : 'bg-card text-dusk border-cardBorder'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-dusk text-center py-8">
          {memories.length > 0
            ? 'No matches for this filter.'
            : canManage(role)
              ? 'Nothing here yet — use the form above to add your first memory.'
              : 'Nothing here yet. Ask a manager to add one.'}
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((memory) => (
          <li
            key={memory.id}
            className={`bg-card rounded-2xl border shadow-card p-3 ${
              memory.type === 'milestone' ? 'border-brass' : 'border-cardBorder'
            }`}
          >
            {memory.type === 'event' ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-denim">{memory.body}</p>
                  <p className="text-xs text-dusk mt-0.5">{memory.event_date}</p>
                </div>
                {canManage(role) && (
                  <button
                    onClick={() => removeMemory(memory.id)}
                    className="text-xs text-dusk hover:text-rust shrink-0"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {memory.type === 'milestone' && <span className="text-brass">★</span>}
                    <p className="font-display text-denim">
                      {memory.type === 'milestone' ? memory.title : 'Photo'}
                    </p>
                  </div>
                  {canManage(role) && (
                    <button
                      onClick={() => removeMemory(memory.id)}
                      className="text-xs text-dusk hover:text-rust shrink-0"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {memory.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memory.photo_url}
                    alt={memory.title ?? memory.body ?? ''}
                    className="w-full h-48 object-cover rounded-xl mb-2"
                  />
                )}
                {memory.body && memory.type === 'photo' && (
                  <p className="text-sm text-dusk mb-1">{memory.body}</p>
                )}
                <p className="text-xs text-dusk">{memory.event_date}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
