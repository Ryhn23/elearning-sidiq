/**
 * Sanitizer frontend (defense-in-depth render)
 * Mirrors behaviour tests dari backend/src/tests/sanitize.test.ts
 */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitizeHtml (frontend render guard)', () => {
  it('menghapus script/iframe dan event handler', () => {
    const out = sanitizeHtml(
      '<p>aman</p><script>alert(1)</script><iframe src="//evil"></iframe><img src=x onerror=alert(1)><div onclick=x()>'
    );
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<iframe');
    expect(out).not.toMatch(/on\w+\s*=/i);
    expect(out).toContain('<p>aman</p>');
  });

  it('memblokir URI javascript: dan data: pada <a href> (vektor eksekusi)', () => {
    // Catatan: <img src="data:..."> boleh survive di DOMPurify browser — itu AMAN
    // (img tidak mengeksekusi script). Yang berbahaya: data:/javascript: pada href/src
    // navigable (<a>, <iframe>) — dan iframe sudah diblokir total via FORBID_TAGS.
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">a</a><a href="data:text/html,<script>alert(1)</script>">b</a>'
    );
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('data:');
    expect(out).not.toContain('<script');
  });

  it('menjaga konten rich text sah (class Tailwind, list, link)', () => {
    const input =
      '<h2>Judul</h2><blockquote class="border-l-4 border-primary-500 pl-3 italic my-2">Kutipan</blockquote><ul><li>Item</li></ul><a href="https://example.com">sah</a>';
    const out = sanitizeHtml(input);
    expect(out).toContain('<h2>Judul</h2>');
    expect(out).toContain('class="border-l-4');
    expect(out).toContain('<li>Item</li>');
    expect(out).toContain('href="https://example.com"');
  });

  it('input kosong/null/undefined menjadi string kosong', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
