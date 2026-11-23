import axios from 'axios';

/**
 * File extension and badge styling utility for document attachments.
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function getFileTypeBadge(filename) {
  const ext = getFileExtension(filename);

  switch (ext) {
    case 'pdf':
      return {
        label: 'PDF',
        bgColor: 'bg-rose-50',
        textColor: 'text-rose-700',
        borderColor: 'border-rose-200',
      };
    case 'doc':
    case 'docx':
      return {
        label: ext.toUpperCase(),
        bgColor: 'bg-sky-50',
        textColor: 'text-sky-700',
        borderColor: 'border-sky-200',
      };
    case 'xls':
    case 'xlsx':
      return {
        label: ext.toUpperCase(),
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
      };
    case 'csv':
      return {
        label: 'CSV',
        bgColor: 'bg-teal-50',
        textColor: 'text-teal-700',
        borderColor: 'border-teal-200',
      };
    case 'txt':
      return {
        label: 'TXT',
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-300',
      };
    default:
      return {
        label: ext ? ext.toUpperCase() : 'DOC',
        bgColor: 'bg-slate-100',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-200',
      };
  }
}

export function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Download or view authenticated document attachment.
 */
export async function downloadAttachmentFile(blockId, fileName = 'attachment', apiBaseUrl = '/api') {
  const token =
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('auth_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await axios.get(`${apiBaseUrl}/blocks/${blockId}/attachment`, {
    headers,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  });
  const blobUrl = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
}
