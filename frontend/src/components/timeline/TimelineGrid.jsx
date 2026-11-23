import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  GRID_HEIGHT,
  PIXELS_PER_HOUR,
  PIXELS_PER_15_MIN,
  snapMinutes,
  clamp,
} from '../../utils/timeMath';
import LaserPlayhead from './LaserPlayhead';
import TimeBlockCard from './TimeBlockCard';
import AddBlockModal from './AddBlockModal';

/**
 * TimelineGrid - 24-hour canvas (height 2160px) in Soft White theme with 1-hour lines & 15-minute sublines.
 */
const TimelineGrid = React.forwardRef(function TimelineGrid(
  {
    blocks = [],
    onAddBlock,
    onUpdateBlock,
    onDeleteBlock,
    onEditBlock,
    onOpenAddModal,
    onEmptySlotClick,
    onNotify,
    selectedDate,
    highlightedBlockId = null,
    apiBaseUrl = '/api',
    autoScrollPlayhead = true,
    className = '',
  },
  ref
) {
  const localContainerRef = useRef(null);
  const containerRef = ref || localContainerRef;
  const gridCanvasRef = useRef(null);

  const [modalState, setModalState] = useState({
    isOpen: false,
    startMinute: 540,
    durationMinutes: 60,
  });

  const [optimisticOverrides, setOptimisticOverrides] = useState({});

  const handleGridClick = useCallback((e) => {
    if (
      e.target.closest(
        '[data-block-card="true"], button, input, textarea, select'
      )
    ) {
      return;
    }

    if (!gridCanvasRef.current) return;

    const rect = gridCanvasRef.current.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    // Convert click Y coordinate to minute offset & snap to 15-minute intervals (GRID_HEIGHT 2160 / 1440 min = 1.5 px/min)
    const clickedMinute = Math.round(clickY / 1.5);
    const snappedMinute = snapMinutes(clickedMinute, 15);
    const clampedMinute = clamp(snappedMinute, 0, 1425);

    if (onEmptySlotClick) {
      onEmptySlotClick(clampedMinute);
    } else if (onOpenAddModal) {
      onOpenAddModal(clampedMinute);
    } else {
      setModalState({
        isOpen: true,
        startMinute: clampedMinute,
        durationMinutes: 60,
      });
    }
  }, [onEmptySlotClick, onOpenAddModal]);

  const handleCreateBlockSubmit = async (payload) => {
    if (onAddBlock) {
      await onAddBlock(payload);
      return;
    }

    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    await axios.post(`${apiBaseUrl}/blocks`, payload, { headers });
  };

  // Optimistic position tracker
  const handleOptimisticUpdate = useCallback((blockId, payload) => {
    setOptimisticOverrides((prev) => ({
      ...prev,
      [blockId]: {
        start_minute: payload.start_minute,
        duration_minutes: payload.duration_minutes,
      },
    }));
  }, []);

  // Rollback on rejection
  const handleRollback = useCallback((blockId, _previousState) => {
    setOptimisticOverrides((prev) => {
      const copy = { ...prev };
      delete copy[blockId];
      return copy;
    });
  }, []);

  const hourSlots = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-y-auto bg-[var(--card-bg,#FFFFFF)] select-none transition-colors duration-500 ${className}`}
      style={{ minHeight: '600px' }}
    >
      {/* 2160px High Timeline Grid Canvas */}
      <div
        ref={gridCanvasRef}
        onClick={handleGridClick}
        style={{ height: `${GRID_HEIGHT}px` }}
        className="relative w-full border-l border-[var(--card-border,#DCE7DF)] transition-colors duration-500"
      >
        {/* Render 24 Hours with 1-hour borders & 15-minute sublines */}
        {hourSlots.map((hour) => {
          const hourTop = hour * PIXELS_PER_HOUR;
          const hourLabel = `${String(hour).padStart(2, '0')}:00`;

          return (
            <div
              key={hour}
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: `${hourTop}px`, height: `${PIXELS_PER_HOUR}px` }}
            >
              {/* Hour Line & Left Label (13px medium, Plus Jakarta Sans) */}
              <div className="absolute inset-x-0 top-0 flex items-center border-t border-[var(--grid-line,#E5EFE8)]">
                <span className="w-16 pl-3.5 text-[13px] font-sans-ui font-medium tabular-nums text-[var(--text-secondary,#556B5E)] select-none">
                  {hourLabel}
                </span>
                <div className="flex-1 h-px bg-[var(--grid-line,#E5EFE8)]" />
              </div>

              {/* 15-Minute Sub-Line */}
              <div
                className="absolute inset-x-0 border-t border-dashed border-[var(--grid-line-sub,#F0F5F1)]"
                style={{
                  top: `${PIXELS_PER_15_MIN}px`,
                  left: '68px',
                }}
              />

              {/* 30-Minute Sub-Line */}
              <div
                className="absolute inset-x-0 border-t border-[var(--grid-line,#E5EFE8)]"
                style={{
                  top: `${PIXELS_PER_15_MIN * 2}px`,
                  left: '68px',
                }}
              />

              {/* 45-Minute Sub-Line */}
              <div
                className="absolute inset-x-0 border-t border-dashed border-[var(--grid-line-sub,#F0F5F1)]"
                style={{
                  top: `${PIXELS_PER_15_MIN * 3}px`,
                  left: '68px',
                }}
              />
            </div>
          );
        })}

        {/* Laser Playhead Indicator */}
        <LaserPlayhead
          scrollContainerRef={containerRef}
          autoScrollOnMount={autoScrollPlayhead}
        />

        {/* Time Blocks Layer */}
        <div className="absolute inset-0 left-16 right-4 pointer-events-auto">
          {blocks.map((block) => {
            const override = optimisticOverrides[block.id];
            const renderedBlock = override
              ? {
                  ...block,
                  start_minute: override.start_minute ?? block.start_minute,
                  duration_minutes:
                    override.duration_minutes ?? block.duration_minutes,
                }
              : block;

            return (
              <TimeBlockCard
                key={block.id}
                block={renderedBlock}
                allBlocks={blocks}
                isHighlighted={highlightedBlockId === block.id}
                onUpdateBlock={onUpdateBlock}
                onDeleteBlock={onDeleteBlock}
                onEditBlock={onEditBlock}
                onOptimisticUpdate={handleOptimisticUpdate}
                onRollback={handleRollback}
                onNotify={onNotify}
                apiBaseUrl={apiBaseUrl}
              />
            );
          })}
        </div>
      </div>

      {/* Internal Fallback Add Block Modal */}
      {!onOpenAddModal && (
        <AddBlockModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onSubmit={handleCreateBlockSubmit}
          initialStartMinute={modalState.startMinute}
          initialDuration={modalState.durationMinutes}
          scheduledDate={selectedDate}
        />
      )}
    </div>
  );
});

export default TimelineGrid;
