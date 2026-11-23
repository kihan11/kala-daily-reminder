export function getCircadianTheme(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) {
    return 'morning';
  }
  if (hour >= 11 && hour < 15) {
    return 'afternoon';
  }
  if (hour >= 15 && hour < 18) {
    return 'evening';
  }
  return 'night';
}

export const THEME_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: 'night', label: 'Dark' },
];
