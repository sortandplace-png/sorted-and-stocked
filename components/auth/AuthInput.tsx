// components/auth/AuthInput.tsx
// Always-visible uppercase label above the field, not a placeholder that
// disappears once you type -- the real interaction pattern from the
// finished Figma design, not just a palette swap of the old placeholder-
// only inputs. Error color (#C0504D) is specific to this auth-form
// design, deliberately not the app's general `rust` alert token (a
// slightly different value) -- kept literal to match Figma exactly.
'use client';

import { useState, type InputHTMLAttributes } from 'react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
}

export default function AuthInput({ label, id, error, className, ...rest }: AuthInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={`font-interDisplay text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors ${
          focused ? 'text-denimBlue' : 'text-dusk'
        }`}
      >
        {label}
      </label>
      <input
        id={id}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        className={`font-interDisplay text-[15px] text-denim bg-white rounded-[10px] px-4 py-3 w-full outline-none transition-shadow ${className ?? ''}`}
        style={{
          border: `1.5px solid ${error ? '#C0504D' : focused ? '#6B8DBE' : '#E8DDD0'}`,
          boxShadow: focused ? '0 0 0 3px rgba(107,141,190,.14)' : 'none',
        }}
      />
      {error && <span className="text-[12px] -mt-0.5" style={{ color: '#C0504D' }}>{error}</span>}
    </div>
  );
}
