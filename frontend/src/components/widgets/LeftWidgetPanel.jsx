import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  BarChart3,
  Edit3,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { getCurrentTimeString } from '../../utils/timeMath';

export default function LeftWidgetPanel({
  blocks = [],
  selectedDate,
  onOpenAddModal,
  onApplyBlueprint,
  onLoadDemo,
  onResetTimeline,
}) {
  const [timeStr, setTimeStr] = useState(() => getCurrentTimeString());
  const [scratchpad, setScratchpad] = useState(() => {
    return localStorage.getItem('kala_scratchpad') || '';
  });
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(getCurrentTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleScratchpadChange = (e) => {
    const val = e.target.value;
    setScratchpad(val);
    localStorage.setItem('kala_scratchpad', val);
  };

  const formattedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const totalTasks = blocks.length;
  const completedTasks = blocks.filter((b) => b.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const focusMinutes = blocks
    .filter((b) => b.category === 'coding' || b.category === 'deep_work')
    .reduce((sum, b) => sum + (b.duration_minutes || 0), 0);
  
  const completedFocusMinutes = blocks
    .filter((b) => (b.category === 'coding' || b.category === 'deep_work') && b.status === 'completed')
    .reduce((sum, b) => sum + (b.duration_minutes || 0), 0);

  const focusHours = (focusMinutes / 60).toFixed(1);
  const executionScore = focusMinutes > 0 ? Math.round((completedFocusMinutes / focusMinutes) * 100) : progressPercent;

  const handleApplyBlueprintClick = async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      if (onApplyBlueprint) {
        await onApplyBlueprint();
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <aside className="w-full flex flex-col gap-4 self-start">
      {/* 1. Live Clock & Daily Progress Widget */}
      <section className="bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] rounded-xl p-4 shadow-xs transition-colors duration-500">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#556B5E)]">
            Waktu Sekarang
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--accent-hover,#059669)] font-medium bg-[var(--accent-light,#E8F5EE)] px-2 py-0.5 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent,#10B981)] animate-pulse" />
            Live
          </span>
        </div>

        {/* Large Digital Clock */}
        <div className="font-sans-ui text-3xl font-bold tracking-tight text-[var(--text-primary,#14261C)] tabular-nums mb-1">
          {timeStr}
        </div>
        <p className="text-[13px] text-[var(--text-secondary,#556B5E)] mb-4 font-medium capitalize">
          {formattedDate}
        </p>

        {/* Daily Progress */}
        <div className="space-y-1.5 pt-3 border-t border-[var(--card-border,#DCE7DF)]/60">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--text-secondary,#556B5E)] font-medium">Daily Progress</span>
            <span className="font-sans-ui font-semibold text-[var(--text-primary,#14261C)] tabular-nums">
              {completedTasks}/{totalTasks} Selesai ({progressPercent}%)
            </span>
          </div>
          <div className="h-2 w-full bg-[var(--accent-light,#E8F5EE)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--accent-hover,#059669)] transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Load Demo Workspace button */}
        <button
          type="button"
          onClick={onLoadDemo}
          className="mt-3.5 w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[var(--accent-hover,#059669)] bg-[var(--accent-light,#E8F5EE)] hover:opacity-90 border border-[var(--accent-border,#A7F3D0)] rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Load Demo Workspace</span>
        </button>
      </section>

      {/* 2. Quick Actions & Blueprints Widget */}
      <section className="bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] rounded-xl p-4 shadow-xs transition-colors duration-500">
        <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#556B5E)] mb-3">
          Quick Actions
        </span>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Plus size={16} />
            <span>Tambah Pengingat</span>
          </button>

          <button
            type="button"
            onClick={handleApplyBlueprintClick}
            disabled={isApplying}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-[var(--text-primary,#14261C)] bg-[var(--bg-primary,#F4F8F5)] hover:opacity-90 border border-[var(--card-border,#DCE7DF)] rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles size={14} className="text-[var(--accent-hover,#059669)]" />
            <span>{isApplying ? 'Menerapkan...' : 'Terapkan Blueprint'}</span>
          </button>

          <button
            type="button"
            onClick={onResetTimeline}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/80 dark:hover:bg-rose-900/30 border border-rose-200/80 dark:border-rose-900/50 rounded-lg transition-colors cursor-pointer"
            title="Kosongkan jadwal hari ini"
          >
            <RotateCcw size={13} />
            <span>Reset Hari Ini</span>
          </button>
        </div>
      </section>

      {/* 3. Weekly Focus Telemetry Widget */}
      <section className="bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] rounded-xl p-4 shadow-xs transition-colors duration-500">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#556B5E)]">
            Focus Telemetry
          </span>
          <BarChart3 size={15} className="text-[var(--text-secondary,#556B5E)]" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="p-2.5 bg-[var(--bg-primary,#F4F8F5)] border border-[var(--card-border,#DCE7DF)] rounded-lg">
            <span className="block text-[11px] text-[var(--text-secondary,#556B5E)] font-medium">
              Fokus Terjadwal
            </span>
            <span className="text-lg font-bold text-[var(--text-primary,#14261C)] font-sans-ui tabular-nums">
              {focusHours}h
            </span>
          </div>

          <div className="p-2.5 bg-[var(--bg-primary,#F4F8F5)] border border-[var(--card-border,#DCE7DF)] rounded-lg">
            <span className="block text-[11px] text-[var(--text-secondary,#556B5E)] font-medium">
              Execution Score
            </span>
            <span className="text-lg font-bold text-[var(--accent-hover,#059669)] font-sans-ui tabular-nums">
              {executionScore}%
            </span>
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-secondary,#556B5E)] leading-relaxed">
          Kalkulasi otomatis dari kategori Coding &amp; Deep Work yang berhasil diselesaikan.
        </p>
      </section>

      {/* 4. Quick Scratchpad Widget */}
      <section className="bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] rounded-xl p-4 shadow-xs flex flex-col transition-colors duration-500">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary,#556B5E)] flex items-center gap-1.5">
            <Edit3 size={13} />
            Quick Scratchpad
          </span>
          <span className="text-[10px] text-[var(--text-secondary,#556B5E)]/80">Auto-saved</span>
        </div>
        <textarea
          value={scratchpad}
          onChange={handleScratchpadChange}
          placeholder="Catat to-do dadakan, ide sekilas, atau referensi di sini..."
          rows={4}
          className="w-full bg-[var(--bg-primary,#F4F8F5)] border border-[var(--card-border,#DCE7DF)] rounded-lg p-2.5 text-xs text-[var(--text-primary,#14261C)] placeholder-[var(--text-secondary,#556B5E)]/60 focus:outline-none focus:border-[var(--accent,#10B981)] transition-colors resize-none leading-relaxed"
        />
      </section>
    </aside>
  );
}
