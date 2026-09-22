import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitasi HTML rich text (output TipTap) sebelum disimpan ke DB.
 * Menghapus script, event handler, iframe/embed, dsb.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return html;
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?):|mailto|#)/i,
  });
}
