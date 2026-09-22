# 04 — Frontend: Pages, Components & State

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Stack:** React 19 + TailwindCSS v4 + Zustand + TanStack Query + React Router v6

---

## Routing Map (App.tsx)

```
/                           → Landing page (tamu) atau redirect /dashboard (login)
/login                      → Halaman login
/register                   → Halaman registrasi
/forgot-password            → Request reset password
/reset-password?token=...   → Form password baru
/auth/google/callback       → Handler redirect callback OAuth Google

/courses                    → Katalog kursus (publik)
/courses/:slug              → Detail kursus (publik)
/courses/:slug/learn        → Course player (enrolled only)
/courses/:slug/learn/:lessonId  → Course player, lesson tertentu

/dashboard                  → Redirect berdasarkan role

/student/                   → Dashboard student
/student/my-courses         → Kursus yang diikuti
/student/grades             → Nilai & rekap
/student/certificates       → Sertifikat yang didapat
/student/profile            → Profil + settings

/teacher/                   → Dashboard teacher
/teacher/courses            → Kursus yang dimiliki
/teacher/courses/new        → Buat kursus baru (Course Editor)
/teacher/courses/:id/edit   → Edit kursus (Course Editor)
/teacher/courses/:id/students → Manajemen student + progress
/teacher/courses/:id/gradebook → Gradebook kursus

/admin/                     → Dashboard admin
/admin/users                → Manajemen user
/admin/courses              → Semua kursus + approval
/admin/categories           → Manajemen kategori
/admin/analytics            → Analytics global

/verify/:code               → Verifikasi sertifikat (publik, tanpa login)
```

---

## Spesifikasi Halaman

### `/login` — Login Page

- Logo + nama platform
- Tombol **"Login dengan Google"** — jika google_id tidak ada, tampil pesan _"Akun Google belum dihubungkan, login manual dulu"_
- Divider "atau"
- Form: Email + Password
- Link "Lupa password?"
- Link "Belum punya akun? Daftar"
- Error state dengan pesan spesifik (email/password salah, akun nonaktif)
- Jika token valid → redirect `/dashboard`

---

### `/register` — Register Page

- Form: Nama Lengkap, Email, Password (min 8 karakter), Konfirmasi Password
- Pilihan Role: **Student** / **Teacher** (segmented control atau radio)
- Checkbox persetujuan syarat & ketentuan
- Submit → `POST /auth/register`
- Sukses → redirect `/login` + toast "Registrasi berhasil, silakan login"

---

### `/courses` — Course Catalog

**Layout:** Sidebar filter (kiri 280px) + Grid kursus (kanan)

- **Search bar** dengan debounce 300ms → update query param `?search=`
- **Sidebar filter:**
  - Kategori (checkbox list)
  - Level (beginner / intermediate / advanced / semua)
  - Bahasa (Indonesia / English)
  - Harga (Gratis / Berbayar)
- **Sort:** Terbaru | Rating Tertinggi | Terpopuler (Select dropdown kanan atas)
- **Toggle tampilan:** Grid 3-kolom / List (icon toggle)
- 12 card per halaman + pagination
- **Skeleton loader** saat fetch

**CourseCard berisi:**
- Thumbnail (aspect ratio 16:9) + badge level (pojok kiri atas)
- Judul (max 2 baris, text-ellipsis)
- Nama instruktur + avatar kecil
- Rating bintang + jumlah review (e.g., ⭐ 4.8 (120))
- Total student (👥 1.2k terdaftar)
- Estimasi durasi total
- Badge harga / "Gratis"
- Tombol "Lihat Kursus"

---

### `/courses/:slug` — Course Detail Page

**Layout:** Konten (70%) + Panel sticky kanan (30%)

**Konten kiri:**
- Breadcrumb: Kategori → Judul Kursus
- `<h1>` Judul kursus
- Rating aggregate + jumlah ulasan + jumlah student
- Badge: Level | Bahasa | Total Durasi | Jumlah Lesson
- Nama instruktur + avatar + bio singkat (collapsible)
- **"Yang Akan Kamu Pelajari"** — grid 2 kolom dari `learningOutcomes`
- **"Persyaratan"** — list dari `requirements`
- **Kurikulum** — Accordion per section:
  - Header: Nama section + `(X lesson · Y jam)`
  - Lesson item: ikon tipe + nama + durasi + badge 🔓 _preview gratis_
  - Klik free preview lesson → bisa dibuka tanpa enroll
- **Ulasan** — rata-rata rating, distribusi bintang 1-5, list ReviewCard
- **Diskusi** — preview 3 thread terbaru + tombol "Lihat Semua Diskusi"

**Panel kanan (sticky top-20):**
- Thumbnail atau preview video player
- Harga / badge "GRATIS"
- Tombol **"Enroll Sekarang"** atau **"Lanjutkan Belajar"** (jika enrolled)
- Jika enrolled: progress bar %
- Info: Total siswa terdaftar | Rating | Update terakhir

---

### `/courses/:slug/learn` — Course Player

**Layout:** Main content (75%) + Sidebar navigator (25%, right)

**Area Utama — per tipe lesson:**

#### type: `video`
- Custom HTML5 player (`react-player` + custom controls):
  - Resume dari posisi terakhir (simpan ke backend tiap 10 detik)
  - Kecepatan: 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x
  - Fullscreen, volume, progress bar
  - **Auto-mark complete** setelah ditonton ≥ 80% durasi

#### type: `document`
- PDF embed/iframe (atau link ke PDF viewer)
- Tombol "Download PDF"
- Tombol "Tandai Selesai" (manual)

#### type: `text`
- Render HTML dari TipTap (sanitized)
- Tombol "Tandai Selesai" (manual)

#### type: `zoom_link`
- Info meeting: tanggal, jam mulai, durasi
- Countdown timer jika H < 24 jam
- Tombol "Buka Zoom" (buka URL di tab baru)
- Tombol "Tandai Hadir/Selesai" (manual)

#### type: `assignment`
- Instruksi tugas (HTML rendered)
- Due date + status (aktif / ⚠️ terlambat)
- Drag-drop upload file (atau browse)
- Status submission (Belum Submit / Sudah Submit)
- Tampilkan nilai + feedback teacher jika sudah dikoreksi
- Jika sudah dikoreksi: badge skor + teks feedback

#### type: `quiz`
- Info pra-quiz: jumlah soal, batas waktu, max attempt, passing score
- Tombol "Mulai Quiz" (disable jika attempt habis)
- **Saat quiz aktif:**
  - Soal satu per satu (navigasi prev/next)
  - Countdown timer di atas
  - Nomor soal (1 / 10)
  - Pilihan jawaban (radio/checkbox)
- **Setelah submit:**
  - Skor total + persentase
  - Badge LULUS 🎉 / GAGAL ❌
  - Breakdown jawaban (jika `showResultImmediately = true`)
- **Riwayat attempt:** tabel attempt sebelumnya (tanggal, skor, status)

**Tabs di bawah konten:**
1. **Overview** — deskripsi lesson
2. **Diskusi** — thread diskusi khusus lesson ini
3. **Catatan** — catatan pribadi (simpan ke localStorage / backend)

**Sidebar Navigator (kanan):**
- Nama kursus + progress bar keseluruhan
- Accordion per section:
  - Nama section + `(X/N selesai)`
  - Lesson items: ikon tipe + nama + status (✅ selesai | 🔒 locked | ▶️ sedang)
- Tombol **← Lesson Sebelumnya** + **Lesson Berikutnya →**
- Aktif lesson: di-highlight

---

### `/student/` — Student Dashboard

- Header: _"Selamat datang kembali, [Nama]! 👋"_
- Stats cards: Kursus Diikuti | Selesai | Sertifikat | Rata-rata Nilai
- **"Lanjutkan Belajar"** — 3 kursus in-progress terbaru + progress bar
- **"Pengumuman Terbaru"** — dari kursus yang diikuti
- **"Aktivitas Terbaru"** — log: lesson diselesaikan, quiz dikerjakan, dll

---

### `/student/my-courses` — My Courses

- Tabs: Semua | Sedang Belajar | Selesai
- Per kursus: Thumbnail + Judul + Instruktur + Progress bar % + Tombol
  - In-progress → "Lanjutkan"
  - Selesai → "Ulang" + badge "Selesai" + link sertifikat

---

### `/student/grades` — Nilai

- Accordion per kursus yang diikuti
- Expand → tabel: Nama Aktivitas | Tipe (Quiz/Tugas) | Skor | Status Lulus
- Footer tabel: **Final Grade** + letter grade (A/B/C/D/E)

---

### `/student/profile` — Profil & Settings

**Tabs:**
1. **Profil:** Edit nama, bio, avatar upload, nomor HP
2. **Password:** Ganti password (current + new)
3. **Akun Google:** Status bind + tombol "Hubungkan Google" atau "Lepas"
4. **Preferensi:** Notifikasi email (toggle), bahasa, timezone

---

### `/teacher/courses/new` & `/teacher/courses/:id/edit` — Course Editor

**Multi-step wizard (4 langkah):**

#### Step 1 — Informasi Dasar
- Judul kursus
- Deskripsi panjang (TipTap rich text editor)
- Deskripsi singkat (textarea)
- Kategori (dropdown searchable)
- Level (segmented)
- Bahasa (select)
- Estimasi jam
- Harga (input angka Rupiah, 0 = gratis)
- Upload thumbnail (drag-drop, preview 16:9)
- Upload video preview opsional

#### Step 2 — Kurikulum
- Drag-drop reorder sections (dnd-kit)
- Per section: nama + tombol "+ Tambah Lesson" + trash
- Drag-drop reorder lessons dalam section
- Per lesson: judul + pilihan tipe + konten sesuai tipe
  - **Video:** upload file atau URL eksternal + progress bar upload
  - **Dokumen:** upload PDF + preview nama file
  - **Teks:** TipTap editor inline
  - **Zoom:** input URL + DateTimePicker + durasi menit
  - **Assignment:** textarea instruksi + DatePicker due + multi-select tipe file
  - **Quiz:** Quiz Builder (lihat di bawah)
- Toggle per lesson: Free Preview | Estimasi durasi menit

#### Quiz Builder (embedded di Step 2)
- Daftar soal (drag-drop reorder)
- Tambah soal → pilih tipe:
  - `multiple_choice`: teks soal + 4-6 pilihan (radio mana yang benar) + penjelasan jawaban
  - `multiple_answer`: teks soal + pilihan (checkbox, bisa multi-benar) + penjelasan
  - `true_false`: teks + toggle Benar/Salah
  - `short_answer`: teks + input jawaban benar (exact match, case-insensitive)
  - `essay`: teks + textarea catatan penilaian (untuk pegangan teacher)
- Setting quiz keseluruhan: batas waktu menit, max attempt, passing score %, shuffle soal, shuffle pilihan

#### Step 3 — Pengaturan
- Certificate: enable/disable toggle
- Requirements (tambah/hapus item — list dinamis)
- Learning Outcomes (tambah/hapus)
- Tags (multi-input)

#### Step 4 — Publish
- Preview ringkasan: thumbnail, judul, total section/lesson
- Tombol: **Simpan Draft** | **Submit untuk Review** | **Publish Langsung** (jika admin)

---

### `/teacher/courses/:id/students` — Manajemen Student

- Search by nama/email
- Tabel: Avatar | Nama | Email | Enrolled At | Progress % | Status Enrollment
- Klik row → modal detail: progress per section, nilai quiz, nilai tugas
- Tombol per row: Suspend / Aktifkan
- Export CSV (semua data)

---

### `/teacher/courses/:id/gradebook` — Gradebook

- Layout spreadsheet: baris = student, kolom = setiap quiz + tugas
- Header kolom: nama aktivitas + (quiz/tugas)
- Kolom terakhir: **Final Grade** + letter grade
- Sortable by nama atau nilai
- Filter: Lulus / Gagal
- Klik cell assignment → modal grading langsung (input skor + feedback)
- Export CSV

---

### `/admin/` — Admin Dashboard

- Stats utama: Total Users | Total Kursus | Enrollment bulan ini | Completion rate
- Line chart (Recharts): Enrollment per bulan (6 bulan terakhir)
- Bar chart: Top 5 kursus terpopuler

---

### `/admin/users` — User Management

- Search + filter role (semua/admin/teacher/student) + filter status (aktif/nonaktif)
- Tabel: Avatar | Nama | Email | Role | Status | Tgl Daftar | Aksi
- Aksi per row: Edit | Aktifkan / Nonaktifkan
- Bulk action: pilih beberapa → Aktifkan / Nonaktifkan
- Tombol "+ Tambah User" → modal form (nama, email, password, role)
- Export CSV

---

### `/admin/courses` — Course Management & Approval

- Tabs: Semua | Pending Review | Published | Draft | Archived
- Tabel: Thumbnail | Judul | Instruktur | Kategori | Status | Enrolled | Rating | Aksi
- Aksi untuk Pending: **Publish** | **Tolak** (kembalikan ke draft)
- Aksi lain: Archive | Delete

---

### `/admin/categories` — Category Management

- List kategori + icon + sortOrder
- Inline edit atau modal
- Drag-drop reorder sortOrder
- Tombol "+ Tambah Kategori" → modal form

---

### `/admin/analytics` — Analytics Global

- KPI cards: Total users, kursus, enrollment, completion rate
- Line chart: User registration per bulan
- Bar chart: Top kursus berdasarkan enrollment
- Pie chart: Distribusi role user

---

### `/verify/:code` — Verifikasi Sertifikat (Publik)

- Tanpa login
- Tampil: Nama pemegang | Nama kursus | Nama instruktur | Tanggal diterbitkan
- Tombol **Download PDF** (langsung ke URL MinIO)
- Tombol **Bagikan** (copy link ke clipboard + toast "Link tersalin!")
- Jika code tidak valid → halaman error "Sertifikat tidak ditemukan"

---

## Component Library

### `src/components/ui/` — Base Components

| Komponen | Deskripsi |
|---|---|
| `Button` | Variant: primary/secondary/ghost/danger | Size: sm/md/lg | Loading state |
| `Input` | Text input + label + error message + helper text |
| `Textarea` | Multi-line input |
| `Select` | Dropdown searchable (Combobox) |
| `Checkbox` | Form checkbox dengan label |
| `Radio` | Radio button |
| `Badge` | Label status berwarna (success/warning/danger/info/neutral) |
| `Avatar` | Gambar profil + fallback inisial |
| `Modal` | Dialog overlay + focus trap (WCAG) + Escape to close |
| `Drawer` | Side panel (mobile-friendly) |
| `Toast` | Notifikasi temporary (success/error/info/warning) |
| `Tooltip` | Hover explanation |
| `Card` | Container dengan shadow + optional header/footer |
| `Table` | Tabel dengan sortable column header |
| `Pagination` | Previous/Next/page numbers |
| `Skeleton` | Placeholder loading (shimmer animation) |
| `Progress` | Progress bar horizontal + label % |
| `ProgressRing` | Progress circle (untuk completion) |
| `Tabs` | Tab navigation dengan underline indicator |
| `Accordion` | Collapsible sections |
| `Breadcrumb` | Navigasi hierarki dengan separator |
| `EmptyState` | Ilustrasi + heading + pesan saat data kosong |
| `ConfirmDialog` | Modal konfirmasi aksi berbahaya (delete, dll) |
| `RatingStars` | Display (non-interactive) + Input (clickable) |

### `src/components/layout/` — Layout Components

| Komponen | Deskripsi |
|---|---|
| `AppShell` | Root layout: sidebar + topnav + main content area |
| `Sidebar` | Nav lateral per role, collapsible (dengan icon-only mode) |
| `TopNav` | Search global, notifikasi badge + dropdown, avatar menu |
| `PageHeader` | Judul halaman + breadcrumb + slot action button |
| `Footer` | Footer sederhana (copyright, links) |

### `src/components/course/` — Course Components

| Komponen | Deskripsi |
|---|---|
| `CourseCard` | Card untuk catalog: thumbnail, info, tombol |
| `CurriculumAccordion` | Accordion kurikulum di halaman detail kursus |
| `LessonNavigator` | Sidebar di course player (section + lesson list) |
| `VideoPlayer` | HTML5 player: resume, speed control, auto-complete |
| `QuizWidget` | Interface quiz: soal, timer, submit, hasil |
| `AssignmentWidget` | Upload tugas + status submission + nilai |
| `ZoomWidget` | Info Zoom meeting + countdown + tombol buka |
| `ReviewCard` | Kartu ulasan: avatar + rating + teks |
| `CourseProgress` | Progress bar + teks "X dari Y lesson selesai" |

### `src/components/editor/` — Editor Components

| Komponen | Deskripsi |
|---|---|
| `RichTextEditor` | TipTap (bold, italic, heading, list, code, link, image) |
| `VideoUploader` | Drag-drop + progress bar upload video |
| `FileUploader` | Upload generik (PDF, dokumen) + preview nama file |
| `ImageUploader` | Upload + crop preview + instant preview |
| `QuizBuilder` | Editor quiz full (soal + opsi + setting keseluruhan) |
| `SortableList` | Wrapper dnd-kit untuk drag-drop reorder |

---

## State Management

### Zustand Stores

```typescript
// authStore.ts
{
  user: User | null;
  accessToken: string | null;       // in-memory ONLY (tidak di localStorage)
  setAuth: (user, accessToken) => void;
  logout: () => void;
}

// courseStore.ts
{
  courseCache: Record<string, Course>;  // cache by id/slug
  enrolledCourseIds: Set<string>;
  setEnrolled: (courseId) => void;
}

// playerStore.ts
{
  currentLesson: Lesson | null;
  videoPosition: number;            // detik
  setCurrentLesson: (lesson) => void;
  updateVideoPosition: (sec) => void;
}

// notificationStore.ts
{
  notifications: Notification[];
  unreadCount: number;
  markRead: (id) => void;
  markAllRead: () => void;
}

// uiStore.ts
{
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
}
```

### TanStack Query — Server State

Semua data dari API menggunakan `@tanstack/react-query`:

```typescript
// Contoh hooks

// useCourses.ts
export const useCourses = (params) =>
  useQuery({ queryKey: ['courses', params], queryFn: () => api.get('/courses', { params }) });

// useEnrollment.ts
export const useEnroll = () =>
  useMutation({ mutationFn: (courseId) => api.post(`/enrollments/courses/${courseId}`) });

// useProgress.ts
export const useMarkComplete = (lessonId) =>
  useMutation({
    mutationFn: () => api.post(`/sections/.../lessons/${lessonId}/complete`),
    onSuccess: () => queryClient.invalidateQueries(['progress']),
  });

// useNotifications.ts
export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications') });
```

**Custom Hooks (src/hooks/):**

| Hook | Tujuan |
|---|---|
| `useCourses(params)` | Catalog + search + filter |
| `useEnrollment(courseId)` | Status enrollment + enroll/unenroll |
| `useProgress(courseId)` | Progress per lesson, recalculate |
| `useQuiz(quizId)` | Start attempt, submit, get result |
| `useNotifications()` | List + unread count + mark read |
