# 10 — FASE 3: Student Experience & Admin (Minggu 5-6)

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Prasyarat:** Fase 2 sudah selesai  
> **Target:** Diskusi, notifikasi, sertifikat, admin panel lengkap

---

## Status

- [ ] **Minggu 5** — Diskusi + Pengumuman + Notifikasi + Student pages + Teacher management
- [ ] **Minggu 6** — Sertifikat + Admin panel + User management

---

## Minggu 5 — Backend

### 5.1 `routes/discussion.ts` (NEW)

```typescript
GET    /api/v1/discussions/courses/:courseId    → list threads
GET    /api/v1/discussions/lessons/:lessonId   → threads per lesson
POST   /api/v1/discussions/courses/:courseId   → buat thread baru
GET    /api/v1/discussions/:discussionId        → detail + replies
POST   /api/v1/discussions/:discussionId/replies → balas thread
PUT    /api/v1/discussions/:discussionId        → edit thread
DELETE /api/v1/discussions/:discussionId        → hapus thread
PATCH  /api/v1/discussions/:discussionId/pin    → toggle pin
```

Setelah reply ditambahkan:
- Update `discussions.reply_count += 1`
- Kirim notifikasi `discussion_reply` ke pembuat thread (jika bukan diri sendiri)

### 5.2 `routes/announcement.ts` (NEW)

```typescript
GET    /api/v1/announcements/courses/:courseId → list pengumuman
POST   /api/v1/announcements/courses/:courseId → buat (teacher/admin)
PUT    /api/v1/announcements/:id               → edit
DELETE /api/v1/announcements/:id               → hapus
```

Setelah buat pengumuman:
- Kirim notifikasi `announcement` ke semua student yang enrolled di kursus
- (Opsional) Kirim email `new_announcement` ke semua enrolled

### 5.3 `routes/notification.ts` (NEW)

```typescript
GET    /api/v1/notifications               → list (max 50)
GET    /api/v1/notifications/unread-count  → { count: N }
PATCH  /api/v1/notifications/:id/read      → mark 1 read
PATCH  /api/v1/notifications/read-all      → mark all read
DELETE /api/v1/notifications/:id           → hapus
```

### 5.4 `services/notification.ts` (NEW)

```typescript
export async function createNotification(params: {
  userId: string;
  type: 'enrollment' | 'new_content' | 'assignment_graded' | 'quiz_result' | 
        'announcement' | 'discussion_reply' | 'zoom_reminder';
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link,
    isRead: false,
  });
}

// Broadcast ke semua enrolled students di kursus
export async function broadcastToEnrolled(
  courseId: string,
  params: Omit<Parameters<typeof createNotification>[0], 'userId'>
): Promise<void> {
  const enrolled = await db.query.enrollments.findMany({
    where: and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'active')),
    columns: { userId: true },
  });
  
  await db.insert(notifications).values(
    enrolled.map(e => ({ userId: e.userId, ...params }))
  );
}
```

---

## Minggu 5 — Frontend

### Discussion Component (di Course Player Tabs)

Fitur:
- List thread diskusi per kursus atau per lesson
- Tambah thread baru (judul + body textarea)
- Thread items: avatar + nama + relative time + jumlah reply + badge 📌 (pinned)
- Klik thread → expand replies + form balas
- Teacher/Admin: tombol pin dan hapus thread
- Infinite scroll atau "Lihat lebih banyak" (pagination)

### Announcement Panel

- Tampil sebagai banner atau card di course player dan student dashboard
- Mark as read (opsional, atau cukup tampil saja)

### Notification Dropdown (TopNav)

```tsx
// Komponen NotificationBell di TopNav
// - Badge dengan angka unread count (merah)
// - Klik → dropdown list 10 notifikasi terbaru
// - Setiap item: ikon tipe + judul + relative time + status read/unread
// - Klik item → navigate ke link notifikasi + mark as read
// - "Tandai semua dibaca" button
// - "Lihat semua" link ke halaman notifikasi penuh
```

**Store update:**
```typescript
// notificationStore.ts
{
  unreadCount: number;
  notifications: Notification[];
  setUnreadCount: (n: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}
```

### `/student/my-courses` — My Courses Page

- Fetch dari `GET /api/v1/enrollments/my`
- Tabs: Semua | Sedang Belajar (progress < 100) | Selesai (progress = 100)
- Per kursus: Thumbnail + Judul + Instruktur + Progress bar + Tombol
  - Progress < 100: tombol "Lanjutkan" → link ke course player
  - Progress = 100: badge "Selesai ✅" + tombol "Lihat Sertifikat" (jika ada)

### `/student/grades` — Nilai Page

- Fetch dari `GET /api/v1/grades/my`
- Accordion per kursus
- Expand → tabel:
  - Nama Aktivitas
  - Tipe (Quiz / Tugas)
  - Skor / Max Skor
  - Persentase
  - Status (Lulus / Gagal / Menunggu Penilaian)
- Footer tabel: Final Grade (angka + huruf)

### `/teacher/courses/:id/students` — Student Management

- Fetch dari `GET /api/v1/courses/:id/students`
- Search bar
- Tabel: Avatar | Nama | Email | Enrolled | Progress % | Status
- Klik row → Modal detail:
  - Progress per section (progress bar)
  - Nilai quiz (rata-rata)
  - Nilai tugas (rata-rata)
- Tombol Suspend / Aktifkan per student
- Export CSV

### `/teacher/courses/:id/gradebook` — Gradebook

- Fetch dari `GET /api/v1/grades/courses/:id`
- Tabel spreadsheet: baris = student, kolom = setiap quiz + tugas
- Header kolom: nama aktivitas (tooltip dengan tipe)
- Kolom terakhir: Final Grade + letter grade
- Klik cell assignment belum dinilai → inline modal: input skor + feedback
- Sort by nama atau final grade
- Filter: semua / lulus / gagal
- Export CSV: `GET /api/v1/grades/courses/:id/export`

---

## Minggu 6 — Backend

### 6.1 `services/certificate.ts` (NEW)

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';

export async function generateCertificate(params: {
  userId: string;
  courseId: string;
  studentName: string;
  courseName: string;
  instructorName: string;
}): Promise<{ code: string; pdfUrl: string }> {
  // 1. Generate kode unik
  const code = nanoid(12).toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1);
  // Format: XXXX-XXXX-XXXX
  
  // 2. Generate QR Code sebagai data URL
  const verifyUrl = `${process.env.APP_URL}/verify/${code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120 });
  
  // 3. Buat PDF dengan pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 landscape
  
  // (Tambah font, teks, QR code ke halaman)
  // ... implementasi desain sertifikat
  
  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  
  // 4. Upload ke MinIO
  const key = `certificates/${crypto.randomUUID()}.pdf`;
  const pdfUrl = await uploadFile(process.env.MINIO_BUCKET!, key, buffer, 'application/pdf');
  
  // 5. Simpan ke tabel certificates
  await db.insert(certificates).values({
    userId: params.userId,
    courseId: params.courseId,
    code,
    pdfUrl,
  });
  
  return { code, pdfUrl };
}
```

### 6.2 `routes/certificate.ts` (NEW)

```typescript
GET    /api/v1/certificates/my                          → list milik user
GET    /api/v1/certificates/:code                       → publik verify (no auth)
POST   /api/v1/certificates/courses/:courseId/generate  → manual generate
```

### 6.3 `routes/user.ts` (NEW) — Admin Only

```typescript
GET    /api/v1/users                 → list users (search, filter, paginate)
GET    /api/v1/users/:id             → detail user
POST   /api/v1/users                 → buat user baru
PUT    /api/v1/users/:id             → edit user
PATCH  /api/v1/users/:id/activate    → aktifkan
PATCH  /api/v1/users/:id/deactivate  → nonaktifkan
GET    /api/v1/users/:id/enrollments → kursus yang diikuti user
```

### 6.4 `routes/grade.ts` (NEW)

```typescript
GET    /api/v1/grades/my                        → nilai semua kursus (student)
GET    /api/v1/grades/my/courses/:courseId       → detail nilai 1 kursus
GET    /api/v1/grades/courses/:courseId          → gradebook (teacher/admin)
GET    /api/v1/grades/courses/:courseId/export   → CSV export
```

---

## Minggu 6 — Frontend

### `/student/certificates` — Certificates Page

- Grid kartu sertifikat
- Per sertifikat: logo kursus + nama kursus + instruktur + tanggal terbit
- Tombol: "Download PDF" + "Salin Link Verifikasi"
- State kosong: "Selesaikan kursus untuk mendapatkan sertifikat"

### `/verify/:code` — Public Certificate Verification

```tsx
// pages/VerifyCertificate.tsx
// Tampil tanpa login

function VerifyCertificate() {
  const { code } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['verify-cert', code],
    queryFn: () => api.get(`/certificates/${code}`),
  });

  if (isLoading) return <CertificateSkeleton />;
  if (isError || !data?.isValid) return <InvalidCertificate />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center space-y-4">
        <div className="text-5xl">🏆</div>
        <h1 className="text-2xl font-bold">Sertifikat Valid</h1>
        <div className="text-left space-y-2 bg-gray-50 rounded-xl p-4">
          <p><span className="text-gray-500">Pemegang:</span> <strong>{data.holderName}</strong></p>
          <p><span className="text-gray-500">Kursus:</span> <strong>{data.courseName}</strong></p>
          <p><span className="text-gray-500">Instruktur:</span> <strong>{data.instructorName}</strong></p>
          <p><span className="text-gray-500">Diterbitkan:</span> <strong>{formatDate(data.issuedAt)}</strong></p>
        </div>
        <div className="flex gap-3">
          <a href={data.pdfUrl} className="flex-1 btn-primary">Download PDF</a>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link tersalin!'); }} className="flex-1 btn-secondary">
            Salin Link
          </button>
        </div>
      </div>
    </div>
  );
}
```

### `/admin/users` — User Management

- Search + filter role + filter status (aktif/nonaktif)
- Tabel dengan pagination
- Bulk select + bulk action (aktifkan/nonaktifkan)
- Modal "+ Tambah User": form nama, email, password, role
- Inline edit: klik edit per row → modal edit

### `/admin/courses` — Course Approval

- Tabs: Semua | Pending Review | Published | Draft | Archived
- Filter by instruktur
- Klik "Publish" untuk kursus pending → confirm dialog → API call
- Klik "Arsipkan" atau "Hapus" dengan confirm dialog

### `/admin/categories` — Category Management

- List kategori dengan sortOrder
- Drag-drop untuk reorder (dnd-kit)
- Tambah kategori (modal form: nama, slug, deskripsi, icon URL)
- Edit inline atau via modal

---

## Checklist Fase 3

### Backend
- [ ] Discussion: buat thread + balas + pin + hapus berfungsi
- [ ] Announcement: buat + notifikasi ke enrolled students
- [ ] Notification: create + list + mark read + unread count
- [ ] Certificate: generate PDF + simpan ke MinIO + simpan ke DB
- [ ] `GET /certificates/:code` publik berfungsi + return data valid
- [ ] Grade: my grades + gradebook + export CSV
- [ ] User management (admin): CRUD + activate/deactivate
- [ ] Auto-generate sertifikat saat progress 100% (di services/progress.ts)

### Frontend
- [ ] Discussion thread tampil di course player tab
- [ ] Bisa buat thread + balas di course player
- [ ] Notification badge di TopNav + dropdown list
- [ ] Mark notifikasi sebagai dibaca saat diklik
- [ ] `/student/my-courses` tabs berfungsi dengan progress
- [ ] `/student/grades` accordion nilai berfungsi
- [ ] `/student/certificates` tampil sertifikat
- [ ] `/verify/:code` tampil informasi sertifikat tanpa login
- [ ] `/admin/users` CRUD user berfungsi
- [ ] `/admin/courses` approval berfungsi
- [ ] `/admin/categories` CRUD berfungsi
- [ ] `/teacher/.../students` dengan progress detail
- [ ] `/teacher/.../gradebook` dengan inline grading

### Integration
- [ ] Student selesaikan kursus (100%) → sertifikat auto-generate → email terkirim
- [ ] Teacher buat pengumuman → notifikasi muncul di dashboard student
- [ ] Admin approve kursus pending → muncul di katalog
- [ ] Verifikasi sertifikat via URL publik berhasil
