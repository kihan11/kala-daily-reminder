import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Search,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { formatMinuteToTime } from '../utils/timeMath';
import { parseCommandInput } from '../utils/commandParser';

export default function CommandPalette({
  isOpen,
  onClose,
  selectedDate,
  existingBlocks = [],
  onBlockCreated,
  onBlueprintApplied,
  apiBaseUrl = '/api',
}) {
  const [query, setQuery] = useState('');
  const [blueprints, setBlueprints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchBlueprints = async () => {
      try {
        const token =
          localStorage.getItem('auth_token') ||
          sessionStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(`${apiBaseUrl}/blueprints`, { headers });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          setBlueprints(res.data.data);
        }
      } catch {
        if (isMounted) {
          setBlueprints([
            { id: 1, name: 'Weekday Campus Day', description: 'Standard university lecture morning followed by core development sprint' },
            { id: 2, name: 'Weekend Deep Focus', description: 'Uninterrupted deep work blocks for hobby projects and research' },
            { id: 3, name: 'Hari Kuliah', description: 'Jadwal kuliah intensif dan review tugas lab' },
          ]);
        }
      }
    };

    fetchBlueprints();
    return () => {
      isMounted = false;
    };
  }, [isOpen, apiBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          const event = new CustomEvent('toggle-command-palette');
          window.dispatchEvent(event);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const parsed = useMemo(() => parseCommandInput(query), [query]);

  const matchedBlueprint = useMemo(() => {
    if (!parsed || parsed.type !== 'APPLY_BLUEPRINT') return null;
    const target = parsed.blueprintName.toLowerCase();

    // 1. Exact match
    const exact = blueprints.find((b) => b.name.toLowerCase() === target);
    if (exact) return exact;

    // 2. Substring match
    const partial = blueprints.find(
      (b) => b.name.toLowerCase().includes(target) || target.includes(b.name.toLowerCase())
    );
    if (partial) return partial;

    // 3. Semantic keyword matching
    if (target.includes('kuliah') || target.includes('campus')) {
      const campus = blueprints.find((b) =>
        b.name.toLowerCase().includes('campus') || b.name.toLowerCase().includes('kuliah')
      );
      if (campus) return campus;
    }

    if (target.includes('focus') || target.includes('weekend')) {
      const weekend = blueprints.find((b) =>
        b.name.toLowerCase().includes('weekend') || b.name.toLowerCase().includes('focus')
      );
      if (weekend) return weekend;
    }

    return blueprints[0] || null;
  }, [parsed, blueprints]);

  const handleExecute = async () => {
    if (!parsed || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (parsed.type === 'CREATE_BLOCK') {
        const newStart = parsed.start_minute;
        const newEnd = parsed.start_minute + parsed.duration_minutes;

        // Check overlap against all existing blocks on that date
        const collidingBlock = existingBlocks.find((b) => {
          if (b.scheduled_date && b.scheduled_date !== selectedDate) return false;
          const otherStart = b.start_minute;
          const otherEnd = b.start_minute + b.duration_minutes;
          return newStart < otherEnd && newEnd > otherStart;
        });

        if (collidingBlock) {
          setStatusMessage({
            type: 'error',
            text: `Jadwal bentrok dengan "${collidingBlock.title}" (${formatMinuteToTime(collidingBlock.start_minute)} – ${formatMinuteToTime(collidingBlock.start_minute + collidingBlock.duration_minutes)}). Silakan pilih waktu lain.`,
          });
          setIsSubmitting(false);
          return;
        }

        const payload = {
          title: parsed.title,
          category: parsed.category,
          scheduled_date: selectedDate,
          start_minute: parsed.start_minute,
          duration_minutes: parsed.duration_minutes,
          notes: parsed.notes || null,
        };

        const res = await axios.post(`${apiBaseUrl}/blocks`, payload, { headers });
        const createdBlock = res.data?.data || {
          ...payload,
          id: Date.now(),
          is_virtual: false,
        };

        if (onBlockCreated) {
          onBlockCreated(createdBlock);
        }

        setStatusMessage({
          type: 'success',
          text: `Pengingat "${parsed.title}" berhasil ditambahkan pada jam ${formatMinuteToTime(parsed.start_minute)}!`,
        });

        setTimeout(() => {
          setQuery('');
          onClose();
        }, 700);
      } else if (parsed.type === 'APPLY_BLUEPRINT') {
        if (!matchedBlueprint) {
          throw new Error('Blueprint yang sesuai tidak ditemukan.');
        }

        await axios.post(
          `${apiBaseUrl}/blueprints/apply`,
          {
            blueprint_id: matchedBlueprint.id,
            target_date: selectedDate,
          },
          { headers }
        );

        if (onBlueprintApplied) {
          await onBlueprintApplied(matchedBlueprint);
        }

        setStatusMessage({
          type: 'success',
          text: `Routine Blueprint "${matchedBlueprint.name}" berhasil diterapkan!`,
        });

        setTimeout(() => {
          setQuery('');
          onClose();
        }, 900);
      }
    } catch (err) {
      // If error from server (422, collision, validation), do NOT insert into state
      const responseData = err.response?.data;
      if (responseData) {
        let errorText =
          responseData.errors?.start_minute?.[0] ||
          responseData.errors?.title?.[0] ||
          responseData.message ||
          'Gagal menambahkan pengingat.';
        setStatusMessage({ type: 'error', text: errorText });
        return;
      }

      // Offline fallback only when pure network unreachable AND not colliding
      if (parsed.type === 'CREATE_BLOCK') {
        const fallbackBlock = {
          id: Date.now(),
          title: parsed.title,
          category: parsed.category,
          scheduled_date: selectedDate,
          start_minute: parsed.start_minute,
          duration_minutes: parsed.duration_minutes,
          notes: parsed.notes || null,
          status: 'scheduled',
          is_virtual: false,
        };
        if (onBlockCreated) onBlockCreated(fallbackBlock);
        setStatusMessage({
          type: 'success',
          text: `Pengingat "${parsed.title}" berhasil ditambahkan (Mode Offline)!`,
        });
        setTimeout(() => {
          setQuery('');
          onClose();
        }, 700);
        return;
      }

      const msg = err.message || 'Gagal mengeksekusi perintah.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDownForm = (e) => {
    if (e.key === 'Enter' && parsed) {
      e.preventDefault();
      handleExecute();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-slate-900/35 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white border border-[#DCE7DF] rounded-2xl shadow-2xl overflow-hidden text-[#14261C] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#DCE7DF] bg-white">
          <Search size={18} className="text-[#059669] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownForm}
            placeholder="Ketik perintah: '07:00 - 07:30 Olahraga Pagi' atau '19:00 (60m) Belajar & Santai'..."
            className="w-full bg-transparent border-none text-[15px] font-medium text-[#14261C] placeholder-[#556B5E]/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-[#556B5E] hover:text-[#14261C] hover:bg-[#F4F8F5]"
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#556B5E] hover:text-[#14261C] hover:bg-[#F4F8F5] transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Parsed Preview Box */}
        {parsed && (
          <div className="p-4 bg-[#F4F8F5] border-b border-[#DCE7DF] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {parsed.type === 'CREATE_BLOCK' ? (
                <>
                  <div className="p-2 rounded-lg bg-[#E8F5EE] text-[#059669] shrink-0">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#059669]">
                        Tambah Pengingat Baru
                      </span>
                      <span className="text-xs font-mono text-[#556B5E]">
                        {formatMinuteToTime(parsed.start_minute)} – {formatMinuteToTime(parsed.start_minute + parsed.duration_minutes)} ({parsed.duration_minutes}m)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-bold text-[#14261C] truncate">
                        {parsed.title}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.2 rounded-full border border-[#DCE7DF] bg-white text-[#556B5E]">
                        {parsed.category}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-lg bg-teal-50 text-teal-700 shrink-0">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-teal-700">
                      Terapkan Routine Blueprint
                    </span>
                    <h4 className="text-sm font-bold text-[#14261C]">
                      {matchedBlueprint ? matchedBlueprint.name : parsed.blueprintName}
                    </h4>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleExecute}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Memproses...' : 'Eksekusi'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Quick Helper Syntax & Blueprint Recommendations */}
        <div className="p-4 space-y-4 max-h-72 overflow-y-auto">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#556B5E] mb-2">
              Contoh Sintaks Pengingat Harian
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuery('07:00 - 07:30 Olahraga Pagi')}
                className="text-left p-2 rounded-lg bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] text-[#14261C] transition-colors cursor-pointer"
              >
                <div className="font-mono text-[#059669] font-semibold text-[11px]">
                  07:00 - 07:30
                </div>
                <div className="font-medium truncate">Olahraga Pagi</div>
              </button>

              <button
                type="button"
                onClick={() => setQuery('19:00 (60m) Belajar & Santai')}
                className="text-left p-2 rounded-lg bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] text-[#14261C] transition-colors cursor-pointer"
              >
                <div className="font-mono text-[#D97706] font-semibold text-[11px]">
                  19:00 (60m)
                </div>
                <div className="font-medium truncate">Belajar & Santai</div>
              </button>

              <button
                type="button"
                onClick={() => setQuery('09:00 - 10:30 Coding Laravel Service')}
                className="text-left p-2 rounded-lg bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] text-[#14261C] transition-colors cursor-pointer"
              >
                <div className="font-mono text-[#059669] font-semibold text-[11px]">
                  09:00 - 10:30
                </div>
                <div className="font-medium truncate">Coding Laravel Service</div>
              </button>

              <button
                type="button"
                onClick={() => setQuery('14:00 90m Kuliah Sistem Terdistribusi')}
                className="text-left p-2 rounded-lg bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] text-[#14261C] transition-colors cursor-pointer"
              >
                <div className="font-mono text-[#D97706] font-semibold text-[11px]">
                  14:00 (90m)
                </div>
                <div className="font-medium truncate">Kuliah Sistem Terdistribusi</div>
              </button>
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#556B5E] mb-2">
              Daftar Blueprint Tersedia
            </span>
            <div className="space-y-1.5">
              {blueprints.map((bp) => (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => setQuery(`apply blueprint ${bp.name}`)}
                  className="w-full text-left p-2 rounded-lg bg-[#F4F8F5] hover:bg-[#E8F5EE] border border-[#DCE7DF] flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-[#14261C]">{bp.name}</div>
                    <div className="text-[11px] text-[#556B5E]">{bp.description}</div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#059669] font-mono">
                    Pilih
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
