import React, { useState, useEffect, useRef } from 'react';
import {
  minuteToPixels,
  getCurrentDayMinute,
  getCurrentTimeString,
} from '../../utils/timeMath';

/**
 * LaserPlayhead - Standalone timeline playhead with independent 1-second ticker.
 * Updates internally via Date.now() without triggering re-renders of TimelineGrid.
 * High-contrast crimson red line with thick white time badge.
 */
export default function LaserPlayhead({ scrollContainerRef, autoScrollOnMount = true }) {
  const [currentMinute, setCurrentMinute] = useState(() => getCurrentDayMinute());
  const [timeString, setTimeString] = useState(() => getCurrentTimeString());
  const playheadRef = useRef(null);
  const scrolledOnceRef = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date(Date.now());
      setCurrentMinute(getCurrentDayMinute(now));
      setTimeString(getCurrentTimeString(now));
    };

    const timerId = setInterval(updateTime, 1000);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!autoScrollOnMount || scrolledOnceRef.current) return;

    const timeout = setTimeout(() => {
      const targetMinute = getCurrentDayMinute(new Date(Date.now()));
      const targetTop = minuteToPixels(targetMinute);

      if (scrollContainerRef?.current) {
        const container = scrollContainerRef.current;
        const offset = container.clientHeight / 2.5;
        container.scrollTo({
          top: Math.max(0, targetTop - offset),
          behavior: 'smooth',
        });
        scrolledOnceRef.current = true;
      }
    }, 120);

    return () => clearTimeout(timeout);
  }, [autoScrollOnMount, scrollContainerRef]);

  const topPositionPx = minuteToPixels(currentMinute);

  return (
    <div
      ref={playheadRef}
      className="absolute left-0 right-0 z-30 pointer-events-none transition-[top] duration-1000 ease-linear flex items-center"
      style={{ top: `${topPositionPx}px` }}
      aria-label={`Laser Playhead: ${timeString}`}
    >
      {/* Current Time Badge & Laser Node */}
      <div className="absolute left-1.5 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto select-none">
        <div className="relative flex items-center justify-center w-3 h-3">
          <span className="absolute w-3 h-3 rounded-full bg-[#E11D48]/40 animate-ping" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
        </div>
        <div className="bg-white text-[#E11D48] border-2 border-[#E11D48] px-2.5 py-0.5 rounded-full shadow-md text-xs font-sans-ui tabular-nums font-bold tracking-wider">
          {timeString}
        </div>
      </div>

      {/* Crimson Laser Beam */}
      <div className="w-full h-[2px] bg-[#E11D48] ml-28 shadow-[0_0_4px_rgba(225,29,72,0.4)]" />
    </div>
  );
}
