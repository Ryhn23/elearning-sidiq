# 09 — FASE 2: Media & Assessment (Minggu 3-4)

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Prasyarat:** Fase 1 sudah selesai  
> **Target:** Upload video, quiz, assignment, dan email berfungsi

---

## Status

- [ ] **Minggu 3** — Backend: MinIO + Upload + Assignment + Quiz + Email
- [ ] **Minggu 3** — Frontend: VideoPlayer + DocumentViewer + ZoomWidget + AssignmentWidget
- [ ] **Minggu 4** — Frontend: QuizWidget + Course Editor (Teacher)

---

## Minggu 3 — Backend

### 3.1 Docker Compose: Tambah MinIO + Redis

Update `docker-compose.yml` dengan service `redis` dan `minio` (lihat [05-infrastructure.md](./05-infrastructure.md)).

Jalankan ulang:
```bash
docker-compose down
docker-compose up -d
```

### 3.2 `services/storage.ts` (NEW)

```typescript
import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await minioClient.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': mimeType,
  });
  return `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${bucket}/${key}`;
}

export async function getSignedUrl(
  bucket: string,
  key: string,
  expirySeconds: number = 7200
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expirySeconds);
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
  await minioClient.removeObject(bucket, key);
}
```

### 3.3 `routes/upload.ts` (NEW)

Gunakan `hono/body` untuk handle multipart form data:

```typescript
POST /api/v1/upload/video       → max 2GB, mimeType: video/*
POST /api/v1/upload/document    → max 50MB, mimeType: application/pdf, dll
POST /api/v1/upload/image       → max 5MB, mimeType: image/*
POST /api/v1/upload/assignment  → max 50MB, all types
GET  /api/v1/upload/signed-url  → ?fileKey=videos/uuid.mp4 → presigned URL 2 jam
```

**Validasi file (wajib di semua upload):**
```typescript
import { fileTypeFromBuffer } from 'file-type';

const { file } = await c.req.parseBody();
const buffer = Buffer.from(await (file as File).arrayBuffer());
const detected = await fileTypeFromBuffer(buffer);

if (!allowedMimeTypes.includes(detected?.mime || '')) {
  return c.json({ error: 'Tipe file tidak diizinkan' }, 400);
}

// Rename ke UUID
const ext = detected?.ext || 'bin';
const key = `videos/${crypto.randomUUID()}.${ext}`;
const url = await uploadFile(BUCKET, key, buffer, detected?.mime || 'application/octet-stream');

return c.json({ url, fileKey: key, fileName: (file as File).name, sizeBytes: buffer.length });
```

### 3.4 `routes/assignment.ts` (NEW)

```typescript
POST   /api/v1/assignments/lessons/:lessonId         → create assignment
PUT    /api/v1/assignments/:assignmentId              → update
GET    /api/v1/assignments/:assignmentId/submissions  → all submissions (teacher/admin)
POST   /api/v1/assignments/:assignmentId/submit       → student submit (fileUrl dari upload)
GET    /api/v1/assignments/:assignmentId/my-submission → student view own
PATCH  /api/v1/assignments/submissions/:id/grade     → teacher grade { score, feedback }
```

Setelah teacher grade → panggil `services/notification.ts` untuk kirim notif + email ke student.

### 3.5 `routes/quiz.ts` (NEW)

Endpoint lengkap (lihat [03-backend-api.md](./03-backend-api.md#quizzes)).

**Logic submit quiz:**
```typescript
// POST /api/v1/quizzes/attempts/:attemptId/submit
// 1. Fetch semua soal dari attempt.quizId
// 2. Per jawaban:
//    - multiple_choice/true_false: bandingkan selectedOptionId dengan isCorrect option
//    - multiple_answer: bandingkan set selectedOptionIds dengan isCorrect options
//    - short_answer: lowercase compare dengan jawaban benar
//    - essay: isCorrect = null (manual grading)
// 3. Hitung total score
// 4. Update quiz_attempts: score, maxScore, percentage, isPassed, submittedAt, timeTakenSec
// 5. Simpan quiz_answers
// 6. Update lesson_progress (mark complete jika isPassed = true)
// 7. Recalculate enrollments.progress
// 8. Return hasil (jika showResultImmediately = true)
```

### 3.6 `services/email.ts` (NEW)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string }[];
}): Promise<void> {
  await transporter.sendMail({
    from: `"E-Learning Platform" <${process.env.FROM_EMAIL}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments,
  });
}

// Template functions:
export function enrollmentConfirmedEmail(courseName: string, courseUrl: string): string { ... }
export function assignmentGradedEmail(courseName: string, score: number, feedback: string): string { ... }
export function welcomeEmail(userName: string): string { ... }
```

---

## Minggu 3 — Frontend: Course Player Enhancements

### VideoPlayer Component

```tsx
// components/course/VideoPlayer.tsx
// Pakai react-player untuk handle URL MinIO

import ReactPlayer from 'react-player';
import { useRef, useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';

interface VideoPlayerProps {
  videoUrl: string;          // URL MinIO (atau presigned URL)
  lessonId: string;
  initialPosition?: number;  // detik (untuk resume)
  onComplete?: () => void;   // dipanggil saat 80% selesai
}

export function VideoPlayer({ videoUrl, lessonId, initialPosition = 0, onComplete }: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [played, setPlayed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const savePositionMutation = useMutation({ /* PATCH video-position */ });

  // Resume ke posisi terakhir saat ready
  const handleReady = () => {
    if (initialPosition > 0) {
      playerRef.current?.seekTo(initialPosition, 'seconds');
    }
  };

  // Auto-save posisi setiap 10 detik
  const handleProgress = (state: { playedSeconds: number; played: number }) => {
    if (state.playedSeconds % 10 < 1) {
      savePositionMutation.mutate({ positionSec: Math.floor(state.playedSeconds) });
    }
    // Auto-complete setelah 80%
    if (state.played >= 0.8 && !completed) {
      setCompleted(true);
      onComplete?.();
    }
  };

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      <ReactPlayer
        ref={playerRef}
        url={videoUrl}
        width="100%"
        height="100%"
        controls
        onReady={handleReady}
        onProgress={handleProgress}
        config={{
          file: {
            attributes: { controlsList: 'nodownload' }  // disable download button
          }
        }}
      />
    </div>
  );
}
```

### ZoomWidget Component

```tsx
// components/course/ZoomWidget.tsx

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface ZoomWidgetProps {
  zoomUrl: string;
  zoomStartAt: string;
  zoomDurationMin: number;
  zoomMeetingId?: string;
}

export function ZoomWidget({ zoomUrl, zoomStartAt, zoomDurationMin, zoomMeetingId }: ZoomWidgetProps) {
  const [countdown, setCountdown] = useState('');
  const startTime = dayjs(zoomStartAt);
  const endTime = startTime.add(zoomDurationMin, 'minute');
  const now = dayjs();
  const isLive = now.isAfter(startTime) && now.isBefore(endTime);
  const isPast = now.isAfter(endTime);

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = startTime.diff(dayjs(), 'second');
      if (diff <= 0) { setCountdown(''); clearInterval(interval); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(`${h}j ${m}m ${s}d`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-4xl">📹</div>
        <div>
          <h3 className="font-semibold text-lg">Kelas Live via Zoom</h3>
          {zoomMeetingId && <p className="text-sm text-gray-500">Meeting ID: {zoomMeetingId}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Waktu Mulai:</span><br/><strong>{startTime.format('D MMM YYYY, HH:mm')} WIB</strong></div>
        <div><span className="text-gray-500">Durasi:</span><br/><strong>{zoomDurationMin} menit</strong></div>
      </div>
      {!isPast && countdown && (
        <div className="bg-blue-100 rounded-lg p-3 text-center">
          <p className="text-sm text-blue-600">Dimulai dalam</p>
          <p className="text-2xl font-bold text-blue-700">{countdown}</p>
        </div>
      )}
      {isLive && <div className="bg-red-100 text-red-700 rounded-lg p-3 text-center font-semibold">🔴 Sedang Berlangsung</div>}
      {isPast && <div className="bg-gray-100 text-gray-500 rounded-lg p-3 text-center">Kelas telah selesai</div>}
      {!isPast && (
        <a href={zoomUrl} target="_blank" rel="noopener noreferrer" className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-medium hover:bg-blue-700 transition">
          Buka Zoom Meeting →
        </a>
      )}
    </div>
  );
}
```

### AssignmentWidget Component

Struktur fitur:
- Tampilkan instruksi tugas (HTML rendered)
- Due date + badge status (Aktif / ⚠️ Terlambat / Selesai)
- Jika belum submit: drag-drop uploader + tombol upload + notes textarea
- Jika sudah submit: tampil file yang disubmit + status (Menunggu Penilaian / Dinilai)
- Jika sudah dinilai: tampil skor + feedback teacher

---

## Minggu 4 — Frontend: Quiz & Course Editor

### QuizWidget Component

State machine quiz player:
```
'idle'      → Tampil info quiz + tombol "Mulai Quiz"
'starting'  → Loading (POST /quizzes/:id/start)
'active'    → Soal aktif + timer countdown + navigasi prev/next
'submitting' → Loading (POST /attempts/:id/submit)
'result'    → Tampil skor + breakdown jawaban
'history'   → Tampil riwayat attempt sebelumnya
```

### Course Editor (Teacher)

Halaman multi-step wizard (`/teacher/courses/new` dan `/teacher/courses/:id/edit`).

**Struktur komponen:**
```
CourseEditor
├── Step 1: BasicInfoForm (judul, deskripsi, kategori, level, harga, thumbnail)
├── Step 2: CurriculumBuilder
│   ├── SortableList (sections)
│   └── per section: SortableList (lessons)
│       └── per lesson: LessonEditor (by type)
│           ├── VideoLessonEditor → VideoUploader (progress bar)
│           ├── DocumentLessonEditor → FileUploader
│           ├── TextLessonEditor → RichTextEditor (TipTap)
│           ├── ZoomLessonEditor → DateTimePicker + URL input
│           ├── AssignmentLessonEditor → textarea + settings
│           └── QuizLessonEditor → QuizBuilder
├── Step 3: SettingsForm (outcomes, requirements, tags, certificate)
└── Step 4: PublishForm (preview ringkasan + pilihan aksi)
```

---

## Checklist Fase 2

### Backend
- [ ] Docker Compose berjalan dengan MinIO + Redis
- [ ] Bucket `elearning` sudah dibuat di MinIO
- [ ] `POST /api/v1/upload/video` bisa terima file besar (test dengan file 100MB+)
- [ ] `POST /api/v1/upload/document` berfungsi
- [ ] `POST /api/v1/upload/image` berfungsi
- [ ] `GET /api/v1/upload/signed-url` return presigned URL yang valid
- [ ] Assignment: buat + submit + grade berfungsi
- [ ] Quiz: buat soal + start attempt + submit jawaban + lihat hasil berfungsi
- [ ] Email terkirim saat: enrollment, assignment graded

### Frontend
- [ ] Video player bisa putar video dari URL MinIO
- [ ] Video resume dari posisi terakhir
- [ ] Auto-mark complete setelah 80% video ditonton
- [ ] Zoom widget tampil dengan countdown yang akurat
- [ ] Assignment widget: upload file + lihat status + lihat nilai
- [ ] Quiz widget: soal tampil + timer berjalan + submit + lihat hasil
- [ ] Course Editor Step 1-4 berfungsi penuh
- [ ] VideoUploader dengan progress bar upload
- [ ] QuizBuilder bisa tambah/edit/hapus soal

### Integration
- [ ] Teacher upload video → muncul di course player dengan player berfungsi
- [ ] Student kerjakan quiz → lihat skor + mark lesson selesai otomatis
- [ ] Student submit tugas → Teacher grade → Student terima email
