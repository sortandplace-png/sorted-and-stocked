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
};

const ELEMENT_ID = 'qr-reader';

export default function QRScanner({ onScan, onError, active = true, debounceMs = 2000 }: QRScannerProps) {
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

  return <div id={ELEMENT_ID} className="w-full max-w-md mx-auto rounded-lg overflow-hidden" />;
}
