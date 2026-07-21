// components/ShiftHandoverClient.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert } from '@/lib/resilient-write';
import { compressImageToDataUrl } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';
import CameraCapture from '@/components/CameraCapture';
import { Camera, Image as ImageIcon, Mic, Square, X } from 'lucide-react';

type Handover = {
  id: string;
  note_text: string | null;
  photo_data_url: string | null;
  photo_data_urls: string[] | null;
  audio_data_url: string | null;
  template_tag: string | null;
  created_at: string;
  created_by_name: string | null;
};

const MAX_RECORDING_SECONDS = 20;
const PHOTO_MAX_DIMENSION = 900; // px — keeps the base64 payload reasonable

const QUICK_TEMPLATES = ['Dinner staged', 'Fridge restocked', 'Issue reported'] as const;

function resizeImageFile(file: File): Promise<string> {
  return compressImageToDataUrl(file, { maxDimension: PHOTO_MAX_DIMENSION });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ShiftHandoverClient({ propertyId }: { propertyId: string }) {
  const t = useTranslations('shiftHandover');
  // A real starting structure, not vanishing placeholder text -- lands in
  // the textarea itself so there's something to edit around instead of a
  // blank field, the actual friction point (zero handovers had ever been
  // logged against this component before this change).
  const templateText = `${t('whatsDone')} \n${t('inProgress')} \n${t('headsUp')} \n`;

  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState(templateText);
  const [templateTag, setTemplateTag] = useState<string | null>(null);
  const [photoDataUrls, setPhotoDataUrls] = useState<string[]>([]);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const showToast = useToast();

  const loadHandovers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shift_handovers')
      .select('id, note_text, photo_data_url, photo_data_urls, audio_data_url, template_tag, created_at, profiles(full_name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setHandovers(
        (data ?? []).map((h) => ({
          id: h.id,
          note_text: h.note_text,
          photo_data_url: h.photo_data_url,
          photo_data_urls: h.photo_data_urls,
          audio_data_url: h.audio_data_url,
          template_tag: h.template_tag,
          created_at: h.created_at,
          created_by_name:
            (h.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        }))
      );
    }
    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    loadHandovers();
  }, [loadHandovers]);

  // Viewing this tab marks handovers as read for this user — real
  // persisted state (shift_handover_reads), not a decorative badge.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('shift_handover_reads')
        .upsert(
          { property_id: propertyId, user_id: user.id, last_read_at: new Date().toISOString() },
          { onConflict: 'property_id,user_id' }
        );
    })();
  }, [propertyId, supabase]);

  function applyTemplate(template: string) {
    setTemplateTag((prev) => (prev === template ? null : template));
    if (!noteText.trim()) setNoteText(template);
  }

  async function handleGalleryFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    try {
      const dataUrls = await Promise.all(files.map(resizeImageFile));
      setPhotoDataUrls((prev) => [...prev, ...dataUrls]);
    } catch {
      showToast('Could not read that photo.', { variant: 'error' });
    } finally {
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  // One capture per open -- CameraCapture hands back a single File per
  // shot (it's a live getUserMedia feed, not a multi-select picker), so
  // repeated taps of "Photo" reopen it and append one at a time, same end
  // result as the old multi-select camera input.
  async function handleCameraFile(file: File) {
    setShowCamera(false);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoDataUrls((prev) => [...prev, dataUrl]);
    } catch {
      showToast('Could not read that photo.', { variant: 'error' });
    }
  }

  function removePhoto(index: number) {
    setPhotoDataUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const dataUrl = await blobToDataUrl(blob);
        setAudioDataUrl(dataUrl);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      showToast('Microphone access denied or unavailable.', { variant: 'error' });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resetForm() {
    setNoteText(templateText);
    setTemplateTag(null);
    setPhotoDataUrls([]);
    setAudioDataUrl(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  async function submitHandover() {
    // The template's own labels aren't real content -- someone who never
    // typed anything into it shouldn't be able to submit that as if it
    // were a note.
    const noteIsUnedited = noteText.trim() === templateText.trim();
    if (noteIsUnedited && photoDataUrls.length === 0 && !audioDataUrl) {
      showToast('Add a note, photo, or recording first.', { variant: 'error' });
      return;
    }
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      showToast('Not signed in.', { variant: 'error' });
      return;
    }

    const result = await resilientInsert(supabase, 'shift_handovers', {
      property_id: propertyId,
      created_by: user.id,
      note_text: noteIsUnedited ? null : noteText.trim() || null,
      photo_data_url: photoDataUrls[0] ?? null, // kept for older readers of the single-photo column
      photo_data_urls: photoDataUrls.length > 0 ? photoDataUrls : null,
      audio_data_url: audioDataUrl,
      template_tag: templateTag,
    });

    setSubmitting(false);

    if (!result.ok) {
      showToast('Failed to save handover.', { variant: 'error' });
      return;
    }

    showToast(
      result.queued ? 'Saved — will sync when back online.' : 'Handover note left for the next shift.',
      { variant: 'success' }
    );

    // Same fire-and-forget precedent as the task-assignment hook -- only
    // when the write actually landed, never blocks the handover flow itself.
    if (!result.queued) {
      fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          trigger: 'shift_handover',
          noteText: noteIsUnedited ? 'New shift handover (photo/audio) added.' : noteText.trim(),
        }),
      }).catch(() => {});
    }

    resetForm();
    loadHandovers();
  }

  function timeAgo(iso: string) {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString();
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-display text-denim mb-1">Shift Handover</h1>
      <p className="text-sm text-dusk mb-4">
        Leave a quick note for whoever's coming on next — no long write-up needed.
      </p>

      <CameraCapture open={showCamera} onCapture={handleCameraFile} onClose={() => setShowCamera(false)} />

      <div className="bg-card rounded-xl2 shadow-card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TEMPLATES.map((template) => (
            <button
              key={template}
              onClick={() => applyTemplate(template)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                templateTag === template
                  ? 'bg-denim text-white border-denim'
                  : 'bg-mist text-dusk border-brass/30'
              }`}
            >
              {template}
            </button>
          ))}
        </div>

        <textarea
          ref={noteTextareaRef}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="e.g. Dinner prep is staged in the fridge, just needs reheating…"
          rows={5}
          className="w-full border border-brass/30 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 rounded-xl2 px-4 py-3 bg-mist text-sm text-denim"
        />

        {photoDataUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photoDataUrls.map((url, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-20 rounded-lg object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-denim/70 text-white rounded-full h-5 w-5 flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* Real camera access (CameraCapture, getUserMedia), not a
              file-input hint -- confirmed live that even an isolated input
              with capture="environment" still opened the gallery picker
              instead of the camera on a real device. Library stays a plain
              multi-select file input -- that path always worked correctly. */}
          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-mist border border-brass/30 text-denim text-sm font-medium"
          >
            <Camera className="h-4 w-4" />
            {photoDataUrls.length > 0 ? `+ (${photoDataUrls.length})` : 'Photo'}
          </button>
          <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-mist border border-brass/30 text-denim text-sm font-medium cursor-pointer">
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryFiles}
              className="hidden"
            />
            <ImageIcon className="h-4 w-4" />
            Library
          </label>

          {!recording ? (
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-mist border border-brass/30 text-denim text-sm font-medium"
            >
              <Mic className="h-4 w-4" />
              {audioDataUrl ? 'Re-record' : 'Record'}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full bg-rust text-white text-sm font-medium animate-pulse"
            >
              <Square className="h-4 w-4" fill="currentColor" />
              Stop ({MAX_RECORDING_SECONDS - recordSeconds}s left)
            </button>
          )}
        </div>

        {audioDataUrl && (
          <audio controls src={audioDataUrl} className="w-full h-10" />
        )}

        <button
          onClick={submitHandover}
          disabled={submitting}
          className="w-full py-2.5 rounded-full bg-denim text-white font-medium disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Leave handover note'}
        </button>
      </div>

      <h2 className="font-display text-lg text-denim mb-2">Recent handovers</h2>
      {loading ? (
        <SkeletonList rows={3} />
      ) : handovers.length === 0 ? (
        <div className="text-center mt-4 py-6 bg-card rounded-xl2 shadow-card">
          <p className="text-sm text-dusk mb-3">No handovers yet.</p>
          <button
            onClick={() => noteTextareaRef.current?.focus()}
            className="text-sm font-medium text-white bg-denim px-4 py-2 rounded-full"
          >
            Create end of day note
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {handovers.map((h) => {
            const photos = h.photo_data_urls && h.photo_data_urls.length > 0 ? h.photo_data_urls : h.photo_data_url ? [h.photo_data_url] : [];
            return (
              <li key={h.id} className="bg-card rounded-xl2 shadow-card p-4">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                  <span className="text-sm font-medium text-denim">
                    {h.created_by_name ?? 'Someone'}
                  </span>
                  <div className="flex items-center gap-2">
                    {h.template_tag && (
                      <span className="text-[10px] font-medium bg-brass/15 text-brass px-2 py-0.5 rounded-full">
                        {h.template_tag}
                      </span>
                    )}
                    <span className="text-xs text-dusk">{timeAgo(h.created_at)}</span>
                  </div>
                </div>
                {h.note_text && <p className="text-sm text-denim mb-2">{h.note_text}</p>}
                {photos.length > 0 && (
                  <div className={`grid gap-2 mb-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                    ))}
                  </div>
                )}
                {h.audio_data_url && (
                  <audio controls src={h.audio_data_url} className="w-full h-10" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
