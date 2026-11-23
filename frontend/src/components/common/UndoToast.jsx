import React, { useEffect, useState, useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';

export default function UndoToast({ toast, onUndo, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const toastId = toast?.id;
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!toastId) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setProgress(100);
    const duration = 5000;
    const stepMs = 50;
    const startTime = Date.now();

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPercent = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPercent);
    }, stepMs);

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      dismissRef.current?.();
    }, duration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [toastId]);

  if (!toast) return null;

  const handleUndoClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onUndo?.();
    dismissRef.current?.();
  };

  const handleDismissClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    dismissRef.current?.();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-16 right-6 z-50 flex flex-col overflow-hidden bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] rounded-xl shadow-lg shadow-black/10 min-w-[320px] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200 transition-colors"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-[var(--text-primary,#14261C)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[var(--accent,#10B981)] shrink-0" />
          <p className="truncate font-medium text-xs leading-normal">
            {toast.message}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onUndo && toast.canUndo && (
            <button
              type="button"
              onClick={handleUndoClick}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[var(--accent-hover,#059669)] bg-[var(--accent-light,#E8F5EE)] hover:opacity-90 border border-[var(--accent-border,#A7F3D0)] rounded-lg transition-colors cursor-pointer active:scale-95"
            >
              <RotateCcw size={12} />
              <span>Undo (Ctrl+Z)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismissClick}
            className="p-1 rounded-md text-[var(--text-secondary,#556B5E)] hover:text-[var(--text-primary,#14261C)] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="h-0.5 w-full bg-[var(--accent-light,#E8F5EE)]">
        <div
          className="h-full bg-[var(--accent-hover,#059669)] transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
