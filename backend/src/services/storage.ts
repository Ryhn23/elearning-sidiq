import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Local disk storage (dev environment).
 * Abstraksi agar mudah diganti MinIO/S3 untuk produksi.
 */
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const SUBDIRS = ['videos', 'documents', 'images', 'assignments'];

export function ensureUploadDirs() {
  for (const sub of Object.values(KIND_DIR)) {
    fs.mkdirSync(path.join(UPLOAD_DIR, sub), { recursive: true });
  }
}

export type UploadKind = 'video' | 'document' | 'image' | 'assignment';

const KIND_DIR: Record<UploadKind, string> = {
  video: 'videos',
  document: 'documents',
  image: 'images',
  assignment: 'assignments',
};

const EXT_MAP: Record<UploadKind, string[]> = {
  video: ['mp4', 'webm', 'mov', 'mkv'],
  document: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  assignment: ['pdf', 'doc', 'docx', 'zip', 'rar', 'txt', 'md', 'jpg', 'jpeg', 'png'],
};

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]/g, '_').slice(-100);
}

/**
 * Stream file dari busboy ke disk.
 * @returns { url, fileName, sizeBytes } atau null jika limit terlampaui
 */
export async function streamToFile(
  fileStream: import('stream').Readable,
  kind: UploadKind,
  originalName: string,
  mimeType: string,
  maxBytes: number
): Promise<{ url: string; fileName: string; sizeBytes: number } | { error: string }> {
  const ext = (path.extname(originalName).replace('.', '') || 'bin').toLowerCase();
  if (!EXT_MAP[kind].includes(ext)) {
    return { error: `Tipe file .${ext} tidak diizinkan` };
  }

  const safeName = `${crypto.randomUUID()}-${sanitizeFileName(originalName)}`;
  const dir = path.join(UPLOAD_DIR, KIND_DIR[kind]);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, safeName);

  return await new Promise((resolve) => {
    let received = 0;
    let rejected = false;
    const ws = fs.createWriteStream(filePath);

    fileStream.on('limit', () => {
      // fileSize limit terlampaui (busboy 'limit' event)
      rejected = true;
      ws.close();
      try { fs.unlinkSync(filePath); } catch {}
      resolve({ error: 'Ukuran file melebihi batas' });
    });

    fileStream.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        rejected = true;
        fileStream.destroy();
        ws.close();
        try { fs.unlinkSync(filePath); } catch {}
        resolve({ error: 'Ukuran file melebihi batas' });
      }
    });

    fileStream.on('error', (err) => {
      ws.close();
      try { fs.unlinkSync(filePath); } catch {}
      if (!rejected) resolve({ error: err.message || 'Gagal menyimpan file' });
    });

    ws.on('error', (err) => {
      try { fs.unlinkSync(filePath); } catch {}
      if (!rejected) resolve({ error: err.message || 'Gagal menyimpan file' });
    });

    fileStream.pipe(ws);
    ws.on('finish', () => {
      if (rejected) return;
      const url = `/uploads/${KIND_DIR[kind]}/${safeName}`;
      resolve({ url, fileName: originalName, sizeBytes: received });
    });
  });
}

export function fileExists(relPath: string): boolean {
  const filePath = path.normalize(path.join(UPLOAD_DIR, relPath));
  if (!filePath.startsWith(UPLOAD_DIR)) return false;
  return fs.existsSync(filePath);
}
