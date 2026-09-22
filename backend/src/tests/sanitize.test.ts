import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../app';
import { sanitizeHtml } from '../lib/sanitize';

/**
 * Sanitasi HTML rich text:
 * - Unit test: perilaku sanitizeHtml (payload XSS harus hilang, konten sah utuh)
 * - Integrasi: PUT lesson content via API → payload tersimpan dalam bentuk bersih
 */

const ts = Date.now();
let teacherToken = '';
let courseId = '';
let sectionId = '';
let textLessonId = '';
let assignLessonId = '';

async function login(email: string, password = 'password123'): Promise<string> {
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.accessToken as string;
}

async function api<T = any>(path: string, opts: { method?: string; token?: string; body?: any } = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(`/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  let data: T;
  try {
    data = await res.json();
  } catch {
    data = undefined as any;
  }
  return { status: res.status, data };
}

// ————————————————————————————————————————————————
// UNIT — perilaku sanitizeHtml
// ————————————————————————————————————————————————
describe('sanitizeHtml (unit)', () => {
  it('menghapus tag script/style/iframe', () => {
    const out = sanitizeHtml('<p>aman</p><script>alert(1)</script><style>body{}</style><iframe src="//evil"></iframe>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('<p>aman</p>');
  });

  it('menghapus SEMUA event handler (bukan cuma yang ada di FORBID_ATTR)', () => {
    // onfocus/onblur/onkeydown TIDAK ada di daftar FORBID_ATTR sanitize.ts —
    // test ini membuktikan default profile DOMPurify yang bekerja, bukan daftarnya.
    const out = sanitizeHtml(
      '<img src=x onerror=alert(1)><div onclick=x()><input onfocus=x() onblur=x()><p onkeydown=x()>t</p>'
    );
    expect(out).not.toMatch(/on\w+\s*=/i);
  });

  it('memblokir URI javascript: dan data:', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">a</a><img src="data:text/html,<script>x</script>">');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('data:');
  });

  it('menjaga konten rich text yang sah tetap utuh', () => {
    const input = [
      '<h2>Judul</h2>',
      '<p>Paragraf dengan <strong>tebal</strong>, <em>miring</em>, <u>garis bawah</u>.</p>',
      '<blockquote class="border-l-4 border-primary-500 pl-3 italic my-2">Kutipan</blockquote>',
      '<ul><li>Poin 1</li><li>Poin 2</li></ul>',
      '<a href="https://example.com">Link sah</a>',
      '<pre><code>const x = 1;</code></pre>',
    ].join('');
    const out = sanitizeHtml(input);
    expect(out).toContain('<h2>Judul</h2>');
    expect(out).toContain('<strong>tebal</strong>');
    expect(out).toContain('<em>miring</em>');
    expect(out).toContain('<u>garis bawah</u>');
    expect(out).toContain('class="border-l-4'); // class Tailwind dari editor harus survive
    expect(out).toContain('<li>Poin 1</li>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('<code>const x = 1;</code>');
  });

  it('string kosong kembali apa adanya', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

// ————————————————————————————————————————————————
// INTEGRASI — payload lewat API tersimpan bersih di DB
// ————————————————————————————————————————————————
describe('Sanitasi konten lesson via API (integrasi)', () => {
  beforeAll(async () => {
    teacherToken = await login('teacher@elearning.com');

    const c = await api('/courses', {
      method: 'POST',
      token: teacherToken,
      body: {
        title: `Kursus Sanitize Test ${ts}`,
        description: 'Kursus untuk uji sanitasi XSS',
        level: 'beginner',
        price: 0,
        certificateEnabled: false,
      },
    });
    expect(c.status).toBe(201);
    courseId = c.data.id as string;

    const sec = await api(`/courses/${courseId}/sections`, { method: 'POST', token: teacherToken, body: { title: 'Bagian 1' } });
    expect(sec.status).toBe(201);
    sectionId = sec.data.id as string;

    const l1 = await api(`/sections/${sectionId}/lessons`, { method: 'POST', token: teacherToken, body: { title: 'Materi Text', type: 'text' } });
    expect(l1.status).toBe(201);
    textLessonId = l1.data.id as string;

    const l2 = await api(`/sections/${sectionId}/lessons`, { method: 'POST', token: teacherToken, body: { title: 'Tugas', type: 'assignment' } });
    expect(l2.status).toBe(201);
    assignLessonId = l2.data.id as string;
  }, 30000);

  afterAll(async () => {
    // Best-effort cleanup (konsisten: test lain tidak cleanup, tapi DB dev tetap rapi)
    if (courseId) await api(`/courses/${courseId}`, { method: 'DELETE', token: teacherToken });
  });

  it('textContent: payload XSS hilang setelah disimpan via API', async () => {
    const payload =
      '<h2>Ringkasan</h2><p>Materi aman.</p>' +
      '<img src=x onerror=alert(1)><script>alert(2)</script>' +
      '<a href="javascript:alert(3)">jangan klik</a>';

    const put = await api(`/sections/${sectionId}/lessons/${textLessonId}/content`, {
      method: 'PUT',
      token: teacherToken,
      body: { textContent: payload },
    });
    expect(put.status).toBe(200);

    const get = await api(`/sections/${sectionId}/lessons/${textLessonId}`, { token: teacherToken });
    expect(get.status).toBe(200);
    const stored = get.data.content.textContent as string;

    expect(stored).toContain('<h2>Ringkasan</h2>');
    expect(stored).toContain('<p>Materi aman.</p>');
    expect(stored).not.toMatch(/on\w+\s*=/i);
    expect(stored).not.toContain('<script');
    expect(stored).not.toContain('javascript:');
  });

  it('assignmentInstructions: payload XSS hilang setelah disimpan via API', async () => {
    const payload =
      '<p>Kerjakan tugas ini.</p><div onmouseover=steal()><a href="data:text/html,x">link jahat</a></div>';

    const put = await api(`/sections/${sectionId}/lessons/${assignLessonId}/content`, {
      method: 'PUT',
      token: teacherToken,
      body: { assignmentInstructions: payload },
    });
    expect(put.status).toBe(200);

    const get = await api(`/sections/${sectionId}/lessons/${assignLessonId}`, { token: teacherToken });
    expect(get.status).toBe(200);
    const stored = get.data.content.assignmentInstructions as string;

    expect(stored).toContain('<p>Kerjakan tugas ini.</p>');
    expect(stored).not.toMatch(/on\w+\s*=/i);
    expect(stored).not.toContain('data:');
  });
});
