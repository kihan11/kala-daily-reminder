import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Plus,
  Maximize2,
} from 'lucide-react';
import { getCategoryConfig } from '../../utils/timeMath';
import { soundEngine } from '../../utils/soundEngine';

export default function ActiveBlockHUD({
  blocks = [],
  selectedDate,
  onUpdateBlock,
  onOpenZenModal,
  apiBaseUrl = '/api',
}) {
  const [now, setNow] = useState(() => new Date());
  const [ambientPreset, setAmbientPreset] = useState(() => soundEngine.getCurrentPreset());
  const [isMuted, setIsMuted] = useState(() => soundEngine.getIsMuted());
  const [isExtending, setIsExtending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [hudFeedback, setHudFeedback] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = soundEngine.subscribe((state) => {
      setAmbientPreset(state.currentPreset);
      setIsMuted(state.isMuted);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!hudFeedback) return;
    const t = setTimeout(() => setHudFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [hudFeedback]);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const isToday = selectedDate === todayStr;

  const currentMinute = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const activeBlock = useMemo(() => {
    if (!isToday) return null;

    return blocks.find((b) => {
      if (b.status === 'completed' || b.status === 'skipped') return false;
      const start = b.start_minute;
      const end = b.start_minute + b.duration_minutes;
      return currentMinute >= start && currentMinute < end;
    }) || null;
  }, [blocks, isToday, currentMinute]);

  const remainingSeconds = useMemo(() => {
    if (!activeBlock) return 0;
    const endTotalSeconds = (activeBlock.start_minute + activeBlock.duration_minutes) * 60;
    return Math.max(0, Math.floor(endTotalSeconds - currentTotalSeconds));
  }, [activeBlock, currentTotalSeconds]);

  const formatCountdown = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleExtend = async () => {
    if (!activeBlock || isExtending) return;

    setIsExtending(true);
    soundEngine.playTick();
    const newDuration = activeBlock.duration_minutes + 15;
    const payload = {
      duration_minutes: newDuration,
      auto_ripple: true,
    };

    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.patch(`${apiBaseUrl}/blocks/${activeBlock.id}`, payload, {
        headers,
      });

      if (onUpdateBlock) {
        onUpdateBlock(activeBlock.id, payload);
      }
      setHudFeedback('+15m Extended');
    } catch {
      if (onUpdateBlock) {
        onUpdateBlock(activeBlock.id, payload);
      }
      setHudFeedback('+15m Extended');
    } finally {
      setIsExtending(false);
    }
  };

  const handleComplete = async () => {
    if (!activeBlock || isCompleting) return;

    setIsCompleting(true);
    soundEngine.playChime();
    const payload = { status: 'completed' };

    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.patch(`${apiBaseUrl}/blocks/${activeBlock.id}`, payload, {
        headers,
      });

      if (onUpdateBlock) {
        onUpdateBlock(activeBlock.id, payload);
      }
      setHudFeedback('Pengingat Selesai');
    } catch {
      if (onUpdateBlock) {
        onUpdateBlock(activeBlock.id, payload);
      }
      setHudFeedback('Pengingat Selesai');
    } finally {
      setIsCompleting(false);
    }
  };

  const activeCategoryConfig = activeBlock
    ? getCategoryConfig(activeBlock.category)
    : null;

  return (
    <footer className="h-12 shrink-0 w-full bg-[var(--footer-bg)] border-t border-[var(--footer-border)] px-6 flex items-center justify-between text-[var(--footer-text)] select-none text-xs z-30 transition-colors duration-500">
      <div className="flex items-center gap-3 min-w-0">
        {activeBlock ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent-hover)]" />
            </span>
            {activeCategoryConfig && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${activeCategoryConfig.badgeBg}`}
              >
                {activeCategoryConfig.label}
              </span>
            )}
            <span className="font-semibold text-xs text-[var(--footer-text)] truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {activeBlock.title}
            </span>
            <span className="hidden sm:inline text-[var(--footer-muted)] text-[11px] font-medium shrink-0">
              Sisa:
            </span>
            <span className="font-sans-ui text-xs font-bold text-[var(--accent-hover)] tabular-nums shrink-0 bg-[var(--footer-pill-bg)] px-2 py-0.5 rounded border border-[var(--footer-pill-border)]">
              {formatCountdown(remainingSeconds)}
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-[var(--footer-muted)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--footer-muted)] opacity-60 shrink-0" />
            <span>Tidak ada pengingat aktif saat ini</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {activeBlock && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExtend}
              disabled={isExtending}
              className="flex items-center gap-1 bg-[var(--footer-pill-bg)] hover:opacity-90 border border-[var(--footer-pill-border)] px-2.5 py-1 rounded-md text-xs font-semibold text-[var(--footer-text)] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Perpanjang 15 menit dengan auto-ripple"
            >
              <Plus size={12} className="text-[var(--accent-hover)]" />
              <span>+15m</span>
            </button>

            <button
              type="button"
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex items-center gap-1 bg-[var(--accent-hover)] hover:opacity-95 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              title="Tandai selesai"
            >
              <CheckCircle2 size={13} />
              <span>Selesai</span>
            </button>
          </div>
        )}

        {hudFeedback && (
          <span className="hidden md:inline-block text-[11px] font-semibold text-[var(--accent-hover)] bg-[var(--footer-pill-bg)] border border-[var(--footer-pill-border)] px-2 py-0.5 rounded shadow-xs">
            {hudFeedback}
          </span>
        )}

        <div className="flex items-center bg-[var(--footer-pill-bg)] border border-[var(--footer-pill-border)] rounded-md p-0.5 text-[11px] font-medium text-[var(--footer-muted)]">
          <button
            type="button"
            onClick={() => {
              if (ambientPreset !== 'off') soundEngine.stopAmbient();
            }}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              ambientPreset === 'off'
                ? 'bg-transparent text-[var(--footer-muted)] font-medium'
                : 'hover:text-[var(--footer-text)]'
            }`}
            title="Nonaktifkan Ambient Audio"
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => soundEngine.setAmbientPreset('brown')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              ambientPreset === 'brown' && !isMuted
                ? 'bg-[var(--footer-pill-active-bg)] text-[var(--footer-pill-active-text)] font-semibold shadow-xs'
                : 'hover:text-[var(--footer-text)]'
            }`}
            title="Brown Noise"
          >
            Brown
          </button>
          <button
            type="button"
            onClick={() => soundEngine.setAmbientPreset('rain')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              ambientPreset === 'rain' && !isMuted
                ? 'bg-[var(--footer-pill-active-bg)] text-[var(--footer-pill-active-text)] font-semibold shadow-xs'
                : 'hover:text-[var(--footer-text)]'
            }`}
            title="Soft Rain"
          >
            Rain
          </button>
          <button
            type="button"
            onClick={() => soundEngine.setAmbientPreset('hum')}
            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
              ambientPreset === 'hum' && !isMuted
                ? 'bg-[var(--footer-pill-active-bg)] text-[var(--footer-pill-active-text)] font-semibold shadow-xs'
                : 'hover:text-[var(--footer-text)]'
            }`}
            title="Deep Hum"
          >
            Hum
          </button>
        </div>

        {onOpenZenModal && (
          <button
            type="button"
            onClick={onOpenZenModal}
            className="flex items-center gap-1.5 bg-[var(--footer-pill-bg)] hover:opacity-90 border border-[var(--footer-pill-border)] px-2.5 py-1 rounded-md text-xs font-medium text-[var(--footer-text)] transition-all cursor-pointer active:scale-95"
            title="Buka Focus Zen Mode (Shortcut: Z)"
          >
            <Maximize2 size={13} className="text-[var(--accent-hover)]" />
            <span className="hidden sm:inline">Zen Mode</span>
            <kbd className="px-1 py-0.2 bg-[var(--footer-bg)] border border-[var(--footer-pill-border)] rounded text-[10px] text-[var(--footer-muted)] font-mono">
              Z
            </kbd>
          </button>
        )}
      </div>
    </footer>
  );
}
