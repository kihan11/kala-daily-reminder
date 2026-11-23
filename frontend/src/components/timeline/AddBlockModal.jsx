import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Tag,
  FileText,
  Paperclip,
  UploadCloud,
  AlertCircle,
  Plus,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  formatMinuteToTime,
  timeToMinute,
} from '../../utils/timeMath';
import {
  CATEGORY_CONFIG,
  getCategoryConfig,
  loadCustomCategories,
  addCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
} from '../../utils/categoryHelper';
import {
  getFileTypeBadge,
  formatFileSize,
} from '../../utils/fileHelper';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const DURATION_PRESETS = [
  { value: 15, label: '15 Menit' },
  { value: 30, label: '30 Menit' },
  { value: 45, label: '45 Menit' },
  { value: 60, label: '1 Jam' },
  { value: 90, label: '1.5 Jam' },
  { value: 120, label: '2 Jam' },
  { value: 180, label: '3 Jam' },
  { value: 240, label: '4 Jam' },
];

export default function AddBlockModal({
  isOpen,
  onClose,
  onSubmit,
  initialStartMinute = 540,
  initialDuration = 60,
  scheduledDate,
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('coding');
  const [customCategories, setCustomCategories] = useState(() => loadCustomCategories());
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const [editingCategoryInput, setEditingCategoryInput] = useState('');

  const [startTimeStr, setStartTimeStr] = useState(() =>
    formatMinuteToTime(initialStartMinute)
  );
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);
  const [isManualDuration, setIsManualDuration] = useState(false);
  const [endTimeStr, setEndTimeStr] = useState(() =>
    formatMinuteToTime(initialStartMinute + initialDuration)
  );

  const [notes, setNotes] = useState('');
  const [stagedFile, setStagedFile] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const startStr = formatMinuteToTime(initialStartMinute);
      setStartTimeStr(startStr);
      setDurationMinutes(initialDuration);
      setEndTimeStr(formatMinuteToTime(initialStartMinute + initialDuration));
      const isPreset = DURATION_PRESETS.some((p) => p.value === initialDuration);
      setIsManualDuration(!isPreset);
      setStagedFile(null);
      setError(null);
      setIsAddingCustomCategory(false);
      setCustomCategoryInput('');
      setEditingCategoryName(null);
      setEditingCategoryInput('');
    }
  }, [isOpen, initialStartMinute, initialDuration]);

  if (!isOpen) return null;

  const handleStartTimeChange = (val) => {
    setStartTimeStr(val);
    const startMin = timeToMinute(val);
    setEndTimeStr(formatMinuteToTime(startMin + durationMinutes));
  };

  const handleDurationPresetChange = (val) => {
    if (val === 'custom') {
      setIsManualDuration(true);
      return;
    }
    const dur = Number(val);
    setIsManualDuration(false);
    setDurationMinutes(dur);
    const startMin = timeToMinute(startTimeStr);
    setEndTimeStr(formatMinuteToTime(startMin + dur));
  };

  const handleManualMinutesChange = (val) => {
    const raw = Number(val);
    const clamped = Math.max(5, Math.min(720, raw || 5));
    setDurationMinutes(clamped);
    const startMin = timeToMinute(startTimeStr);
    setEndTimeStr(formatMinuteToTime(startMin + clamped));
  };

  const handleEndTimeChange = (val) => {
    setEndTimeStr(val);
    const startMin = timeToMinute(startTimeStr);
    const endMin = timeToMinute(val);
    if (endMin > startMin) {
      const diff = Math.min(720, Math.max(5, endMin - startMin));
      setDurationMinutes(diff);
    }
  };

  const handleSaveCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) return;
    const updated = addCustomCategory(trimmed, customCategories);
    setCustomCategories(updated);
    setCategory(trimmed);
    setCustomCategoryInput('');
    setIsAddingCustomCategory(false);
  };

  const handleUpdateCustomCategory = (oldName) => {
    const trimmed = editingCategoryInput.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCategoryName(null);
      return;
    }
    const updated = updateCustomCategory(oldName, trimmed, customCategories);
    setCustomCategories(updated);
    if (category === oldName) {
      setCategory(trimmed);
    }
    setEditingCategoryName(null);
  };

  const handleDeleteCustomCategory = (catToDelete) => {
    const updated = deleteCustomCategory(catToDelete, customCategories);
    setCustomCategories(updated);
    if (category === catToDelete) {
      setCategory('coding');
    }
    if (editingCategoryName === catToDelete) {
      setEditingCategoryName(null);
    }
  };

  const handleValidateFile = (file) => {
    if (!file) return false;

    if (file.size > MAX_FILE_SIZE) {
      setError('Ukuran berkas melebihi batas maksimal 10MB.');
      return false;
    }

    const name = file.name.toLowerCase();
    const isValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!isValidExt) {
      setError('Format berkas tidak didukung. Harap gunakan PDF, Word, Excel, CSV, atau TXT.');
      return false;
    }

    setError(null);
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && handleValidateFile(file)) {
      setStagedFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && handleValidateFile(file)) {
      setStagedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul pengingat tidak boleh kosong.');
      return;
    }

    const startMinute = timeToMinute(startTimeStr);
    if (startMinute + durationMinutes > 1440) {
      setError('Rentang waktu melebihi batas 24:00 (1440 menit).');
      return;
    }

    if (durationMinutes < 5 || durationMinutes > 720) {
      setError('Durasi harus berada di antara 5 hingga 720 menit.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        category,
        scheduled_date:
          scheduledDate || new Date().toISOString().split('T')[0],
        start_minute: startMinute,
        duration_minutes: durationMinutes,
        status: 'scheduled',
        notes: notes?.trim() ? notes.trim() : null,
      };

      if (!CATEGORY_CONFIG[category.toLowerCase()]) {
        const updated = addCustomCategory(category, customCategories);
        setCustomCategories(updated);
      }

      await onSubmit(payload, stagedFile);
      setTitle('');
      setNotes('');
      setStagedFile(null);
      onClose();
    } catch (err) {
      const responseData = err.response?.data;
      let msg = '';
      if (responseData?.errors) {
        const messages = Object.values(responseData.errors).flat();
        msg = messages.join('. ') || responseData.message || 'Gagal menambahkan pengingat.';
      } else if (responseData?.message) {
        msg = responseData.message;
      } else if (err.message) {
        msg = err.message;
      } else {
        msg = 'Gagal menambahkan pengingat.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white border border-[#DCE7DF] rounded-2xl shadow-xl p-6 text-[#14261C] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#DCE7DF]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8F5EE] text-[#059669] flex items-center justify-center">
              <Clock size={16} />
            </div>
            <h3 className="font-bold text-base text-[#14261C]">
              Tambah Pengingat
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#556B5E] hover:text-[#14261C] hover:bg-[#F4F8F5] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#556B5E] mb-1.5">
              Judul Pengingat / Kegiatan
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: 07:00 Olahraga Pagi atau Belajar..."
              className="w-full bg-[#F4F8F5] border border-[#DCE7DF] rounded-lg px-3 py-2 text-sm text-[#14261C] placeholder-[#556B5E]/60 focus:outline-none focus:border-[#059669] transition-colors"
            />
          </div>

          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#556B5E] flex items-center gap-1.5">
                <Tag size={13} />
                <span>Kategori</span>
              </label>
              {!isAddingCustomCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingCustomCategory(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#059669] hover:text-[#047857] transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Kategori Kustom</span>
                </button>
              )}
            </div>

            {/* Inline Custom Category Creator */}
            {isAddingCustomCategory && (
              <div className="mb-2 p-2 rounded-lg bg-[#E8F5EE]/60 border border-[#A7F3D0] flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveCustomCategory();
                    }
                  }}
                  placeholder="Ketik nama kategori baru..."
                  className="flex-1 bg-white border border-[#DCE7DF] rounded-md px-2.5 py-1 text-xs text-[#14261C] focus:outline-none focus:border-[#059669]"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomCategory}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-md transition-colors cursor-pointer shrink-0"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCustomCategory(false);
                    setCustomCategoryInput('');
                  }}
                  className="p-1 text-[#556B5E] hover:text-rose-600 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Category Choices Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-0.5">
              {/* 6 Default Presets */}
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const isSelected = category.toLowerCase() === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? `${config.borderColor} ${config.bgColor} ${config.textColor} shadow-xs ring-1 ring-[#059669]/40`
                        : 'border-[#DCE7DF] bg-[#F4F8F5] text-[#556B5E] hover:border-[#B8CABE]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: config.accentColor }}
                    />
                    <span className="truncate">{config.label}</span>
                  </button>
                );
              })}

              {/* Saved Custom Categories */}
              {customCategories
                .filter((catName) => !CATEGORY_CONFIG[catName.toLowerCase()])
                .map((catName) => {
                  const isSelected = category.toLowerCase() === catName.toLowerCase();
                  const isEditing = editingCategoryName === catName;
                  const config = getCategoryConfig(catName);

                  if (isEditing) {
                    return (
                      <div
                        key={catName}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 p-1 rounded-lg border border-[#059669] bg-white text-xs col-span-1 shadow-xs"
                      >
                        <input
                          type="text"
                          autoFocus
                          value={editingCategoryInput}
                          onChange={(e) => setEditingCategoryInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateCustomCategory(catName);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingCategoryName(null);
                            }
                          }}
                          className="w-full min-w-0 bg-transparent px-1.5 py-0.5 text-xs text-[#14261C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCustomCategory(catName)}
                          className="p-1 text-[#059669] hover:bg-[#E8F5EE] rounded shrink-0 cursor-pointer"
                          title="Simpan nama kategori"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryName(null)}
                          className="p-1 text-[#556B5E] hover:text-rose-600 rounded shrink-0 cursor-pointer"
                          title="Batal edit"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={catName}
                      onClick={() => setCategory(catName)}
                      className={`group relative flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? `${config.borderColor} ${config.bgColor} ${config.textColor} shadow-xs ring-1 ring-[#059669]/40`
                          : 'border-[#DCE7DF] bg-[#F4F8F5] text-[#556B5E] hover:border-[#B8CABE]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: config.accentColor }}
                        />
                        <span className="truncate">{catName}</span>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryName(catName);
                            setEditingCategoryInput(catName);
                          }}
                          className="p-1 rounded text-[#556B5E] hover:text-[#059669] hover:bg-white/80 transition-colors cursor-pointer"
                          title="Edit nama kategori"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomCategory(catName);
                          }}
                          className="p-1 rounded text-[#556B5E] hover:text-rose-600 hover:bg-white/80 transition-colors cursor-pointer"
                          title="Hapus kategori"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Time & Duration Controls */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#556B5E] mb-1.5">
                  Jam Mulai
                </label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-full bg-[#F4F8F5] border border-[#DCE7DF] rounded-lg px-3 py-2 text-xs font-sans-ui font-medium tabular-nums text-[#14261C] focus:outline-none focus:border-[#059669] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#556B5E] mb-1.5">
                  Pilihan Durasi
                </label>
                <select
                  value={isManualDuration ? 'custom' : durationMinutes}
                  onChange={(e) => handleDurationPresetChange(e.target.value)}
                  className="w-full bg-[#F4F8F5] border border-[#DCE7DF] rounded-lg px-3 py-2 text-xs font-sans-ui font-medium tabular-nums text-[#14261C] focus:outline-none focus:border-[#059669] transition-colors cursor-pointer"
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="custom">Manual (Kustom)</option>
                </select>
              </div>
            </div>

            {/* Manual Duration & End-Time Row */}
            {isManualDuration && (
              <div className="p-3 rounded-xl bg-[#F4F8F5] border border-[#DCE7DF] grid grid-cols-2 gap-3 animate-in fade-in duration-100">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#556B5E] mb-1">
                    Durasi (5–720 m)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={720}
                    value={durationMinutes}
                    onChange={(e) => handleManualMinutesChange(e.target.value)}
                    className="w-full bg-white border border-[#DCE7DF] rounded-lg px-3 py-1.5 text-xs font-sans-ui font-semibold tabular-nums text-[#14261C] focus:outline-none focus:border-[#059669]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#556B5E] mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={endTimeStr}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="w-full bg-white border border-[#DCE7DF] rounded-lg px-3 py-1.5 text-xs font-sans-ui font-semibold tabular-nums text-[#14261C] focus:outline-none focus:border-[#059669]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Document Attachment Dropzone (Optional) */}
          <div className="pt-2 border-t border-[#DCE7DF]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#556B5E] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip size={13} className="text-[#059669]" />
                <span>Lampiran Dokumen (Opsional)</span>
              </span>
              <span className="text-[11px] font-normal text-[#556B5E]">
                Maks 10MB
              </span>
            </label>

            {/* Selected File Preview Badge */}
            {stagedFile ? (
              <div className="p-2.5 rounded-xl border border-[#A7F3D0] bg-[#E8F5EE]/60 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {(() => {
                    const badge = getFileTypeBadge(stagedFile.name);
                    return (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${badge.bgColor} ${badge.textColor} ${badge.borderColor}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-[#14261C] truncate">
                      {stagedFile.name}
                    </span>
                    <span className="block text-[11px] text-[#556B5E]">
                      {formatFileSize(stagedFile.size)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStagedFile(null)}
                  className="p-1 rounded-md text-[#556B5E] hover:text-rose-600 hover:bg-white transition-colors cursor-pointer"
                  title="Hapus pilihan berkas"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-3.5 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                  isDraggingOver
                    ? 'border-[#059669] bg-[#E8F5EE]'
                    : 'border-[#DCE7DF] hover:border-[#059669] bg-[#F4F8F5]/50 hover:bg-[#F4F8F5]'
                }`}
              >
                <UploadCloud size={18} className="text-[#059669]" />
                <span className="text-xs font-medium text-[#14261C]">
                  Tarik berkas PDF, Word, atau Excel ke sini
                </span>
                <span className="text-[11px] text-[#556B5E]">
                  atau klik untuk memilih berkas dari perangkat
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#556B5E] mb-1.5 flex items-center gap-1.5">
              <FileText size={13} />
              <span>Catatan Tambahan (Opsional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan kecil, referensi materi, atau tautan..."
              rows={2}
              className="w-full bg-[#F4F8F5] border border-[#DCE7DF] rounded-lg px-3 py-2 text-xs text-[#14261C] placeholder-[#556B5E]/60 focus:outline-none focus:border-[#059669] transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#DCE7DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-[#556B5E] hover:text-[#14261C] hover:bg-[#F4F8F5] rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pengingat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
