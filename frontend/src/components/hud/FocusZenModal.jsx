import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  CheckCircle2,
  Volume2,
  VolumeX,
  Waves,
  CloudRain,
  Radio,
} from 'lucide-react';
import { soundEngine } from '../../utils/soundEngine';

const AMBIENT_PRESETS = [
  { id: 'brown', label: 'Brown Noise', icon: Waves, desc: 'Deep warm rumble' },
  { id: 'rain', label: 'Soft Rain', icon: CloudRain, desc: 'Filtered rainfall' },
  { id: 'hum', label: 'Deep Hum', icon: Radio, desc: 'Harmonic drone' },
];

export default function FocusZenModal({
  isOpen,
  onClose,
  activeBlock,
  onExtend,
  onComplete,
}) {
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [ambientPreset, setAmbientPreset] = useState(() => soundEngine.getCurrentPreset());
  const [volume, setVolume] = useState(() => soundEngine.getAmbientVolume());
  const [isMuted, setIsMuted] = useState(() => soundEngine.getIsMuted());
  const [visualizerBars, setVisualizerBars] = useState(() => new Array(20).fill(0.08));
  const [_isSuccessGlow, setIsSuccessGlow] = useState(false);
  const [successToast, setSuccessToast] = useState(null);
  const [isExtending, setIsExtending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const animFrameRef = useRef(null);

  useEffect(() => {
    const unsubscribe = soundEngine.subscribe((state) => {
      setAmbientPreset(state.currentPreset);
      setVolume(state.volume);
      setIsMuted(state.isMuted);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !document.activeElement?.isContentEditable) {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const updateTimer = () => {
      const d = new Date();
      setCurrentSeconds(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let isRunning = true;
    const loop = () => {
      if (!isRunning) return;
      const data = soundEngine.getVisualizerData(20);
      setVisualizerBars(data);
      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen]);

  const blockMetrics = useMemo(() => {
    if (!activeBlock) {
      return {
        remainingSec: 0,
        progressPct: 0,
        totalMinutes: 0,
        elapsedMinutes: 0,
      };
    }

    const startSec = activeBlock.start_minute * 60;
    const durationSec = activeBlock.duration_minutes * 60;
    const endSec = startSec + durationSec;

    const remainingSec = Math.max(0, endSec - currentSeconds);
    const elapsedSec = Math.max(0, currentSeconds - startSec);
    const progressPct = Math.min(100, Math.max(0, (elapsedSec / durationSec) * 100));

    return {
      remainingSec,
      progressPct,
      totalMinutes: activeBlock.duration_minutes,
      elapsedMinutes: Math.floor(elapsedSec / 60),
    };
  }, [activeBlock, currentSeconds]);

  const formatCountdown = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleSelectPreset = (presetId) => {
    if (ambientPreset === presetId) {
      soundEngine.setAmbientPreset('off');
    } else {
      soundEngine.setAmbientPreset(presetId);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setAmbientVolume(val);
  };

  const handleToggleMute = () => {
    soundEngine.toggleMute();
  };

  const handleExtendClick = async () => {
    if (!onExtend || isExtending) return;
    setIsExtending(true);
    soundEngine.playTick();
    try {
      await onExtend();
      setSuccessToast('+15 Menit Berhasil Ditambahkan');
      setTimeout(() => setSuccessToast(null), 3000);
    } finally {
      setIsExtending(false);
    }
  };

  const handleCompleteClick = async () => {
    if (!onComplete || isCompleting) return;
    setIsCompleting(true);
    soundEngine.playChime();
    setIsSuccessGlow(true);
    try {
      await onComplete();
      setSuccessToast('Pengingat Berhasil Diselesaikan!');
      setTimeout(() => {
        setIsSuccessGlow(false);
        setSuccessToast(null);
      }, 3500);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!isOpen) return null;

  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (blockMetrics.progressPct / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F4F8F5]/90 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white border border-[#DCE7DF] rounded-3xl p-8 shadow-2xl flex flex-col items-center text-[#14261C]">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between pb-4 border-b border-[#DCE7DF]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse" />
            <h2 className="text-sm font-bold tracking-wider uppercase text-[#556B5E]">
              Focus Zen Mode
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#556B5E] hover:text-[#14261C] hover:bg-[#F4F8F5] transition-colors cursor-pointer"
            title="Tutup (Shortcut: Z / Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center Circular Progress & Countdown Timer */}
        <div className="relative my-8 flex items-center justify-center">
          <svg className="w-72 h-72 -rotate-90 transform" viewBox="0 0 320 320">
            {/* Background Track */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              className="stroke-[#E8F5EE]"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              className="stroke-[#059669] transition-all duration-1000 ease-linear"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Central Countdown Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <span className="text-xs font-semibold text-[#556B5E] uppercase tracking-wider mb-1">
              {activeBlock ? activeBlock.category : 'Standby'}
            </span>
            <span className="font-sans-ui tabular-nums text-4xl sm:text-5xl font-bold tracking-tight text-[#14261C]">
              {formatCountdown(blockMetrics.remainingSec)}
            </span>
            <span className="text-xs text-[#556B5E] font-medium mt-1">
              {blockMetrics.elapsedMinutes}m / {blockMetrics.totalMinutes}m Selesai ({Math.round(blockMetrics.progressPct)}%)
            </span>
          </div>
        </div>

        {/* Active Block Title */}
        <div className="text-center max-w-lg mb-6">
          <h3 className="text-lg font-bold text-[#14261C]">
            {activeBlock ? activeBlock.title : 'Tidak ada pengingat aktif saat ini'}
          </h3>
          {activeBlock?.notes && (
            <p className="text-xs text-[#556B5E] mt-1 leading-relaxed">
              {activeBlock.notes}
            </p>
          )}
        </div>

        {/* Quick Actions (+15m & Selesai) */}
        {activeBlock && (
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={handleExtendClick}
              disabled={isExtending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] hover:border-[#A7F3D0] text-xs font-semibold text-[#14261C] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Plus size={15} className="text-[#059669]" />
              <span>Perpanjang +15m</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteClick}
              disabled={isCompleting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>Selesaikan Sesi</span>
            </button>
          </div>
        )}

        {/* Ambient Soundscape Controller */}
        <div className="w-full max-w-md pt-4 border-t border-[#DCE7DF]">
          <div className="flex items-center justify-between mb-3 text-xs text-[#556B5E] font-semibold uppercase tracking-wider">
            <span>Ambient Soundscape</span>
            <button
              type="button"
              onClick={handleToggleMute}
              className="flex items-center gap-1 text-[#059669] cursor-pointer"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isMuted ? 'Muted' : 'Unmuted'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {AMBIENT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isSelected = ambientPreset === preset.id && !isMuted;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#E8F5EE] border-[#A7F3D0] text-[#059669] shadow-xs'
                      : 'bg-[#F4F8F5] border-[#DCE7DF] text-[#556B5E] hover:text-[#14261C]'
                  }`}
                >
                  <Icon size={16} className="mb-1" />
                  <span className="font-semibold">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Volume Slider & Audio Visualizer Bars */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-[#059669] cursor-pointer"
            />
            {/* Real-time Visualizer */}
            <div className="flex items-end gap-0.5 h-5 shrink-0">
              {visualizerBars.map((val, i) => (
                <div
                  key={i}
                  className="w-1 bg-[#059669] rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, val * 20)}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg animate-in fade-in duration-150">
            {successToast}
          </div>
        )}
      </div>
    </div>
  );
}
