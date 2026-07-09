// components/HomeMemoryTimelineClient.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { compressImageToBlob } from '@/lib/compress-image';
import { resilientInsert, resilientDelete } from '@/lib/resilient-write';
import { canManage, usePropertyRole } from '@/components/PropertyRoleContext';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MemoryType | 'all'>('all');

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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      <h1 className="text-2xl font-display text-charcoal mb-1">Home Memory Timeline</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        A running record of what's happened here — photos, milestones, and everyday moments.
      </p>

      {canManage(role) && (
        <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-2">
          <h2 className="font-display text-lg text-charcoal mb-1">Add to the timeline</h2>
          <div className="flex bg-cream rounded-full border border-gold-light/60 p-0.5 text-sm">
            {(['event', 'photo', 'milestone'] as MemoryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-full transition-colors ${
                  type === t ? 'bg-gold-dark text-white' : 'text-charcoal/60'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {type === 'milestone' && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Milestone title (e.g. First Shabbos in the new house)"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          )}

          {type === 'event' && (
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened (e.g. Grandma visited for lunch)"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          )}

          {type === 'photo' && (
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Caption (optional)"
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          )}

          {(type === 'photo' || type === 'milestone') && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhotoSelected(e.target.files?.[0] ?? null)}
              />
              {photoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={() => handlePhotoSelected(null)}
                    className="absolute top-2 right-2 bg-charcoal/70 text-cream text-xs rounded-full h-6 w-6"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-gold-light text-charcoal/60 text-sm hover:bg-gold-light/10 transition-colors"
                >
                  📸 {type === 'photo' ? 'Add a photo' : 'Add a photo (optional)'}
                </button>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-charcoal/50 block mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border border-gold-light/60 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={addMemory}
            disabled={saving || !canSave}
            className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
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
                ? 'bg-gold-dark text-white border-gold'
                : 'bg-white text-charcoal/60 border-gold-light/60'
            }`}
          >
            {f === 'all' ? 'All' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-charcoal/40 text-center py-8">
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
            className={`bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-3 ${
              memory.type === 'milestone' ? 'border border-gold' : ''
            }`}
          >
            {memory.type === 'event' ? (
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-charcoal">{memory.body}</p>
                  <p className="text-xs text-charcoal/40 mt-0.5">{memory.event_date}</p>
                </div>
                {canManage(role) && (
                  <button
                    onClick={() => removeMemory(memory.id)}
                    className="text-xs text-charcoal/30 hover:text-rust shrink-0"
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
                    {memory.type === 'milestone' && <span className="text-gold-dark">★</span>}
                    <p className="font-display text-charcoal">
                      {memory.type === 'milestone' ? memory.title : 'Photo'}
                    </p>
                  </div>
                  {canManage(role) && (
                    <button
                      onClick={() => removeMemory(memory.id)}
                      className="text-xs text-charcoal/30 hover:text-rust shrink-0"
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
                  <p className="text-sm text-charcoal/70 mb-1">{memory.body}</p>
                )}
                <p className="text-xs text-charcoal/40">{memory.event_date}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
