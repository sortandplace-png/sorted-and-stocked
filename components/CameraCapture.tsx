// components/CameraCapture.tsx
// Real camera access, not a file-input hint. `capture="environment"` on a
// plain <input type="file"> is a suggestion browsers are free to ignore --
// confirmed live, tested on a real device, still opened Files instead of
// the camera even with a dedicated input isolated from the gallery
// picker. The only way to *guarantee* the camera (rather than hope the OS
// picker defaults to it) is to request the stream directly and capture a
// frame from a live video element -- this is that.
//
// Shared by every "Take Photo" button in the app (Quick Photo, Photo
// Worklist, Shift Handover, the price/recipe scanner, Ingredient
// Scanner) rather than duplicating getUserMedia handling 5 times.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

export default function CameraCapture({
  open,
  onCapture,
  onClose,
}: {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'denied' | 'unsupported' | 'error'>('starting');

  useEffect(() => {
    if (!open) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    setStatus('starting');

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-end p-3">
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-0">
        {status === 'ready' && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video ref={videoRef} autoPlay playsInline muted className="max-h-full max-w-full" />
        )}
        {status === 'starting' && <p className="text-white/70 text-sm">Starting camera…</p>}
        {status === 'denied' && (
          <div className="text-center px-6">
            <p className="text-white text-sm mb-1">Camera access was denied.</p>
            <p className="text-white/60 text-xs">Allow camera access in your browser settings, or use "Choose from Library" instead.</p>
          </div>
        )}
        {(status === 'unsupported' || status === 'error') && (
          <div className="text-center px-6">
            <p className="text-white text-sm mb-1">Couldn't open the camera.</p>
            <p className="text-white/60 text-xs">Use "Choose from Library" instead.</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center p-6">
        <button
          onClick={capture}
          disabled={status !== 'ready'}
          aria-label="Take photo"
          className="w-16 h-16 rounded-full bg-white flex items-center justify-center disabled:opacity-30"
        >
          <Camera size={26} className="text-black" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
