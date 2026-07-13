'use client';

import React, { useState, useEffect, useRef } from 'react';

type Timer = {
  id: string;
  name: string;
  secondsLeft: number;
  isActive: boolean;
};

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function playAlarm() {
  // Basic Web Audio API oscillator to bypass asset loading issues
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 1.5;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High clear beep

    // Pulse effect
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.error('AudioContext failed to clear:', e);
  }
}

// Supports multiple simultaneous named timers (e.g. "Rice" + "Chicken"
// running at once) — reused as-is on both its original standalone page
// (/tools/kitchen-timer) and the new floating popup on the Recipes page,
// rather than building a second, separate timer component.
// initialName/initialMinutes let a caller (e.g. opening the timer from a
// specific recipe) pre-fill the add-timer form with that recipe's own
// approx_total_minutes -- still just a starting point in the form, not an
// auto-started timer, since the user may want to adjust before starting.
export default function KitchenTimerClient({
  initialName,
  initialMinutes,
}: {
  initialName?: string;
  initialMinutes?: number | null;
} = {}) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [newName, setNewName] = useState(initialName ?? '');
  const [newMinutes, setNewMinutes] = useState(
    initialMinutes != null ? String(initialMinutes) : '5'
  );
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const hasActive = timers.some((t) => t.isActive && t.secondsLeft > 0);
    if (!hasActive) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    tickRef.current = setInterval(() => {
      setTimers((prev) => {
        let anyFinished = false;
        const next = prev.map((t) => {
          if (!t.isActive || t.secondsLeft <= 0) return t;
          const secondsLeft = t.secondsLeft - 1;
          if (secondsLeft === 0) anyFinished = true;
          return { ...t, secondsLeft, isActive: secondsLeft > 0 };
        });
        if (anyFinished) playAlarm();
        return next;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers.some((t) => t.isActive && t.secondsLeft > 0)]);

  function addTimer() {
    const minutes = parseFloat(newMinutes);
    if (!minutes || minutes <= 0) return;
    setTimers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newName.trim() || 'Timer',
        secondsLeft: Math.round(minutes * 60),
        isActive: true,
      },
    ]);
    setNewName('');
    setNewMinutes('5');
  }

  function toggleTimer(id: string) {
    setTimers((prev) => prev.map((t) => (t.id === id && t.secondsLeft > 0 ? { ...t, isActive: !t.isActive } : t)));
  }

  function removeTimer(id: string) {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="bg-white border border-gold-light/40 rounded-2xl p-5 shadow-xl max-w-sm mx-auto text-charcoal">
      <div className="text-center mb-4">
        <span className="text-xs uppercase tracking-widest text-charcoal/50 font-semibold">Kitchen Companion</span>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name (e.g. Rice)"
          className="flex-1 min-w-0 bg-cream/40 border border-gold-light/60 rounded-xl px-3 py-2 text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <input
          value={newMinutes}
          onChange={(e) => setNewMinutes(e.target.value)}
          type="number"
          min="0.5"
          step="0.5"
          placeholder="Min"
          className="w-16 bg-cream/40 border border-gold-light/60 rounded-xl px-2 py-2 text-sm text-charcoal text-center focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <button
          onClick={addTimer}
          className="min-h-11 px-4 rounded-xl bg-gold-dark text-white font-medium text-sm shrink-0 hover:opacity-90 transition"
        >
          Add
        </button>
      </div>

      {timers.length === 0 && (
        <p className="text-center text-sm text-charcoal/40 py-4">No timers running. Add one above.</p>
      )}

      <div className="space-y-2">
        {timers.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-cream/60 rounded-xl px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-charcoal">{t.name}</p>
              <p className={`text-2xl font-mono font-bold tracking-tight ${t.secondsLeft === 0 ? 'text-rust' : 'text-gold-dark'}`}>
                {formatTime(t.secondsLeft)}
              </p>
            </div>
            <button
              onClick={() => toggleTimer(t.id)}
              disabled={t.secondsLeft === 0}
              className={`min-h-11 min-w-[4.5rem] px-3 rounded-xl font-semibold text-sm transition active:scale-95 ${
                t.secondsLeft === 0
                  ? 'bg-gold-light/20 text-charcoal/30 cursor-not-allowed border border-gold-light/40'
                  : t.isActive
                  ? 'bg-gold text-charcoal hover:bg-gold-light'
                  : 'bg-sage text-white hover:opacity-90'
              }`}
            >
              {t.secondsLeft === 0 ? 'Done' : t.isActive ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => removeTimer(t.id)}
              aria-label={`Remove ${t.name} timer`}
              className="min-h-11 min-w-11 flex items-center justify-center text-rust/70 hover:text-rust"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
