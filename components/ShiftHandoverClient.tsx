// components/ShiftHandoverClient.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resilientInsert } from '@/lib/resilient-write';
import { compressImageToDataUrl } from '@/lib/compress-image';
import { useToast } from '@/components/Toast';
import { SkeletonList } from '@/components/Skeleton';

type Handover = {
  id: string;
  note_text: string | null;
  photo_data_url: string | null;
  audio_data_url: string | null;
  created_at: string;
  created_by_name: string | null;
};

const MAX_RECORDING_SECONDS = 20;
const PHOTO_MAX_DIMENSION = 900; // px — keeps the base64 payload reasonable

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
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);

  const [noteText, setNoteText] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const showToast = useToast();

  const loadHandovers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shift_handovers')
      .select('id, note_text, photo_data_url, audio_data_url, created_at, profiles(full_name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) {
      setHandovers(
        (data ?? []).map((h) => ({
          id: h.id,
          note_text: h.note_text,
          photo_data_url: h.photo_data_url,
          audio_data_url: h.audio_data_url,
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

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      showToast('Could not read that photo.', { variant: 'error' });
    }
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
    setNoteText('');
    setPhotoDataUrl(null);
    setAudioDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submitHandover() {
    if (!noteText.trim() && !photoDataUrl && !audioDataUrl) {
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
      note_text: noteText.trim() || null,
      photo_data_url: photoDataUrl,
      audio_data_url: audioDataUrl,
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
      <h1 className="text-2xl font-display text-charcoal mb-1">Shift Handover</h1>
      <p className="text-sm text-charcoal/50 mb-4">
        Leave a quick note for whoever's coming on next — no long write-up needed.
      </p>

      <div className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4 mb-6 space-y-3">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="e.g. Dinner prep is staged in the fridge, just needs reheating…"
          rows={3}
          className="w-full border border-gold-light/60 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 rounded-2xl px-4 py-3 bg-cream/40 text-sm"
        />

        {photoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt="" className="w-full rounded-xl max-h-48 object-cover" />
        )}

        <div className="flex gap-2">
          <label className="flex-1 text-center py-2 rounded-full border border-charcoal/30 text-charcoal text-sm font-medium cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFile}
              className="hidden"
            />
            📷 {photoDataUrl ? 'Retake' : 'Photo'}
          </label>

          {!recording ? (
            <button
              onClick={startRecording}
              className="flex-1 py-2 rounded-full border border-charcoal/30 text-charcoal text-sm font-medium"
            >
              🎙️ {audioDataUrl ? 'Re-record' : 'Record'}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 py-2 rounded-full bg-rust text-white text-sm font-medium animate-pulse"
            >
              ⏹ Stop ({MAX_RECORDING_SECONDS - recordSeconds}s left)
            </button>
          )}
        </div>

        {audioDataUrl && (
          <audio controls src={audioDataUrl} className="w-full h-10" />
        )}

        <button
          onClick={submitHandover}
          disabled={submitting}
          className="w-full py-2.5 rounded-full bg-charcoal text-cream font-medium disabled:opacity-40"
        >
          {submitting ? 'Saving…' : 'Leave handover note'}
        </button>
      </div>

      <h2 className="font-display text-lg text-charcoal mb-2">Recent handovers</h2>
      {loading ? (
        <SkeletonList rows={3} />
      ) : handovers.length === 0 ? (
        <p className="text-sm text-charcoal/40 text-center mt-4">No handover notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {handovers.map((h) => (
            <li key={h.id} className="bg-white rounded-2xl shadow-sm shadow-charcoal/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-charcoal">
                  {h.created_by_name ?? 'Someone'}
                </span>
                <span className="text-xs text-charcoal/40">{timeAgo(h.created_at)}</span>
              </div>
              {h.note_text && <p className="text-sm text-charcoal mb-2">{h.note_text}</p>}
              {h.photo_data_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.photo_data_url}
                  alt=""
                  className="w-full rounded-xl max-h-48 object-cover mb-2"
                />
              )}
              {h.audio_data_url && (
                <audio controls src={h.audio_data_url} className="w-full h-10" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
