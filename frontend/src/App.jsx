import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Clock,
  Maximize2,
  LocateFixed,
  Search,
  X,
} from 'lucide-react';
import TopHeader from './components/layout/TopHeader';
import TimelineGrid from './components/timeline/TimelineGrid';
import LeftWidgetPanel from './components/widgets/LeftWidgetPanel';
import ActiveBlockHUD from './components/hud/ActiveBlockHUD';
import CommandPalette from './components/CommandPalette';
import FocusZenModal from './components/hud/FocusZenModal';
import AddBlockModal from './components/timeline/AddBlockModal';
import EditBlockModal from './components/timeline/EditBlockModal';
import UndoToast from './components/common/UndoToast';
import ConfirmModal from './components/common/ConfirmModal';
import { soundEngine } from './utils/soundEngine';
import { minuteToPixels, getCurrentDayMinute, getCategoryConfig } from './utils/timeMath';
import { getCircadianTheme, THEME_OPTIONS } from './utils/themeHelper';

/**
 * Local simulation of cascade ripple shift for offline / fallback mode.
 * Matches Laravel TimeBlockService logic to guarantee zero overlap.
 */
function applyLocalRipple(currentBlocks, targetId, payload) {
  const target = currentBlocks.find((b) => b.id === targetId);
  if (!target) return { updatedBlocks: currentBlocks, affected: [] };

  const newStart = payload.start_minute ?? target.start_minute;
  const newDur = payload.duration_minutes ?? target.duration_minutes;
  const targetDate = payload.scheduled_date ?? target.scheduled_date;

  if (newStart + newDur > 1440) {
    throw new Error('Target block interval exceeds 24:00 (1440 minutes).');
  }

  if (!payload.auto_ripple) {
    const overlap = currentBlocks.find(
      (b) =>
        b.id !== targetId &&
        b.scheduled_date === targetDate &&
        newStart < (b.start_minute + b.duration_minutes) &&
        newStart + newDur > b.start_minute
    );
    if (overlap) {
      throw new Error(`Collision detected with "${overlap.title}". Enable auto_ripple to push subsequent blocks.`);
    }

    const updated = currentBlocks.map((b) =>
      b.id === targetId ? { ...b, ...payload, start_minute: newStart, duration_minutes: newDur } : b
    );
    return { updatedBlocks: updated, affected: [targetId] };
  }

  const map = new Map(currentBlocks.map((b) => [b.id, { ...b }]));
  const updatedTarget = {
    ...map.get(targetId),
    ...payload,
    start_minute: newStart,
    duration_minutes: newDur,
  };
  map.set(targetId, updatedTarget);

  let currentEnd = newStart + newDur;
  const visited = new Set([targetId]);
  const affected = [targetId];

  while (true) {
    const colliding = Array.from(map.values())
      .filter(
        (b) =>
          !visited.has(b.id) &&
          b.scheduled_date === targetDate &&
          b.start_minute < currentEnd &&
          b.start_minute + b.duration_minutes > newStart
      )
      .sort((a, b) => a.start_minute - b.start_minute)[0];

    if (!colliding) break;

    visited.add(colliding.id);
    affected.push(colliding.id);
    const shiftStart = currentEnd;
    const shiftEnd = shiftStart + colliding.duration_minutes;

    if (shiftEnd > 1440) {
      throw new Error(`Auto-ripple shift pushes block "${colliding.title}" beyond 24:00 (1440 minutes).`);
    }

    map.set(colliding.id, {
      ...colliding,
      start_minute: shiftStart,
    });

    currentEnd = shiftEnd;
  }

  return { updatedBlocks: Array.from(map.values()), affected };
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isZenModalOpen, setIsZenModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBlockForEdit, setSelectedBlockForEdit] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedStartMinute, setSelectedStartMinute] = useState(540);
  const [isMuted, setIsMuted] = useState(() => soundEngine.getIsMuted());

  const [themePreference, setThemePreference] = useState(() => {
    const saved = localStorage.getItem('kala_theme_mode');
    return saved === 'night' ? 'night' : 'auto';
  });

  const [historyStack, setHistoryStack] = useState([]);
  const [toast, setToast] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [highlightedBlockId, setHighlightedBlockId] = useState(null);
  const highlightTimerRef = useRef(null);

  const timelineContainerRef = useRef(null);

  const initialSeedBlocks = useMemo(() => [
    {
      id: 1,
      title: 'Deep Focus — Laravel Overlap Engine',
      category: 'coding',
      scheduled_date: selectedDate,
      start_minute: 540,
      duration_minutes: 90,
      status: 'completed',
      is_virtual: false,
      notes: 'TimeBlockService & Cascade Ripple Unit Tests',
    },
    {
      id: 2,
      title: 'Sistem Terdistribusi & Jaringan',
      category: 'kuliah',
      scheduled_date: selectedDate,
      start_minute: 660,
      duration_minutes: 100,
      status: 'scheduled',
      is_virtual: false,
      notes: 'Bab 5: Raft Consensus Algorithm',
    },
    {
      id: 3,
      title: 'Istirahat Siang & Lunch',
      category: 'istirahat',
      scheduled_date: selectedDate,
      start_minute: 780,
      duration_minutes: 60,
      status: 'scheduled',
      is_virtual: false,
      notes: 'Power nap & nutritional break',
    },
    {
      id: 4,
      title: 'Arsitektur Frontend React & Pointer Events',
      category: 'deep_work',
      scheduled_date: selectedDate,
      start_minute: 870,
      duration_minutes: 120,
      status: 'scheduled',
      is_virtual: false,
      notes: 'Custom pointer event timeline with 15m snap',
    },
  ], [selectedDate]);

  const [blocks, setBlocks] = useState(initialSeedBlocks);

  useEffect(() => {
    const unsubscribe = soundEngine.subscribe((state) => {
      setIsMuted(state.isMuted);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      const theme = themePreference === 'auto' ? getCircadianTheme() : themePreference;
      document.documentElement.setAttribute('data-time-theme', theme);
    };

    applyTheme();
    localStorage.setItem('kala_theme_mode', themePreference);

    if (themePreference === 'auto') {
      const timer = setInterval(applyTheme, 60000);
      return () => clearInterval(timer);
    }
  }, [themePreference]);

  const showToast = useCallback((message, canUndo = true) => {
    setToast({
      id: Date.now(),
      message,
      canUndo,
    });
  }, []);

  const handleDismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const pushUndoAction = useCallback((action) => {
    setHistoryStack((prev) => [...prev.slice(-9), action]);
  }, []);

  const refreshBlocks = useCallback(async () => {
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.get(
        `/api/blocks?start_date=${selectedDate}&end_date=${selectedDate}`,
        { headers }
      );

      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        setBlocks(res.data.data);
      }
    } catch {}
  }, [selectedDate]);

  useEffect(() => {
    const ensureAuth = async () => {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      if (!token) {
        try {
          const res = await axios.post('/api/auth/login', {
            email: 'demo@kala.test',
            password: 'password',
          });
          if (res.data?.data?.token) {
            localStorage.setItem('auth_token', res.data.data.token);
            refreshBlocks();
          }
        } catch {}
      }
    };
    ensureAuth();
  }, [refreshBlocks]);

  useEffect(() => {
    let ignore = false;
    const fetchOnDateChange = async () => {
      try {
        const token =
          localStorage.getItem('auth_token') ||
          sessionStorage.getItem('auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const res = await axios.get(
          `/api/blocks?start_date=${selectedDate}&end_date=${selectedDate}`,
          { headers }
        );

        if (!ignore && res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setBlocks(res.data.data);
        }
      } catch {
        }
    };

    fetchOnDateChange();
    return () => {
      ignore = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    const handleToggleCommandPalette = () => setIsCommandPaletteOpen(true);
    window.addEventListener('toggle-command-palette', handleToggleCommandPalette);
    return () => window.removeEventListener('toggle-command-palette', handleToggleCommandPalette);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setIsZenModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [currentClock, setCurrentClock] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return {
      todayStr: `${y}-${m}-${day}`,
      minute: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60,
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setCurrentClock({
        todayStr: `${y}-${m}-${day}`,
        minute: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeBlock = useMemo(() => {
    if (selectedDate !== currentClock.todayStr) return null;

    return blocks.find((b) => {
      if (b.status === 'completed' || b.status === 'skipped') return false;
      const start = b.start_minute;
      const end = b.start_minute + b.duration_minutes;
      return currentClock.minute >= start && currentClock.minute < end;
    }) || null;
  }, [blocks, selectedDate, currentClock]);

  const currentDayBlocks = useMemo(() => {
    return blocks.filter((b) => !b.scheduled_date || b.scheduled_date === selectedDate);
  }, [blocks, selectedDate]);

  const availableCategories = useMemo(() => {
    const catMap = new Map();
    for (const b of currentDayBlocks) {
      const cat = b.category || 'coding';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    }
    return Array.from(catMap.entries()).map(([cat, count]) => ({
      category: cat,
      count,
      config: getCategoryConfig(cat),
    }));
  }, [currentDayBlocks]);

  const filteredBlocks = useMemo(() => {
    let result = blocks;
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      result = result.filter((b) => {
        const titleMatch = b.title ? b.title.toLowerCase().includes(query) : false;
        const notesMatch = b.notes ? b.notes.toLowerCase().includes(query) : false;
        const catMatch = b.category ? b.category.toLowerCase().includes(query) : false;
        return titleMatch || notesMatch || catMatch;
      });
    }

    if (selectedCategoryFilter !== 'all') {
      result = result.filter(
        (b) => (b.category || '').toLowerCase() === selectedCategoryFilter.toLowerCase()
      );
    }

    return result;
  }, [blocks, searchQuery, selectedCategoryFilter]);

  const handleJumpToNow = useCallback(() => {
    if (timelineContainerRef.current) {
      const targetMinute = getCurrentDayMinute(new Date());
      const targetTop = minuteToPixels(targetMinute);
      const offset = timelineContainerRef.current.clientHeight / 2.5;
      timelineContainerRef.current.scrollTo({
        top: Math.max(0, targetTop - offset),
        behavior: 'smooth',
      });
      soundEngine.playTick();
    }
  }, []);

  const handleCategoryFilterClick = useCallback((catName) => {
    const isSelected = selectedCategoryFilter.toLowerCase() === catName.toLowerCase();
    const nextFilter = isSelected ? 'all' : catName;
    setSelectedCategoryFilter(nextFilter);

    if (nextFilter !== 'all') {
      const targetBlock = currentDayBlocks.find(
        (b) => (b.category || '').toLowerCase() === nextFilter.toLowerCase()
      );
      if (targetBlock) {
        if (timelineContainerRef.current) {
          const targetTop = minuteToPixels(targetBlock.start_minute);
          const offset = timelineContainerRef.current.clientHeight / 3;
          timelineContainerRef.current.scrollTo({
            top: Math.max(0, targetTop - offset),
            behavior: 'smooth',
          });
        }
        setHighlightedBlockId(targetBlock.id);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          setHighlightedBlockId(null);
        }, 2000);
        soundEngine.playTick();
      }
    } else {
      setHighlightedBlockId(null);
    }
  }, [selectedCategoryFilter, currentDayBlocks]);

  const handleUndo = useCallback(async () => {
    if (historyStack.length === 0) return;

    setToast(null);
    const action = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));

    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (action.type === 'CREATE') {
        setBlocks((prev) => prev.filter((b) => b.id !== action.block.id));
        if (typeof action.block.id === 'number' && action.block.id < 1000000000000) {
          await axios.delete(`/api/blocks/${action.block.id}`, { headers });
        }
        showToast(`Penambahan "${action.block.title}" dibatalkan.`, false);
      } else if (action.type === 'DELETE') {
        setBlocks((prev) => [...prev, action.block]);
        try {
          const res = await axios.post('/api/blocks', action.block, { headers });
          if (res.data?.data) {
            setBlocks((prev) => prev.map((b) => (b.id === action.block.id ? res.data.data : b)));
          }
        } catch {
        }
        showToast(`Penghapusan "${action.block.title}" dibatalkan.`, false);
      } else if (action.type === 'UPDATE') {
        const previousSnapshots = action.snapshots || [];
        setBlocks((prev) => {
          const map = new Map(prev.map((b) => [b.id, b]));
          for (const snap of previousSnapshots) {
            if (map.has(snap.id)) {
              map.set(snap.id, { ...map.get(snap.id), ...snap });
            }
          }
          return Array.from(map.values());
        });

        for (const snap of previousSnapshots) {
          if (typeof snap.id === 'number' && snap.id < 1000000000000) {
            axios.patch(
              `/api/blocks/${snap.id}`,
              {
                start_minute: snap.start_minute,
                duration_minutes: snap.duration_minutes,
                status: snap.status,
                auto_ripple: false,
              },
              { headers }
            ).catch(() => {});
          }
        }
        showToast(`Perubahan "${action.title || 'pengingat'}" dibatalkan.`, false);
      } else if (action.type === 'CLEAR_BLOCKS') {
        const restoredBlocks = action.blocks || [];
        setBlocks((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const toAdd = restoredBlocks.filter((b) => !existingIds.has(b.id));
          return [...prev, ...toAdd].sort((a, b) => a.start_minute - b.start_minute);
        });

        for (const blk of restoredBlocks) {
          if (!blk.is_virtual && typeof blk.id === 'number' && blk.id < 1000000000000) {
            axios.post(
              '/api/blocks',
              {
                title: blk.title,
                category: blk.category,
                scheduled_date: blk.scheduled_date,
                start_minute: blk.start_minute,
                duration_minutes: blk.duration_minutes,
                status: blk.status,
                notes: blk.notes,
              },
              { headers }
            ).catch(() => {});
          }
        }
        showToast('Reset pengingat berhasil dibatalkan.', false);
      }
      soundEngine.playTick();
    } catch {
      showToast('Gagal membatalkan aksi.', false);
    }
  }, [historyStack, showToast]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const tag = e.target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const handleResetTimeline = async () => {
    const targetDate = selectedDate;
    const toClear = blocks.filter((b) => b.scheduled_date === targetDate);

    if (toClear.length === 0) {
      showToast('Tidak ada pengingat untuk direset pada tanggal ini.', false);
      return;
    }

    pushUndoAction({
      type: 'CLEAR_BLOCKS',
      date: targetDate,
      blocks: toClear,
    });

    setBlocks((prev) => prev.filter((b) => b.scheduled_date !== targetDate));

    const token =
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      await axios.delete(`/api/blocks/clear?date=${targetDate}`, { headers });
    } catch {
    }

    showToast('Pengingat hari ini berhasil direset.', true);
    soundEngine.playTrash();
  };

  const handleAddBlock = async (newBlockData, recordHistory = true, stagedAttachment = null) => {
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.post('/api/blocks', newBlockData, { headers });
      if (res.data?.data) {
        let created = res.data.data;

        if (stagedAttachment && created.id) {
          try {
            const formData = new FormData();
            formData.append('attachment', stagedAttachment);
            const attachRes = await axios.post(`/api/blocks/${created.id}/attachment`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                ...headers,
              },
            });
            if (attachRes.data?.data) {
              created = attachRes.data.data;
            }
          } catch {
            showToast('Pengingat dibuat tetapi lampiran gagal diunggah.', false);
          }
        }

        setBlocks((prev) => [...prev, created]);
        if (recordHistory) {
          pushUndoAction({ type: 'CREATE', block: created });
          showToast(`Pengingat "${created.title}" berhasil ditambahkan.`);
        }
        return created;
      }
    } catch (err) {
      if (!err.response || err.response?.status === 401) {
        const newBlock = {
          ...newBlockData,
          id: Date.now(),
          is_virtual: false,
          attachment_name: stagedAttachment ? stagedAttachment.name : null,
          attachment_path: stagedAttachment ? 'local_preview' : null,
        };
        setBlocks((prev) => [...prev, newBlock]);
        if (recordHistory) {
          pushUndoAction({ type: 'CREATE', block: newBlock });
          showToast(`Pengingat "${newBlock.title}" berhasil ditambahkan.`);
        }
        return newBlock;
      }
      throw err;
    }
  };

  const handleBlockUpdated = (updatedBlock) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === updatedBlock.id ? { ...b, ...updatedBlock } : b))
    );
    if (selectedBlockForEdit && selectedBlockForEdit.id === updatedBlock.id) {
      setSelectedBlockForEdit((prev) => ({ ...prev, ...updatedBlock }));
    }
  };

  // Update block handler with ripple cascade handling & undo recording
  const handleUpdateBlock = async (blockId, payload, recordHistory = true) => {
    const targetBlock = blocks.find((b) => b.id === blockId);
    const beforeSnapshots = blocks.map((b) => ({ ...b }));

    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await axios.patch(`/api/blocks/${blockId}`, payload, {
        headers,
      });

      if (res.data?.success && res.data.data) {
        const updated = res.data.data.updated_block;
        const rippled = res.data.data.rippled_blocks || [];

        setBlocks((prev) => {
          const map = new Map(prev.map((b) => [b.id, b]));
          if (updated) map.set(updated.id, { ...map.get(updated.id), ...updated });
          for (const rb of rippled) {
            if (map.has(rb.id)) {
              map.set(rb.id, { ...map.get(rb.id), ...rb });
            }
          }
          return Array.from(map.values());
        });

        if (recordHistory && targetBlock) {
          const affectedIds = new Set([blockId, ...rippled.map((r) => r.id)]);
          const relevantSnapshots = beforeSnapshots.filter((b) => affectedIds.has(b.id));
          pushUndoAction({
            type: 'UPDATE',
            title: targetBlock.title,
            snapshots: relevantSnapshots,
          });
          showToast(`Pengingat "${targetBlock.title}" diperbarui.`);
        }
        return;
      }
    } catch (err) {
      if (err.response?.status === 422) {
        throw err;
      }

      const { updatedBlocks, affected } = applyLocalRipple(blocks, blockId, payload);
      setBlocks(updatedBlocks);

      if (recordHistory && targetBlock) {
        const affectedIds = new Set(affected);
        const relevantSnapshots = beforeSnapshots.filter((b) => affectedIds.has(b.id));
        pushUndoAction({
          type: 'UPDATE',
          title: targetBlock.title,
          snapshots: relevantSnapshots,
        });
        showToast(`Pengingat "${targetBlock.title}" diperbarui.`);
      }
    }
  };

  const handleDeleteBlock = async (blockId, recordHistory = true) => {
    const deleted = blocks.find((b) => b.id === blockId);
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));

    if (deleted && recordHistory) {
      pushUndoAction({ type: 'DELETE', block: deleted });
      showToast(`Pengingat "${deleted.title}" dihapus.`);
    }

    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (typeof blockId === 'number' && blockId < 1000000000000) {
        await axios.delete(`/api/blocks/${blockId}`, { headers });
      }
    } catch {
    }
  };

  const handleExtendActiveBlock = async () => {
    if (!activeBlock) return;
    const newDuration = activeBlock.duration_minutes + 15;
    await handleUpdateBlock(activeBlock.id, {
      duration_minutes: newDuration,
      auto_ripple: true,
    });
  };

  const handleCompleteActiveBlock = async () => {
    if (!activeBlock) return;
    await handleUpdateBlock(activeBlock.id, {
      status: 'completed',
    });
  };

  const handleLoadDemoWorkspace = () => {
    setBlocks([
      {
        id: Date.now() + 1,
        title: 'Deep Focus — Laravel Overlap Engine',
        category: 'coding',
        scheduled_date: selectedDate,
        start_minute: 540,
        duration_minutes: 90,
        status: 'completed',
        is_virtual: false,
        notes: 'TimeBlockService & Cascade Ripple Unit Tests',
      },
      {
        id: Date.now() + 2,
        title: 'Sistem Terdistribusi & Jaringan',
        category: 'kuliah',
        scheduled_date: selectedDate,
        start_minute: 660,
        duration_minutes: 100,
        status: 'scheduled',
        is_virtual: false,
        notes: 'Bab 5: Raft Consensus Algorithm',
      },
      {
        id: Date.now() + 3,
        title: 'Istirahat Siang & Lunch',
        category: 'istirahat',
        scheduled_date: selectedDate,
        start_minute: 780,
        duration_minutes: 60,
        status: 'scheduled',
        is_virtual: false,
        notes: 'Nutritional break & refresh',
      },
      {
        id: Date.now() + 4,
        title: 'Arsitektur Frontend React & Pointer Events',
        category: 'deep_work',
        scheduled_date: selectedDate,
        start_minute: 870,
        duration_minutes: 120,
        status: 'scheduled',
        is_virtual: false,
        notes: 'Custom pointer event timeline with 15m snap',
      },
      {
        id: Date.now() + 5,
        title: 'Review PR & Sinkronisasi DB',
        category: 'coding',
        scheduled_date: selectedDate,
        start_minute: 1020,
        duration_minutes: 60,
        status: 'scheduled',
        is_virtual: false,
        notes: 'Sanctum token & overlap test coverage',
      },
    ]);
    showToast('Demo workspace berhasil dimuat.', false);
  };

  const handleApplyBlueprint = async () => {
    try {
      const token =
        localStorage.getItem('auth_token') ||
        sessionStorage.getItem('auth_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const listRes = await axios.get('/api/blueprints', { headers });
      const available = listRes.data?.data;
      if (Array.isArray(available) && available.length > 0) {
        await axios.post(
          '/api/blueprints/apply',
          {
            blueprint_id: available[0].id,
            target_date: selectedDate,
          },
          { headers }
        );
        await refreshBlocks();
        showToast('Routine blueprint berhasil diterapkan.', false);
        return;
      }
    } catch {
      handleLoadDemoWorkspace();
    }
  };

  const handleOpenAddModal = (minute = 540) => {
    setSelectedStartMinute(minute);
    setIsAddModalOpen(true);
  };

  const handleEmptySlotClick = (minute) => {
    setSelectedStartMinute(minute);
    setIsAddModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans-ui relative antialiased selection:bg-[var(--accent-light)] selection:text-[var(--accent-hover)] transition-colors duration-500">
      {/* Top Header (extracted component) */}
      <TopHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onJumpToNow={handleJumpToNow}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        themePreference={themePreference}
        onThemeChange={setThemePreference}
        isMuted={isMuted}
        onToggleMute={() => soundEngine.toggleMute()}
      />

      {/* Main Layout: Independent 2-Pane Scrolling */}
      <main className="flex-1 min-h-0 overflow-hidden w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 px-6 py-4">
        {/* Left Widget Rail with independent vertical scroll */}
        <div className="h-full overflow-y-auto pl-1 pr-3.5 flex justify-center lg:justify-start">
          <LeftWidgetPanel
            blocks={blocks}
            selectedDate={selectedDate}
            onOpenAddModal={() => handleOpenAddModal(540)}
            onApplyBlueprint={handleApplyBlueprint}
            onLoadDemo={handleLoadDemoWorkspace}
            onResetTimeline={() => setIsResetModalOpen(true)}
          />
        </div>

        {/* Right Main Timeline Viewport with independent vertical scroll */}
        <div className="h-full flex flex-col min-h-0 overflow-hidden">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary,#556B5E)] font-medium shrink-0">
            <div className="flex items-center gap-2.5">
              <Clock size={15} className="text-[var(--accent-hover,#059669)]" />
              <span className="font-semibold text-sm text-[var(--text-primary,#14261C)]">Pengingat Harian</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--accent-light,#E8F5EE)] text-[var(--accent-hover,#059669)] border border-[var(--accent-border,#A7F3D0)]">
                Interval 15 Menit
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleJumpToNow}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[var(--accent-hover,#059669)] bg-[var(--accent-light,#E8F5EE)] hover:opacity-90 border border-[var(--accent-border,#A7F3D0)] rounded-lg transition-colors cursor-pointer active:scale-95 shadow-xs"
                title="Gulir langsung ke posisi waktu sekarang"
              >
                <LocateFixed size={13} />
                <span>Jump to Now</span>
              </button>
              <span className="hidden sm:inline text-[var(--text-secondary,#556B5E)]">
                Klik area kosong untuk menambah pengingat
              </span>
            </div>
          </div>

          {/* Filter & Quick Search Toolbar */}
          <div className="mb-2.5 p-2 rounded-xl bg-[var(--card-bg,#FFFFFF)] border border-[var(--card-border,#DCE7DF)] shadow-xs flex flex-wrap items-center justify-between gap-2.5 shrink-0 transition-colors duration-500">
            {/* Real-time Quick Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary,#556B5E)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pengingat atau catatan..."
                className="w-full bg-[var(--bg-primary,#F4F8F5)] border border-[var(--card-border,#DCE7DF)] rounded-lg pl-8 pr-7 py-1.5 text-xs text-[var(--text-primary,#14261C)] placeholder-[var(--text-secondary,#556B5E)]/60 focus:outline-none focus:border-[#059669] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-secondary,#556B5E)] hover:text-[#14261C] rounded transition-colors cursor-pointer"
                  title="Reset pencarian"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Dynamic Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('all');
                  setHighlightedBlockId(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-[#059669] text-white shadow-xs'
                    : 'bg-[var(--bg-primary,#F4F8F5)] text-[var(--text-secondary,#556B5E)] hover:text-[var(--text-primary,#14261C)] border border-[var(--card-border,#DCE7DF)]'
                }`}
              >
                <span>Semua</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold ${
                  selectedCategoryFilter === 'all' ? 'bg-white/25 text-white' : 'bg-black/5 text-[var(--text-secondary,#556B5E)]'
                }`}>
                  {currentDayBlocks.length}
                </span>
              </button>

              {availableCategories.map(({ category: catName, count, config }) => {
                const isSelected = selectedCategoryFilter.toLowerCase() === catName.toLowerCase();
                return (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => handleCategoryFilterClick(catName)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? `${config.borderColor} ${config.bgColor} ${config.textColor} ring-1 ring-[#059669]/50 shadow-xs font-semibold`
                        : 'border-[var(--card-border,#DCE7DF)] bg-[var(--bg-primary,#F4F8F5)] text-[var(--text-secondary,#556B5E)] hover:border-[#B8CABE]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: config.accentColor }}
                    />
                    <span className="truncate max-w-[110px]">{config.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                      isSelected ? 'bg-black/10' : 'bg-black/5 text-[var(--text-secondary,#556B5E)]'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}

              {(searchQuery || selectedCategoryFilter !== 'all') && (
                <span className="text-[11px] font-medium text-[var(--text-secondary,#556B5E)] ml-1 shrink-0 tabular-nums">
                  ({filteredBlocks.length} cocok)
                </span>
              )}
            </div>
          </div>

          {/* Interactive 24-Hour Timeline Canvas */}
          <div className="flex-1 min-h-0 rounded-xl border border-[var(--card-border,#DCE7DF)] overflow-hidden bg-[var(--card-bg,#FFFFFF)] shadow-xs">
            <TimelineGrid
              ref={timelineContainerRef}
              blocks={filteredBlocks}
              highlightedBlockId={highlightedBlockId}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
              onEditBlock={(block) => setSelectedBlockForEdit(block)}
              onOpenAddModal={handleOpenAddModal}
              onEmptySlotClick={handleEmptySlotClick}
              onNotify={(msg, canUndo) => showToast(msg, canUndo)}
              selectedDate={selectedDate}
              className="h-full"
            />
          </div>
        </div>
      </main>

      {/* Floating Undo Toast (Bottom-Right, 5s) */}
      <UndoToast
        toast={toast}
        onUndo={handleUndo}
        onDismiss={handleDismissToast}
      />

      <ActiveBlockHUD
        blocks={blocks}
        selectedDate={selectedDate}
        onUpdateBlock={handleUpdateBlock}
        onOpenZenModal={() => setIsZenModalOpen(true)}
      />

      {/* Fast Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        selectedDate={selectedDate}
        existingBlocks={blocks}
        onBlockCreated={(newBlock) => {
          setBlocks((prev) => {
            const filtered = prev.filter((b) => b.id !== newBlock.id);
            return [...filtered, newBlock];
          });
        }}
        onBlueprintApplied={async () => {
          await refreshBlocks();
        }}
      />

      {/* Fullscreen Focus Zen Mode Modal */}
      <FocusZenModal
        isOpen={isZenModalOpen}
        onClose={() => setIsZenModalOpen(false)}
        activeBlock={activeBlock}
        onExtend={handleExtendActiveBlock}
        onComplete={handleCompleteActiveBlock}
      />

      {/* Add Block Modal */}
      <AddBlockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddBlock}
        initialStartMinute={selectedStartMinute}
        scheduledDate={selectedDate}
      />

      {/* Edit Block & Document Attachment Modal */}
      <EditBlockModal
        isOpen={Boolean(selectedBlockForEdit)}
        block={selectedBlockForEdit}
        onClose={() => setSelectedBlockForEdit(null)}
        onUpdateBlock={handleUpdateBlock}
        onBlockUpdated={handleBlockUpdated}
      />

      {/* Reset Timeline Confirmation Modal */}
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Reset Timeline Hari Ini"
        message="Apakah Anda yakin ingin menghapus semua jadwal pada tanggal ini? Tindakan ini dapat dibatalkan dengan menekan tombol Undo atau shortcut Ctrl+Z."
        confirmLabel="Reset Jadwal"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={handleResetTimeline}
        onClose={() => setIsResetModalOpen(false)}
      />
    </div>
  );
}
