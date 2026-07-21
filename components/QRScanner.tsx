// components/QRScanner.tsx
// Requires: npm install html5-qrcode
'use client';

import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';

type QRScannerProps = {
  onScan: (decodedText: string) => void;
  onError?: (message: string) => void;
  active?: boolean; // pass false to pause without unmounting
  debounceMs?: number; // default 2000, matches the original single-scan flow
  torchOn?: boolean; // rear-camera flashlight, where the device/browser supports it
};

const ELEMENT_ID = 'qr-reader';

export default function QRScanner({ onScan, onError, active = true, debounceMs = 2000, torchOn = false }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  useEffect(() => {
    if (!active) return;

    const scanner = new Html5Qrcode(ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' }, // rear camera — this is a scanning tool, not a selfie cam
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Debounce: html5-qrcode fires repeatedly while the code stays in frame.
          const now = Date.now();
          if (decodedText === lastScanRef.current.text && now - lastScanRef.current.at < debounceMs) {
            return;
          }
          lastScanRef.current = { text: decodedText, at: now };
          onScan(decodedText);
        },
        () => {
          // Per-frame "no code found" callback — expected noise, ignore it.
        }
      )
      .catch((err) => onError?.(String(err)));

    return () => {
      try {
        const state = scanner.getState();
        const isRunning =
          state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED;

        if (!isRunning) return;

        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            /* already stopped */
          });
      } catch {
        // stop()/getState() can throw synchronously (not a rejected promise)
        // when called before start() has actually reached a running state —
        // e.g. React StrictMode's mount->cleanup->mount cycle. Safe to ignore.
      }
    };
  }, [active, onScan, onError, debounceMs]);

  // Separate from the start/stop lifecycle above -- toggling the flashlight
  // shouldn't restart the whole scan session. `torch` is a real W3C Image
  // Capture API constraint (works on the rear camera in Android Chrome;
  // iOS Safari has no torch API at all as of this writing) -- not in
  // TypeScript's bundled MediaTrackConstraintSet typings yet, hence the cast.
  useEffect(() => {
    if (!active) return;
    const scanner = scannerRef.current;
    if (!scanner) return;
    // Real crash confirmed in testing, not a hypothetical: when the camera
    // never actually reached a running state (permission denied, no
    // camera, blocked entirely), applyVideoConstraints THROWS synchronously
    // ("Scanning is not in running state...") instead of rejecting its
    // promise -- the .catch() below can't reach a throw that happens
    // before the promise is even returned, so it crashed the whole page.
    // Guard with a real state check, and keep the try/catch as a second
    // layer in case some environment still throws synchronously despite it.
    const state = scanner.getState();
    if (state !== Html5QrcodeScannerState.SCANNING && state !== Html5QrcodeScannerState.PAUSED) {
      return;
    }
    try {
      scanner
        .applyVideoConstraints({ advanced: [{ torch: torchOn } as unknown as MediaTrackConstraintSet] })
        .catch(() => {
          // Device/browser doesn't support torch control -- the toggle just
          // won't visibly do anything there, nothing to surface as an error.
        });
    } catch {
      // Same "not running" class of error, thrown synchronously -- no-op.
    }
  }, [torchOn, active]);

  return <div id={ELEMENT_ID} className="w-full max-w-md mx-auto rounded-lg overflow-hidden" />;
}
