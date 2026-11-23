import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Waves,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Circle,
  Paperclip,
  FileText,
} from 'lucide-react';
import {
  TOTAL_MINUTES,
  PIXELS_PER_MINUTE,
  snapMinutes,
  clamp,
  formatMinuteToTime,
  formatDuration,
  CATEGORY_CONFIG,
  getCategoryConfig,
} from '../../utils/timeMath';
import { soundEngine } from '../../utils/soundEngine';

/**
 * TimeBlockCard - Clean pastel card with crisp border and high-contrast typography.
 * Supports vertical drag (start time), bottom resize (duration), and Auto-Ripple toggle.
 */
export default function TimeBlockCard({
  block,
  allBlocks = [],
  isHighlighted = false,
  onUpdateBlock,
  onDeleteBlock,
  onEditBlock,
  onOptimisticUpdate,
  onRollback,
  onNotify,
  apiBaseUrl = '/api',
  style = {},
}) {
  const [autoRipple, setAutoRipple] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [previewStartMinute, setPreviewStartMinute] = useState(null);
  const [previewDurationMinutes, setPreviewDurationMinutes] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [_isUpdating, setIsUpdating] = useState(false);

  const dragStateRef = useRef({
    isDragging: false,
    startY: 0,
    initialStartMinute: 0,
    pointerId: null,
    lastSnappedStart: null,
  });

  const resizeStateRef = useRef({
    isResizing: false,
    startY: 0,
    initialDurationMinutes: 0,
    pointerId: null,
    lastSnappedDuration: null,
  });

  // Real-time interval collision detection across other blocks on the same date
  const checkCollision = useCallback(
    (start, dur) => {
      const end = start + dur;
      return (
        allBlocks.find((b) => {
          if (b.id === block.id) return false;
          if (
            b.scheduled_date &&
            block.scheduled_date &&
            b.scheduled_date !== block.scheduled_date
          ) {
            return false;
          }
          const bStart = b.start_minute;
          const bEnd = b.start_minute + b.duration_minutes;
          return start < bEnd && end > bStart;
        }) || null
      );
    },
    [allBlocks, block.id, block.scheduled_date]
  );

  const categoryConfig = useMemo(() => {
    return getCategoryConfig(block.category);
  }, [block.category]);

  const activeStartMinute = previewStartMinute ?? block.start_minute;
  const activeDurationMinutes = previewDurationMinutes ?? block.duration_minutes;

  const topPx = activeStartMinute * PIXELS_PER_MINUTE;
  const heightPx = Math.max(activeDurationMinutes * PIXELS_PER_MINUTE, 28);

  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  const commitChanges = async (newStart, newDuration) => {
    if (newStart === block.start_minute && newDuration === block.duration_minutes) {
      return;
    }

    const previousState = {
      start_minute: block.start_minute,
      duration_minutes: block.duration_minutes,
    };

    const payload = {
      start_minute: newStart,
      duration_minutes: newDuration,
      auto_ripple: autoRipple,
    };

    if (onOptimisticUpdate) {
      onOptimisticUpdate(block.id, payload);
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      if (onUpdateBlock) {
        await onUpdateBlock(block.id, payload);
      } else {
        const token =
          localStorage.getItem('auth_token') ||
          sessionStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        await axios.patch(`${apiBaseUrl}/blocks/${block.id}`, payload, {
          headers,
        });
      }
    } catch (err) {
      if (onRollback) {
        onRollback(block.id, previousState, err);
      }

      const msg =
        err.response?.data?.errors?.start_minute?.[0] ||
        err.response?.data?.errors?.auto_ripple?.[0] ||
        err.response?.data?.errors?.duration_minutes?.[0] ||
        err.response?.data?.message ||
        'Benturan jadwal! Perubahan dikembalikan ke posisi awal.';

      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleComplete = async (e) => {
    e.stopPropagation();
    const isNowCompleted = block.status !== 'completed';
    if (isNowCompleted) {
      soundEngine.playChime();
    } else {
      soundEngine.playTick();
    }

    const payload = { status: isNowCompleted ? 'completed' : 'scheduled' };
    if (onOptimisticUpdate) {
      onOptimisticUpdate(block.id, payload);
    }
    if (onUpdateBlock) {
      await onUpdateBlock(block.id, payload);
    } else {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.patch(`${apiBaseUrl}/blocks/${block.id}`, payload, {
        headers,
      });
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (onDeleteBlock) {
      onDeleteBlock(block.id);
    }
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete(`${apiBaseUrl}/blocks/${block.id}`, { headers });
    } catch {
      }
  };

  const handlePointerDownDrag = (e) => {
    if (
      e.target.closest(
        'button, [data-resize-handle="true"], [data-no-drag="true"]'
      )
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    e.currentTarget.setPointerCapture(pointerId);

    dragStateRef.current = {
      isDragging: true,
      startY: e.clientY,
      initialStartMinute: block.start_minute,
      pointerId,
      lastSnappedStart: block.start_minute,
    };

    setIsDragging(true);
    setPreviewStartMinute(block.start_minute);
  };

  const handlePointerMoveDrag = (e) => {
    if (!dragStateRef.current.isDragging) return;
    e.preventDefault();

    const deltaY = e.clientY - dragStateRef.current.startY;
    const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);
    const rawNewStart = dragStateRef.current.initialStartMinute + deltaMinutes;
    const snappedNewStart = snapMinutes(rawNewStart, 15);
    const maxStart = TOTAL_MINUTES - (previewDurationMinutes ?? block.duration_minutes);
    const clampedNewStart = clamp(snappedNewStart, 0, maxStart);

    if (dragStateRef.current.lastSnappedStart !== clampedNewStart) {
      soundEngine.playTick();
      dragStateRef.current.lastSnappedStart = clampedNewStart;
    }

    setPreviewStartMinute(clampedNewStart);
  };

  const handleCompleteInteraction = (finalStart, finalDuration) => {
    if (
      finalStart === block.start_minute &&
      finalDuration === block.duration_minutes
    ) {
      return;
    }

    const collision = checkCollision(finalStart, finalDuration);

    if (!autoRipple && collision) {
      if (onRollback) {
        onRollback(block.id, {
          start_minute: block.start_minute,
          duration_minutes: block.duration_minutes,
        });
      }
      soundEngine.playTick();
      const msg = 'Jadwal bentrok, aktifkan Auto-Ripple untuk menggeser otomatis';
      if (onNotify) {
        onNotify(msg, false);
      } else {
        setErrorMessage(msg);
      }
      return;
    }

    if (autoRipple && collision) {
      let currentEnd = finalStart + finalDuration;
      const sortedOthers = allBlocks
        .filter(
          (b) =>
            b.id !== block.id &&
            (!b.scheduled_date ||
              !block.scheduled_date ||
              b.scheduled_date === block.scheduled_date)
        )
        .sort((a, b) => a.start_minute - b.start_minute);

      let overflowed = false;
      const visited = new Set([block.id]);

      while (true) {
        const nextColliding = sortedOthers.find(
          (b) =>
            !visited.has(b.id) &&
            b.start_minute < currentEnd &&
            b.start_minute + b.duration_minutes > finalStart
        );
        if (!nextColliding) break;

        visited.add(nextColliding.id);
        const shiftEnd = currentEnd + nextColliding.duration_minutes;
        if (shiftEnd > TOTAL_MINUTES) {
          overflowed = true;
          break;
        }
        currentEnd = shiftEnd;
      }

      if (overflowed) {
        if (onRollback) {
          onRollback(block.id, {
            start_minute: block.start_minute,
            duration_minutes: block.duration_minutes,
          });
        }
        soundEngine.playTick();
        const msg = 'Pergeseran Auto-Ripple melebihi batas 24:00 (1440 menit).';
        if (onNotify) {
          onNotify(msg, false);
        } else {
          setErrorMessage(msg);
        }
        return;
      }
    }

    commitChanges(finalStart, finalDuration);
  };

  const handlePointerUpDrag = (e) => {
    if (!dragStateRef.current.isDragging) return;
    e.preventDefault();

    const finalStart = previewStartMinute ?? block.start_minute;
    const finalDuration = previewDurationMinutes ?? block.duration_minutes;

    dragStateRef.current.isDragging = false;
    setIsDragging(false);
    setPreviewStartMinute(null);

    handleCompleteInteraction(finalStart, finalDuration);
  };

  const handlePointerDownResize = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const pointerId = e.pointerId;
    e.currentTarget.setPointerCapture(pointerId);

    resizeStateRef.current = {
      isResizing: true,
      startY: e.clientY,
      initialDurationMinutes: block.duration_minutes,
      pointerId,
      lastSnappedDuration: block.duration_minutes,
    };

    setIsResizing(true);
    setPreviewDurationMinutes(block.duration_minutes);
  };

  const handlePointerMoveResize = (e) => {
    if (!resizeStateRef.current.isResizing) return;
    e.preventDefault();

    const deltaY = e.clientY - resizeStateRef.current.startY;
    const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);
    const rawNewDuration = resizeStateRef.current.initialDurationMinutes + deltaMinutes;
    const snappedNewDuration = snapMinutes(rawNewDuration, 15);
    const maxDuration = TOTAL_MINUTES - (previewStartMinute ?? block.start_minute);
    const clampedNewDuration = clamp(snappedNewDuration, 15, maxDuration);

    if (resizeStateRef.current.lastSnappedDuration !== clampedNewDuration) {
      soundEngine.playTick();
      resizeStateRef.current.lastSnappedDuration = clampedNewDuration;
    }

    setPreviewDurationMinutes(clampedNewDuration);
  };

  const handlePointerUpResize = (e) => {
    if (!resizeStateRef.current.isResizing) return;
    e.preventDefault();

    const finalStart = previewStartMinute ?? block.start_minute;
    const finalDuration = previewDurationMinutes ?? block.duration_minutes;

    resizeStateRef.current.isResizing = false;
    setIsResizing(false);
    setPreviewDurationMinutes(null);

    handleCompleteInteraction(finalStart, finalDuration);
  };

  const collidingBlock =
    isDragging || isResizing
      ? checkCollision(activeStartMinute, activeDurationMinutes)
      : null;
  const hasCollisionWarning = !autoRipple && Boolean(collidingBlock);

  const isCompleted = block.status === 'completed';
  const startStr = formatMinuteToTime(activeStartMinute);
  const endStr = formatMinuteToTime(activeStartMinute + activeDurationMinutes);
  const durationStr = formatDuration(activeDurationMinutes);

  return (
    <div
      data-block-card="true"
      data-block-id={block.id}
      onPointerDown={handlePointerDownDrag}
      onPointerMove={handlePointerMoveDrag}
      onPointerUp={handlePointerUpDrag}
      onPointerCancel={handlePointerUpDrag}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        ...style,
      }}
      className={`absolute inset-x-0 rounded-xl border transition-all duration-300 select-none group flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing ${
        isHighlighted
          ? 'ring-4 ring-[#059669] shadow-xl scale-[1.015] z-30'
          : ''
      } ${
        hasCollisionWarning
          ? 'border-rose-400 bg-rose-50/90 ring-2 ring-rose-400/50 z-40 shadow-lg scale-[1.008]'
          : `${categoryConfig.bgColor} ${categoryConfig.borderColor} ${categoryConfig.hoverBorder} ${
              isDragging || isResizing
                ? 'z-40 shadow-lg scale-[1.008] opacity-95 ring-2 ring-[#059669]/40'
                : 'shadow-xs hover:shadow-md'
            }`
      } ${isCompleted ? 'opacity-70 bg-[#F4F8F5]' : ''}`}
    >
      {/* Top Accent Strip */}
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: categoryConfig.accentColor }}
      />

      {/* Main Content Area */}
      <div className="px-3.5 py-2 flex flex-col justify-between flex-1 min-h-0">
        <div>
          {/* Header Row: Category Badge, Times & Status Actions */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border shrink-0 ${categoryConfig.badgeBg}`}
              >
                {categoryConfig.label}
              </span>

              {/* Time Interval & Duration */}
              <span className="text-xs font-sans-ui font-medium text-[#556B5E] tabular-nums truncate">
                {startStr} – {endStr} ({durationStr})
              </span>

              {/* Document Attachment Indicator Icon */}
              {(block.attachment_path || block.attachment_name) && (
                <span
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditBlock) onEditBlock(block);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#059669] bg-[#E8F5EE] border border-[#A7F3D0] px-1.5 py-0.5 rounded cursor-pointer shrink-0 hover:bg-[#D1FAE5] transition-colors"
                  title={`Lampiran dokumen: ${block.attachment_name || 'Ada berkas'}`}
                >
                  <Paperclip size={11} className="shrink-0" />
                  <span className="hidden sm:inline max-w-[80px] truncate">
                    {block.attachment_name
                      ? block.attachment_name.split('.').pop().toUpperCase()
                      : 'File'}
                  </span>
                </span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div
              data-no-drag="true"
              className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity shrink-0"
            >
              {/* Auto-Ripple Shift Toggle */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoRipple((prev) => !prev);
                }}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                  autoRipple
                    ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                    : 'bg-white/80 text-[#556B5E] border-[#DCE7DF] hover:bg-white'
                }`}
                title={
                  autoRipple
                    ? 'Auto-Ripple Aktif: Blok setelahnya akan bergeser otomatis'
                    : 'Aktifkan Auto-Ripple shift untuk blok berikutnya'
                }
              >
                <Waves size={11} />
                <span className="hidden sm:inline">Ripple</span>
              </button>

              {/* Edit / Detail Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditBlock) onEditBlock(block);
                }}
                className="p-1 rounded-md text-[#556B5E] hover:text-[#059669] hover:bg-white transition-colors cursor-pointer"
                title="Buka detail & lampiran jadwal"
              >
                <FileText size={15} />
              </button>

              {/* Toggle Completion */}
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isCompleted
                    ? 'text-[#059669] hover:bg-[#E8F5EE]'
                    : 'text-[#556B5E] hover:text-[#059669] hover:bg-white'
                }`}
                title={isCompleted ? 'Tandai belum selesai' : 'Tandai selesai'}
              >
                {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                className="p-1 rounded-md text-[#556B5E] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Hapus blok jadwal"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* Block Title (15px semibold) */}
          <h4
            className={`text-[15px] font-semibold tracking-tight leading-snug line-clamp-2 ${
              isCompleted ? 'line-through text-[#556B5E]' : 'text-[#14261C]'
            }`}
          >
            {block.title}
          </h4>

          {/* Optional Notes */}
          {block.notes && heightPx > 60 && (
            <p className="text-xs text-[#556B5E] mt-1 line-clamp-1">
              {block.notes}
            </p>
          )}
        </div>

        {/* Error Notification Toast if Overlap/Conflict */}
        {errorMessage && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Bottom Resize Handle */}
      <div
        data-resize-handle="true"
        onPointerDown={handlePointerDownResize}
        onPointerMove={handlePointerMoveResize}
        onPointerUp={handlePointerUpResize}
        onPointerCancel={handlePointerUpResize}
        className="h-2 w-full cursor-s-resize hover:bg-[#059669]/20 transition-colors flex items-center justify-center shrink-0"
        title="Tarik ke bawah untuk mengubah durasi waktu (snap 15m)"
      >
        <div className="w-8 h-1 rounded-full bg-[#DCE7DF] group-hover:bg-[#059669]" />
      </div>
    </div>
  );
}
