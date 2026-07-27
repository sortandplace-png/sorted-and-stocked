// components/PhotoCropper.tsx
// Crop step between choosing a photo and saving it.
//
// Why this exists: staff photograph on phones and frame badly -- the owner's
// Cotton Swabs photo is framed on the barcode rather than the product, and
// before this the only options were retake or keep it. It matters twice over
// for Print Labels, where a 2"x2" label shrinks the photo to a small square,
// so a barcode-framed shot becomes an unreadable grey block on the shelf.
//
// DESIGN NOTE -- the one thing worth understanding here:
// the crop rectangle is stored in the image's NATURAL pixel coordinates, and
// zoom is a pure display transform. They never mix. That means zooming can't
// drift the crop, and the rect handed to cropImageToBlob() is already in the
// space drawImage() expects. The alternative (storing screen coords and
// converting at save time) is where crop tools usually go subtly wrong.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCw, Check, X, ZoomIn } from 'lucide-react';
import {
  cropImageToBlob,
  labelThumbDataUrl,
  loadImageFromSrc,
  type CropRect,
  type Rotation,
} from '@/lib/compress-image';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

const MIN_CROP_PX = 40;

export default function PhotoCropper({
  src,
  onCancel,
  onCropped,
}: {
  src: string;
  onCancel: () => void;
  /** Receives the cropped, compressed JPEG. Nothing is uploaded here -- the
   *  caller decides what to do with it, so this stays usable by every flow. */
  onCropped: (blob: Blob) => void | Promise<void>;
}) {
  const t = useTranslations('photoCrop');
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag state kept in a ref: it changes every pointermove and must not
  // re-render on each frame.
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImageFromSrc(src)
      .then((img) => {
        if (cancelled) return;
        setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        // Start at the full image rather than a guessed centre box -- the
        // person can always pull in, and starting full means "confirm with no
        // changes" is a no-op instead of a silent crop.
        setCrop({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight });
      })
      .catch(() => !cancelled && setError(t('loadFailed')));
    return () => {
      cancelled = true;
    };
  }, [src, t]);

  // Displayed size of the image before zoom -- fit into the stage box.
  // Recomputed via ResizeObserver, not just on mount: measuring once left the
  // image at its mount-time scale, so turning the phone sideways -- which is
  // exactly what someone does with a sideways photo -- pushed the image and
  // its crop frame off the edge of the screen.
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const stage = stageRef.current;
    if (!natural || !stage) return;
    const measure = () => {
      const box = stage.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const swapped = rotation === 90 || rotation === 270;
      const w = swapped ? natural.h : natural.w;
      const h = swapped ? natural.w : natural.h;
      setFit(Math.min(box.width / w, box.height / h, 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [natural, rotation]);

  const scale = fit * zoom;

  const refreshThumb = useCallback(
    async (c: CropRect, r: Rotation) => {
      try {
        setThumb(await labelThumbDataUrl(src, c, r));
      } catch {
        setThumb(null);
      }
    },
    [src]
  );

  useEffect(() => {
    if (crop) refreshThumb(crop, rotation);
  }, [crop, rotation, refreshThumb]);

  function onPointerDown(e: React.PointerEvent, handle: Handle) {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...crop } };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !natural) return;
    // Screen delta -> natural pixels. Dividing by `scale` is what keeps the
    // crop correct at any zoom level.
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const s = d.start;
    let next: CropRect;

    if (d.handle === 'move') {
      next = {
        ...s,
        x: Math.min(Math.max(0, s.x + dx), natural.w - s.width),
        y: Math.min(Math.max(0, s.y + dy), natural.h - s.height),
      };
    } else {
      // Free-form: each corner moves independently, no aspect lock. Tall
      // bottles and wide boxes both exist.
      let { x, y, width, height } = s;
      if (d.handle === 'nw') {
        x = Math.min(s.x + dx, s.x + s.width - MIN_CROP_PX);
        y = Math.min(s.y + dy, s.y + s.height - MIN_CROP_PX);
        width = s.width + (s.x - x);
        height = s.height + (s.y - y);
      } else if (d.handle === 'ne') {
        y = Math.min(s.y + dy, s.y + s.height - MIN_CROP_PX);
        width = Math.max(MIN_CROP_PX, s.width + dx);
        height = s.height + (s.y - y);
      } else if (d.handle === 'sw') {
        x = Math.min(s.x + dx, s.x + s.width - MIN_CROP_PX);
        width = s.width + (s.x - x);
        height = Math.max(MIN_CROP_PX, s.height + dy);
      } else {
        width = Math.max(MIN_CROP_PX, s.width + dx);
        height = Math.max(MIN_CROP_PX, s.height + dy);
      }
      x = Math.max(0, x);
      y = Math.max(0, y);
      next = {
        x,
        y,
        width: Math.min(width, natural.w - x),
        height: Math.min(height, natural.h - y),
      };
    }
    setCrop(next);
  }

  function endDrag(e: React.PointerEvent) {
    if (drag.current) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    }
    drag.current = null;
  }

  function rotate() {
    setRotation((r) => (((r + 90) % 360) as Rotation));
  }

  async function confirm() {
    if (!crop) return;
    setBusy(true);
    setError(null);
    try {
      // Compression runs inside cropImageToBlob, AFTER the crop, so the image
      // is encoded once rather than cropped-then-recompressed.
      const blob = await cropImageToBlob(src, crop, rotation);
      await onCropped(blob);
    } catch {
      setError(t('cropFailed'));
      setBusy(false);
    }
  }

  const swapped = rotation === 90 || rotation === 270;
  const dispW = natural ? (swapped ? natural.h : natural.w) * scale : 0;
  const dispH = natural ? (swapped ? natural.w : natural.h) * scale : 0;

  return (
    <div className="fixed inset-0 z-[90] bg-denim/95 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onCancel} aria-label={t('cancel')} className="w-11 h-11 flex items-center justify-center">
          <X size={20} strokeWidth={1.75} />
        </button>
        <span className="font-display text-lg">{t('title')}</span>
        <button
          onClick={confirm}
          disabled={busy || !crop}
          aria-label={t('save')}
          className="w-11 h-11 flex items-center justify-center disabled:opacity-40"
        >
          <Check size={20} strokeWidth={2} />
        </button>
      </div>

      {error && <p className="mx-4 mb-2 text-xs text-white bg-rust rounded-xl2 px-3 py-2">{error}</p>}

      <div ref={stageRef} className="flex-1 relative overflow-hidden flex items-center justify-center touch-none">
        {natural && crop && (
          <div className="relative" style={{ width: dispW, height: dispH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-fill select-none"
            />
            {/* Dim everything outside the selection so the crop reads at a
                glance on a small screen. */}
            <div
              className="absolute inset-0 bg-black/50"
              style={{
                clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                  ${(crop.x * scale * 100) / dispW}% ${(crop.y * scale * 100) / dispH}%,
                  ${(crop.x * scale * 100) / dispW}% ${((crop.y + crop.height) * scale * 100) / dispH}%,
                  ${((crop.x + crop.width) * scale * 100) / dispW}% ${((crop.y + crop.height) * scale * 100) / dispH}%,
                  ${((crop.x + crop.width) * scale * 100) / dispW}% ${(crop.y * scale * 100) / dispH}%,
                  ${(crop.x * scale * 100) / dispW}% ${(crop.y * scale * 100) / dispH}%)`,
              }}
            />
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="absolute border-2 border-brass cursor-move"
              style={{
                left: crop.x * scale,
                top: crop.y * scale,
                width: crop.width * scale,
                height: crop.height * scale,
              }}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                <span
                  key={h}
                  onPointerDown={(e) => onPointerDown(e, h)}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  // 44px hit area for a thumb, with a smaller visible dot.
                  className="absolute w-11 h-11 flex items-center justify-center"
                  style={{
                    left: h[1] === 'w' ? -22 : undefined,
                    right: h[1] === 'e' ? -22 : undefined,
                    top: h[0] === 'n' ? -22 : undefined,
                    bottom: h[0] === 's' ? -22 : undefined,
                    cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-brass border-2 border-white" />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border-t border-cardBorder p-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* Label preview: this is what Print Labels will actually show, and
              it's the reason framing matters beyond looking nice full-size. */}
          <div className="shrink-0 text-center">
            <div className="w-16 h-16 rounded-xl2 border border-cardBorder overflow-hidden bg-mist">
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-[10px] text-dusk mt-1">{t('labelPreview')}</p>
          </div>

          <div className="flex-1 space-y-2">
            <label className="flex items-center gap-2">
              <ZoomIn size={14} className="text-brass shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">{t('zoom')}</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brass"
              />
            </label>
            <button
              onClick={rotate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-denim border border-cardBorder rounded-full px-3 py-1.5"
            >
              <RotateCw size={14} strokeWidth={1.75} aria-hidden="true" /> {t('rotate')}
            </button>
          </div>
        </div>

        <button
          onClick={confirm}
          disabled={busy || !crop}
          className="w-full py-2.5 rounded-full bg-denim text-white text-sm font-medium disabled:opacity-40"
        >
          {busy ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
