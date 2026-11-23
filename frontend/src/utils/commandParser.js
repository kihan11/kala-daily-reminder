export function parseCommandInput(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  const bpMatch = trimmed.match(
    /^(?:terapkan\s+blueprint|terapkan|apply\s+blueprint|apply|blueprint)\s+(.+)$/i
  );
  if (bpMatch) {
    return {
      type: 'APPLY_BLUEPRINT',
      blueprintName: bpMatch[1].trim(),
      raw: trimmed,
    };
  }

  const timeRegex = /\b(\d{1,2})[:.](\d{2})\b/;
  const timeMatch = trimmed.match(timeRegex);

  if (timeMatch) {
    const timeIndex = timeMatch.index;
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const start_minute = Math.min(1439, Math.max(0, hour * 60 + minute));
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    let title = trimmed.substring(0, timeIndex).trim();
    const afterTime = trimmed.substring(timeIndex + timeMatch[0].length).trim();

    let category = 'coding';
    let duration_minutes = 60;
    let notes = '';

    let remainder = afterTime;
    const catMatch = remainder.match(/#([a-zA-Z0-9_-]+)/);
    if (catMatch) {
      const rawCat = catMatch[1].toLowerCase();
      if (['coding', 'code', 'ngoding'].includes(rawCat)) {
        category = 'coding';
      } else if (['kuliah', 'study', 'belajar', 'lecture', 'tugas'].includes(rawCat)) {
        category = 'kuliah';
      } else if (['deep_work', 'deepwork', 'fokus', 'focus', 'riset'].includes(rawCat)) {
        category = 'deep_work';
      } else if (['istirahat', 'break', 'rest', 'makan', 'lunch', 'tidur'].includes(rawCat)) {
        category = 'istirahat';
      } else {
        category = rawCat;
      }
      remainder = remainder.replace(catMatch[0], ' ').trim();
    }

    const durMatch = remainder.match(
      /\b(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+)\s*m(?:in)?)?|(\d+)\s*m(?:in(?:utes?)?)?|(\d+)\s*(?:j|jam)|(\d+))\b/i
    );
    if (durMatch) {
      if (durMatch[1]) {
        const hours = parseFloat(durMatch[1]);
        const mins = durMatch[2] ? parseInt(durMatch[2], 10) : 0;
        duration_minutes = Math.round(hours * 60) + mins;
      } else if (durMatch[3]) {
        duration_minutes = parseInt(durMatch[3], 10);
      } else if (durMatch[4]) {
        duration_minutes = parseInt(durMatch[4], 10) * 60;
      } else if (durMatch[5]) {
        duration_minutes = parseInt(durMatch[5], 10);
      }
      remainder = remainder.replace(durMatch[0], ' ').trim();
    }

    notes = remainder.replace(/\s+/g, ' ').trim();

    if (!title && notes) {
      title = notes;
      notes = '';
    } else if (!title) {
      title = 'Quick Task';
    }

    return {
      type: 'CREATE_BLOCK',
      title,
      start_minute,
      duration_minutes,
      timeStr,
      category,
      notes: notes || undefined,
      raw: trimmed,
    };
  }

  return {
    type: 'UNKNOWN',
    query: trimmed,
  };
}
