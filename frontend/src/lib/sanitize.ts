import DOMPurify, { type Config } from 'dompurify';

/**
 * Sanitasi HTML rich text (output TipTap) di sisi render — defense-in-depth.
 *
 * Backend sudah men-sanitize sebelum simpan ke DB (backend/src/lib/sanitize.ts);
 * lapisan ini melindungi render untuk data yang tersimpan SEBELUM sanitasi
 * backend aktif, serta preview editor.
 *
 * JAGAKAN konfig ini tetap sinkron dengan backend/src/lib/sanitize.ts.
 */
const DOMPURIFY_CONFIG: Config = {
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?):|mailto|#)/i,
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}
