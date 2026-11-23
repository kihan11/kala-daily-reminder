export const TOTAL_MINUTES = 1440;
export const GRID_HEIGHT = 2160;
export const PIXELS_PER_MINUTE = 1.5;
export const PIXELS_PER_HOUR = 90;
export const PIXELS_PER_15_MIN = 22.5;

export function minuteToPixels(minute) {
  return minute * PIXELS_PER_MINUTE;
}

export function pixelsToMinute(pixels) {
  return Math.round(pixels / PIXELS_PER_MINUTE);
}

export function snapMinutes(minutes, interval = 15) {
  return Math.round(minutes / interval) * interval;
}

export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

export function formatMinuteToTime(minute) {
  const clamped = clamp(Math.floor(minute), 0, 1440);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinute(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatDuration(durationMinutes) {
  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function checkOverlap(startA, durA, startB, durB) {
  return Math.max(startA, startB) < Math.min(startA + durA, startB + durB);
}

export function getCurrentDayMinute(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

export function getCurrentTimeString(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export {
  CATEGORY_CONFIG,
  PASTEL_PALETTE,
  getCategoryConfig,
} from './categoryHelper';

