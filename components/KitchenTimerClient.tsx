'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function KitchenTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      if (timerRef.current) clearInterval(timerRef.current);
      playAlarm();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, secondsLeft]);

  const playAlarm = () => {
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
      console.error("AudioContext failed to clear:", e);
    }
  };

  const addTime = (minutes: number) => {
    setSecondsLeft((prev) => prev + minutes * 60);
  };

  const toggleTimer = () => {
    if (secondsLeft > 0) setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-aubergine-dark border border-aubergine/40 rounded-2xl p-6 shadow-xl max-w-sm mx-auto text-cream">
      <div className="text-center mb-4">
        <span className="text-xs uppercase tracking-widest text-cream/50 font-semibold">Kitchen Companion</span>
      </div>

      {/* Huge Visibility Display */}
      <div className="text-center text-6xl font-mono font-bold tracking-tight my-4 text-gold-light">
        {formatTime(secondsLeft)}
      </div>

      {/* Quick Interval Preset Buttons */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[1, 5, 10, 15].map((mins) => (
          <button
            key={mins}
            onClick={() => addTime(mins)}
            className="bg-aubergine/60 hover:bg-aubergine/80 active:scale-95 transition text-sm font-medium py-3 px-2 rounded-xl border border-cream/10"
          >
            +{mins}m
          </button>
        ))}
      </div>

      {/* Primary Action Controls */}
      <div className="flex gap-3">
        <button
          onClick={toggleTimer}
          disabled={secondsLeft === 0}
          className={`flex-1 py-4 rounded-xl font-bold text-lg transition active:scale-95 ${
            secondsLeft === 0
              ? 'bg-aubergine/40 text-cream/30 cursor-not-allowed border border-cream/10'
              : isActive
              ? 'bg-gold text-aubergine-dark hover:bg-gold-light'
              : 'bg-sage text-aubergine-dark hover:opacity-90'
          }`}
        >
          {isActive ? 'Pause' : 'Start'}
        </button>

        <button
          onClick={resetTimer}
          className="bg-rust/20 hover:bg-rust/30 border border-rust/40 text-rust px-6 rounded-xl font-medium transition active:scale-95"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
