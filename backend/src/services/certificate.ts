import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import QRCode from 'qrcode';
import { db } from '../db';
import { certificates, courses, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { enqueueCertificateSync } from './sidiqClient';

const CERT_DIR = path.resolve(process.cwd(), 'uploads/certificates');

function ensureCertDir() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
}

function generateCode(): string {
  // Kode verifikasi: 12 char alfanumerik uppercase, format XXXX-XXXX-XXXX
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.slice(0, 12).match(/.{1,4}/g)!.join('-');
}

/**
 * Generate PDF sertifikat (A4 landscape).
 * @returns buffer PDF
 */
async function renderCertificatePdf(opts: {
  userName: string;
  courseTitle: string;
  instructorName: string;
  issuedDate: Date;
  code: string;
  verifyUrl: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { width, height } = page.getSize();

  // Warna tema
  const primary = rgb(0.13, 0.23, 0.5);   // biru gelap
  const accent = rgb(0.85, 0.65, 0.13);   // emas
  const gray = rgb(0.45, 0.45, 0.45);

  // Border ganda
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor: primary, borderWidth: 3 });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 56, borderColor: accent, borderWidth: 1 });

  // Header
  page.drawText('E-LEARNING', { x: width / 2 - fontBold.widthOfTextAtSize('E-LEARNING', 14) / 2, y: height - 70, size: 14, font: fontBold, color: primary });
  page.drawRectangle({ x: width / 2 - 40, y: height - 80, width: 80, height: 2, color: accent });

  // Judul
  const title = 'SERTIFIKAT PENGAJIAN';
  page.drawText(title, { x: width / 2 - fontBold.widthOfTextAtSize(title, 36) / 2, y: height - 150, size: 36, font: fontBold, color: primary });

  // Subjudul
  const subtitle = 'Kelulusan Program Pembelajaran';
  page.drawText(subtitle, { x: width / 2 - fontItalic.widthOfTextAtSize(subtitle, 14) / 2, y: height - 175, size: 14, font: fontItalic, color: gray });

  // "Diberikan kepada"
  page.drawText('Diberikan kepada', { x: width / 2 - fontRegular.widthOfTextAtSize('Diberikan kepada', 16) / 2, y: height - 230, size: 16, font: fontRegular, color: gray });

  // Nama (besar)
  const nameFont = opts.userName.length > 25 ? 28 : 34;
  page.drawText(opts.userName, { x: width / 2 - fontBold.widthOfTextAtSize(opts.userName, nameFont) / 2, y: height - 275, size: nameFont, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  // Garis bawah nama
  const nameWidth = Math.min(fontBold.widthOfTextAtSize(opts.userName, nameFont), width - 300);
  page.drawRectangle({ x: width / 2 - nameWidth / 2, y: height - 285, width: nameWidth, height: 1, color: accent });

  // "telah menyelesaikan kursus"
  const line1 = 'telah menyelesaikan seluruh materi dan evaluasi dari kursus';
  page.drawText(line1, { x: width / 2 - fontRegular.widthOfTextAtSize(line1, 14) / 2, y: height - 320, size: 14, font: fontRegular, color: gray });

  // Judul kursus (besar)
  const courseFont = opts.courseTitle.length > 40 ? 20 : 26;
  page.drawText(opts.courseTitle, { x: width / 2 - fontBold.widthOfTextAtSize(opts.courseTitle, courseFont) / 2, y: height - 355, size: courseFont, font: fontBold, color: primary });

  // Instruktur + tanggal
  const instrLine = `Instruktur: ${opts.instructorName}`;
  page.drawText(instrLine, { x: width / 2 - fontRegular.widthOfTextAtSize(instrLine, 13) / 2, y: height - 400, size: 13, font: fontRegular, color: gray });

  const dateStr = opts.issuedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText(`Diterbitkan pada: ${dateStr}`, { x: width / 2 - fontRegular.widthOfTextAtSize(`Diterbitkan pada: ${dateStr}`, 13) / 2, y: height - 425, size: 13, font: fontRegular, color: gray });

  // Kode verifikasi
  const codeLine = `Kode Verifikasi: ${opts.code}`;
  page.drawText(codeLine, { x: width / 2 - fontBold.widthOfTextAtSize(codeLine, 12) / 2, y: height - 470, size: 12, font: fontBold, color: primary });

  // QR code (kanan bawah)
  try {
    const qrPng = await QRCode.toBuffer(opts.verifyUrl, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
    const qrImage = await pdfDoc.embedPng(qrPng);
    const qrSize = 90;
    page.drawImage(qrImage, { x: width - 130, y: height - 160 - qrSize, width: qrSize, height: qrSize });
    page.drawText('Scan untuk memverifikasi', { x: width - 130 + (90 - fontItalic.widthOfTextAtSize('Scan untuk memverifikasi', 8)) / 2, y: height - 170, size: 8, font: fontItalic, color: gray });
    page.drawText(opts.verifyUrl, { x: width - 130 + (90 - fontRegular.widthOfTextAtSize(opts.verifyUrl, 6)) / 2, y: height - 158, size: 6, font: fontRegular, color: gray });
  } catch {
    // QR gagal → sertifikat tetap valid tanpa QR
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

/**
 * Generate sertifikat untuk user pada kursus.
 * Idempoten: jika sudah ada sertifikat, kembalikan yang ada.
 */
export async function generateCertificate(userId: string, courseId: string) {
  // Cek existing (unique userId+courseId)
  const [existing] = await db.select().from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
    .limit(1);
  if (existing) return existing;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!user || !course) throw new Error('User atau kursus tidak ditemukan');

  const [instructor] = await db.select().from(users).where(eq(users.id, course.instructorId)).limit(1);

  // Generate code unik (hindari collision)
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const [dup] = await db.select({ id: certificates.id }).from(certificates).where(eq(certificates.code, code)).limit(1);
    if (!dup) break;
    code = generateCode();
  }

  // Render PDF
  const verifyUrl = `${process.env.PUBLIC_URL || 'http://localhost:5173'}/verify/${code}`;
  const pdfBuffer = await renderCertificatePdf({
    userName: user.name,
    courseTitle: course.title,
    instructorName: instructor?.name || '—',
    issuedDate: new Date(),
    code,
    verifyUrl,
  });

  // Simpan ke disk
  ensureCertDir();
  const fileName = `${code.replace(/-/g, '')}.pdf`;
  fs.writeFileSync(path.join(CERT_DIR, fileName), pdfBuffer);
  const pdfUrl = `/uploads/certificates/${fileName}`;

  const [row] = await db.insert(certificates).values({
    userId,
    courseId,
    code,
    pdfUrl,
    issuedAt: new Date(),
  }).returning();

  if (user.sidiqEntityId) {
    void enqueueCertificateSync({
      santriId: user.sidiqEntityId,
      courseId,
      courseTitle: course.title,
      certificateCode: code,
      pdfUrl: `${process.env.PUBLIC_URL || 'http://localhost:5174'}${pdfUrl}`,
      issuedAt: new Date().toISOString(),
    }).catch((e) => console.error('[sidiqSync] cert sync error:', e));
  }

  return row;
}

/**
 * Verifikasi sertifikat publik by kode.
 * @returns data sertifikat (tanpa PII sensitif) atau null jika tidak valid
 */
export async function verifyCertificate(code: string) {
  const [cert] = await db.select().from(certificates).where(eq(certificates.code, code)).limit(1);
  if (!cert) return null;

  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, cert.userId)).limit(1);
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, cert.courseId)).limit(1);

  return {
    valid: true,
    code: cert.code,
    userName: user?.name || '—',
    courseTitle: course?.title || '—',
    issuedAt: cert.issuedAt,
    pdfUrl: cert.pdfUrl,
  };
}
