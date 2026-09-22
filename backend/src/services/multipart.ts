import Busboy from 'busboy';
import { Readable } from 'stream';

/**
 * Parse multipart/form-data dari raw Request body (Hono) via busboy.
 * @returns stream file pertama + nama + mime, atau null jika tidak ada file
 */
export function parseMultipart(c: any, limitBytes: number): Promise<{ file: Readable; name: string; mimeType: string } | null> {
  return new Promise((resolve, reject) => {
    const raw: Request = c.req.raw;
    const bb = Busboy({
      headers: Object.fromEntries(raw.headers.entries()),
      limits: { fileSize: limitBytes },
    });

    let settled = false;
    bb.on('file', (name: string, fileStream: Readable, info: { filename: string; mimeType: string }) => {
      if (settled) { fileStream.resume(); return; }
      settled = true;
      resolve({ file: fileStream, name: info.filename, mimeType: info.mimeType });
    });
    bb.on('finish', () => {
      if (!settled) resolve(null);
    });
    bb.on('error', (err) => reject(err));

    const nodeBody = Readable.fromWeb(raw.body as any);
    nodeBody.pipe(bb);
  });
}
