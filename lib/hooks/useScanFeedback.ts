import { useState, useCallback } from 'react';

export type FeedbackType = 'success' | 'error' | 'warning';

export function useScanFeedback() {
  const [flashStatus, setFlashStatus] = useState<FeedbackType | null>(null);

  const triggerFeedback = useCallback((type: FeedbackType) => {
    setFlashStatus(type);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'success') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.setValueAtTime(0.01, now + 0.15);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(150, now + 0.2);
        gain2.gain.setValueAtTime(0.4, now + 0.2);
        gain2.gain.setValueAtTime(0.01, now + 0.35);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.15);
        osc2.start(now + 0.2);
        osc2.stop(now + 0.35);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }

    setTimeout(() => {
      setFlashStatus(null);
    }, 400);
  }, []);

  const getFlashClass = (): string => {
    if (!flashStatus) return 'border-transparent';
    if (flashStatus === 'success') return 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.4)]';
    if (flashStatus === 'error') return 'border-rose-500 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.4)]';
    return 'border-amber-500 bg-amber-500/10 shadow-[0_0_40px_rgba(245,158,11,0.4)]';
  };

  return {
    triggerFeedback,
    getFlashClass,
    activeFlash: flashStatus,
  };
}
