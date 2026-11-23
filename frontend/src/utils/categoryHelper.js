export const CATEGORY_STORAGE_KEY = 'kala_custom_categories';

export const CATEGORY_CONFIG = {
  coding: {
    label: 'Coding',
    borderColor: 'border-emerald-300',
    hoverBorder: 'hover:border-emerald-400',
    bgColor: 'bg-emerald-50/95',
    textColor: 'text-emerald-950',
    accentColor: '#059669',
    badgeBg: 'bg-emerald-100/90 text-emerald-800 border-emerald-300',
    lightDot: 'bg-emerald-500',
  },
  kuliah: {
    label: 'Kuliah',
    borderColor: 'border-amber-300',
    hoverBorder: 'hover:border-amber-400',
    bgColor: 'bg-amber-50/95',
    textColor: 'text-amber-950',
    accentColor: '#D97706',
    badgeBg: 'bg-amber-100/90 text-amber-800 border-amber-300',
    lightDot: 'bg-amber-500',
  },
  deep_work: {
    label: 'Deep Work',
    borderColor: 'border-teal-300',
    hoverBorder: 'hover:border-teal-400',
    bgColor: 'bg-teal-50/95',
    textColor: 'text-teal-950',
    accentColor: '#0D9488',
    badgeBg: 'bg-teal-100/90 text-teal-800 border-teal-300',
    lightDot: 'bg-teal-500',
  },
  istirahat: {
    label: 'Istirahat',
    borderColor: 'border-slate-300',
    hoverBorder: 'hover:border-slate-400',
    bgColor: 'bg-slate-100/95',
    textColor: 'text-slate-800',
    accentColor: '#64748B',
    badgeBg: 'bg-slate-200/90 text-slate-700 border-slate-300',
    lightDot: 'bg-slate-500',
  },
  rapat: {
    label: 'Rapat',
    borderColor: 'border-sky-300',
    hoverBorder: 'hover:border-sky-400',
    bgColor: 'bg-sky-50/95',
    textColor: 'text-sky-950',
    accentColor: '#0284C7',
    badgeBg: 'bg-sky-100/90 text-sky-800 border-sky-300',
    lightDot: 'bg-sky-500',
  },
  pribadi: {
    label: 'Pribadi',
    borderColor: 'border-purple-300',
    hoverBorder: 'hover:border-purple-400',
    bgColor: 'bg-purple-50/95',
    textColor: 'text-purple-950',
    accentColor: '#7C3AED',
    badgeBg: 'bg-purple-100/90 text-purple-800 border-purple-300',
    lightDot: 'bg-purple-500',
  },
};

export const PASTEL_PALETTE = [
  {
    borderColor: 'border-indigo-300',
    hoverBorder: 'hover:border-indigo-400',
    bgColor: 'bg-indigo-50/95',
    textColor: 'text-indigo-950',
    accentColor: '#4F46E5',
    badgeBg: 'bg-indigo-100/90 text-indigo-800 border-indigo-300',
    lightDot: 'bg-indigo-500',
  },
  {
    borderColor: 'border-rose-300',
    hoverBorder: 'hover:border-rose-400',
    bgColor: 'bg-rose-50/95',
    textColor: 'text-rose-950',
    accentColor: '#E11D48',
    badgeBg: 'bg-rose-100/90 text-rose-800 border-rose-300',
    lightDot: 'bg-rose-500',
  },
  {
    borderColor: 'border-cyan-300',
    hoverBorder: 'hover:border-cyan-400',
    bgColor: 'bg-cyan-50/95',
    textColor: 'text-cyan-950',
    accentColor: '#0891B2',
    badgeBg: 'bg-cyan-100/90 text-cyan-800 border-cyan-300',
    lightDot: 'bg-cyan-500',
  },
  {
    borderColor: 'border-orange-300',
    hoverBorder: 'hover:border-orange-400',
    bgColor: 'bg-orange-50/95',
    textColor: 'text-orange-950',
    accentColor: '#EA580C',
    badgeBg: 'bg-orange-100/90 text-orange-800 border-orange-300',
    lightDot: 'bg-orange-500',
  },
  {
    borderColor: 'border-lime-300',
    hoverBorder: 'hover:border-lime-400',
    bgColor: 'bg-lime-50/95',
    textColor: 'text-lime-950',
    accentColor: '#65A30D',
    badgeBg: 'bg-lime-100/90 text-lime-800 border-lime-300',
    lightDot: 'bg-lime-500',
  },
  {
    borderColor: 'border-fuchsia-300',
    hoverBorder: 'hover:border-fuchsia-400',
    bgColor: 'bg-fuchsia-50/95',
    textColor: 'text-fuchsia-950',
    accentColor: '#C026D3',
    badgeBg: 'bg-fuchsia-100/90 text-fuchsia-800 border-fuchsia-300',
    lightDot: 'bg-fuchsia-500',
  },
];

export function getCategoryConfig(categoryKey) {
  if (!categoryKey) return CATEGORY_CONFIG.coding;
  const key = String(categoryKey).trim();
  const lowerKey = key.toLowerCase();

  if (CATEGORY_CONFIG[lowerKey]) {
    return CATEGORY_CONFIG[lowerKey];
  }

  const foundByLabel = Object.values(CATEGORY_CONFIG).find(
    (c) => c.label.toLowerCase() === lowerKey
  );
  if (foundByLabel) return foundByLabel;

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  const palette = PASTEL_PALETTE[index];

  return {
    label: key.charAt(0).toUpperCase() + key.slice(1),
    ...palette,
  };
}

export function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
  } catch {}
}

export function addCustomCategory(newCategory, currentCategories = []) {
  const trimmed = newCategory?.trim();
  if (!trimmed) return currentCategories;

  const isDefault = Boolean(CATEGORY_CONFIG[trimmed.toLowerCase()]);
  if (isDefault) return currentCategories;

  const filtered = currentCategories.filter(
    (c) => c.toLowerCase() !== trimmed.toLowerCase()
  );
  const updated = [trimmed, ...filtered].slice(0, 15);
  saveCustomCategories(updated);
  return updated;
}

export function updateCustomCategory(oldName, newName, currentCategories = []) {
  const trimmed = newName?.trim();
  if (!trimmed || trimmed === oldName) return currentCategories;

  const updated = currentCategories.map((c) => (c === oldName ? trimmed : c));
  saveCustomCategories(updated);
  return updated;
}

export function deleteCustomCategory(categoryToDelete, currentCategories = []) {
  const updated = currentCategories.filter((c) => c !== categoryToDelete);
  saveCustomCategories(updated);
  return updated;
}
