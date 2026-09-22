import nodemailer from 'nodemailer';

type MailerTransport = ReturnType<typeof nodemailer.createTransport>;

/**
 * Email service (Nodemailer).
 * Jika SMTP_HOST tidak diset → email hanya di-log ke console (dev mode),
 * sehingga seluruh flow tetap berfungsi tanpa infrastruktur mail.
 */

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@elearning.local';
export const APP_URL = process.env.APP_URL || 'http://localhost:5174';

let transporter: MailerTransport | null = null;

function getTransporter() {
  if (!SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS || '' } : undefined,
    });
  }
  return transporter;
}

export interface SendResult {
  sent: boolean;
  dryRun?: boolean;
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<SendResult> {
  const t = getTransporter();
  if (!t) {
    // Dev mode: tidak ada SMTP → log saja (jangan pernah gagal)
    console.log(`[email:dry-run] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, dryRun: true };
  }
  await t.sendMail({ from: FROM_EMAIL, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  return { sent: true };
}

function wrap(html: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
    <div style="background:#4f46e5;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0;font-size:18px;font-weight:bold">E-Learning Platform</div>
    <div style="padding:24px;color:#374151;line-height:1.6">${html}</div>
    <div style="padding:16px 24px;background:#f9fafb;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af">Email ini dikirim otomatis oleh sistem E-Learning Platform.</div>
  </div>`;
}

function btn(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${label}</a>`;
}

// ============================================================
// Templates
// ============================================================

export function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: 'Selamat datang di E-Learning Platform',
    html: wrap(`<p>Halo <b>${name}</b>,</p><p>Akun Anda sudah aktif. Mulai belajar sekarang!</p>`),
  });
}

export function sendEnrollmentConfirmed(to: string, name: string, courseTitle: string) {
  return sendEmail({
    to,
    subject: `Anda terdaftar di ${courseTitle}`,
    html: wrap(`<p>Halo <b>${name}</b>,</p><p>Anda berhasil mendaftar kursus <b>${courseTitle}</b>. Selamat belajar!</p>`),
  });
}

export function sendAssignmentGraded(to: string, name: string, courseTitle: string, score: number | null) {
  return sendEmail({
    to,
    subject: `Tugas Anda di ${courseTitle} sudah dinilai`,
    html: wrap(`<p>Halo <b>${name}</b>,</p><p>Tugas Anda pada kursus <b>${courseTitle}</b> telah dikoreksi. Skor: <b>${score ?? '-'}%</b>. Silakan cek feedback dari pengajar.</p>`),
  });
}

export function sendQuizResult(to: string, name: string, courseTitle: string, percentage: number, passed: boolean) {
  return sendEmail({
    to,
    subject: `Hasil quiz ${courseTitle}`,
    html: wrap(`<p>Halo <b>${name}</b>,</p><p>Hasil quiz Anda pada kursus <b>${courseTitle}</b>: <b>${percentage}%</b> — ${passed ? 'LULUS ✅' : 'belum lulus, silakan coba lagi'}.</p>`),
  });
}

export function sendCertificateIssued(to: string, name: string, courseTitle: string, code: string) {
  return sendEmail({
    to,
    subject: `Sertifikat Anda untuk ${courseTitle} sudah siap`,
    html: wrap(
      `<p>Halo <b>${name}</b>,</p><p>Selamat! Anda telah menyelesaikan kursus <b>${courseTitle}</b>. Sertifikat digital Anda sudah tersedia.</p>
       <p>Kode verifikasi: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${code}</code></p>`
    ),
  });
}

export function sendPasswordReset(to: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return sendEmail({
    to,
    subject: 'Reset password E-Learning',
    html: wrap(
      `<p>Halo <b>${name}</b>,</p><p>Klik tombol berikut untuk membuat password baru (link berlaku 1 jam):</p>
       <p style="text-align:center;margin:20px 0">${btn('Reset Password', link)}</p>
       <p>Atau salin URL ini ke browser: <code>${link}</code></p>
       <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>`
    ),
  });
}

export function sendNewAnnouncement(to: string, name: string, courseTitle: string, title: string) {
  return sendEmail({
    to,
    subject: `Pengumuman baru: ${title}`,
    html: wrap(`<p>Halo <b>${name}</b>,</p><p>Pengumuman baru dari kursus <b>${courseTitle}</b>: <b>${title}</b>.</p>`),
  });
}
