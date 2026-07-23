// components/Toast.tsx
'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Toast = {
  id: string;
  message: string;
  variant: 'default' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  durationMs: number;
};

type ToastOptions = {
  variant?: Toast['variant'];
  action?: Toast['action'];
  durationMs?: number;
};

const ToastContext = createContext<{
  showToast: (message: string, options?: ToastOptions) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = crypto.randomUUID();
    const toast: Toast = {
      id,
      message,
      variant: options?.variant ?? 'default',
      action: options?.action,
      durationMs: options?.durationMs ?? (options?.action ? 5000 : 3000),
    };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Positioned above the fixed bottom nav (which is ~64px tall). */}
      <div className="fixed bottom-20 inset-x-0 flex flex-col items-center gap-2 z-50 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              'pointer-events-auto max-w-sm w-full rounded-full shadow-lg px-5 py-3 flex items-center justify-between gap-3 text-sm text-white ' +
              (toast.variant === 'error'
                ? 'bg-rust'
                : toast.variant === 'success'
                ? 'bg-sage'
                : 'bg-denim')
            }
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="font-semibold underline shrink-0"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be used within ToastProvider');
  return ctx.showToast;
}
