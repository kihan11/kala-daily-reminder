import React from 'react';
import { Layers, Calendar, LocateFixed, Command, Volume2, VolumeX } from 'lucide-react';

export default function TopHeader({
  selectedDate,
  onDateChange,
  onJumpToNow,
  onOpenCommandPalette,
  themePreference,
  onThemeChange,
  isMuted,
  onToggleMute,
}) {
  return (
    <header className="border-b border-[var(--header-border)] bg-[var(--header-bg)] px-6 h-16 flex items-center justify-between gap-4 shrink-0 z-40 shadow-xs transition-colors duration-500">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[#10B981] shadow-xs shrink-0">
          <Layers size={19} />
        </div>
        <div className="shrink-0">
          <h1 className="text-[19px] sm:text-[21px] font-bold tracking-tight text-white leading-none whitespace-nowrap">
            Kala
          </h1>
          <p className="hidden sm:block text-[11px] sm:text-[12px] text-[#A7C4B5] mt-0.5 font-medium whitespace-nowrap">
            Personal Daily Reminder
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-white/10 border border-white/15 px-3 h-9 rounded-lg text-xs font-medium text-white shadow-xs shrink-0 whitespace-nowrap">
          <Calendar size={14} className="text-[#A7C4B5] shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent border-none text-white focus:outline-none cursor-pointer font-sans-ui text-xs [color-scheme:dark]"
          />
        </div>

        <button
          type="button"
          onClick={onJumpToNow}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 border border-white/15 px-3 h-9 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
          title="Gulir langsung ke posisi waktu sekarang"
        >
          <LocateFixed size={13} className="text-[#A7C4B5] shrink-0" />
          <span className="hidden md:inline">Jump to Now</span>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 px-3 h-9 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer shadow-xs active:scale-95 shrink-0 whitespace-nowrap"
          title="Open Command Palette (Ctrl+K)"
        >
          <Command size={13} className="text-[#A7C4B5] shrink-0" />
          <span className="hidden sm:inline">Command</span>
          <kbd className="px-1.5 py-0.5 bg-white/10 border border-white/15 rounded text-[10px] text-[#A7C4B5] font-mono shrink-0">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center p-0.5 h-9 rounded-lg bg-black/20 border border-white/15 text-xs shadow-xs shrink-0">
          <button
            type="button"
            onClick={() => onThemeChange('auto')}
            className={`px-3 h-full flex items-center justify-center rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              themePreference === 'auto'
                ? 'bg-white/20 text-white font-semibold shadow-xs'
                : 'text-[#A7C4B5] hover:text-white hover:bg-white/10'
            }`}
            title="Otomatis menyesuaikan tema waktu nyata"
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('night')}
            className={`px-3 h-full flex items-center justify-center rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              themePreference === 'night'
                ? 'bg-white/20 text-white font-semibold shadow-xs'
                : 'text-[#A7C4B5] hover:text-white hover:bg-white/10'
            }`}
            title="Kunci tampilan ke mode Dark"
          >
            Dark
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shadow-xs shrink-0 ${
            isMuted
              ? 'bg-rose-500/20 border-rose-400/30 text-rose-300 hover:bg-rose-500/30'
              : 'bg-white/10 hover:bg-white/15 border-white/15 text-[#A7C4B5] hover:text-white'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>
    </header>
  );
}
