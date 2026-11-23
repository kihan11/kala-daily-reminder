import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  onConfirm,
  onClose,
  isDestructive = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-sm rounded-xl border border-[var(--card-border,#DCE7DF)] bg-[var(--card-bg,#FFFFFF)] p-5 shadow-xl transition-all">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isDestructive ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-[#E8F5EE] text-[#059669] border border-[#A7F3D0]'}`}>
              <AlertTriangle size={18} />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary,#14261C)]">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary,#556B5E)] hover:text-[var(--text-primary,#14261C)] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary,#556B5E)] leading-relaxed mb-5">
          {message}
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-[var(--text-secondary,#556B5E)] hover:text-[var(--text-primary,#14261C)] bg-black/5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#059669] hover:bg-[#047857]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
