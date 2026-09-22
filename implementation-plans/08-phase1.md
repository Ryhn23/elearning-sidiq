# 08 — FASE 1: Core Foundation (Minggu 1-2)

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Target:** Platform bisa dipakai end-to-end: Teacher buat kursus → Student enroll → Akses konten → Tandai selesai

---

## Status

- [ ] **Minggu 1** — Backend Foundation
- [ ] **Minggu 2** — Frontend Foundation

---

## Minggu 1 — Backend

### 1.1 Database Schema (Prioritas Pertama)

**File:** `backend/src/db/schema.ts` — Full rewrite

Tabel yang harus ada di Fase 1 (tabel 1-8):

```
✅ users (expanded)
✅ categories
✅ courses (expanded)  
✅ course_sections
✅ lessons
✅ lesson_contents
✅ enrollments
✅ lesson_progress
```

Tabel yang boleh skip di Fase 1 (tambah nanti):
- Tabel 9-24 (assignment, quiz, notification, dll) — tambah sebagai stub kosong untuk reference integrity

**Langkah:**
```bash
# Setelah update schema.ts:
cd backend
npm run db:generate   # generate migration
npm run db:push       # apply ke database
tsx seed.ts           # seed data
```

**Seed data yang dibutuhkan:**
- 1 admin user
- 1 teacher user  
- 5 student users
- 5 categories (Pemrograman, Desain, Data Science, Marketing, Bisnis)
- 3 kursus dummy dengan sections dan lessons

---

### 1.2 Routes Backend

#### `routes/category.ts` (NEW)

```typescript
// CRUD kategori — admin only untuk write
GET    /api/v1/categories          → list all (public)
POST   /api/v1/categories          → create (admin)
PUT    /api/v1/categories/:id      → update (admin)
DELETE /api/v1/categories/:id      → delete (admin)
```

#### `routes/course.ts` (FULL REWRITE)

```typescript
// Hapus implementasi lama (GET /courses saja)
// Tulis ulang dengan:
GET    /api/v1/courses             → catalog (public, filter/search/sort/paginate)
GET    /api/v1/courses/my          → teacher's courses
GET    /api/v1/courses/:id         → public detail (no content)
GET    /api/v1/courses/:id/full    → full detail (enrolled/teacher/admin)
POST   /api/v1/courses             → create (teacher/admin)
PUT    /api/v1/courses/:id         → update (owner/admin)
DELETE /api/v1/courses/:id         → delete (owner/admin)
PATCH  /api/v1/courses/:id/submit  → draft → pending_review
PATCH  /api/v1/courses/:id/publish → pending_review → published (admin)
PATCH  /api/v1/courses/:id/archive → archive
GET    /api/v1/courses/:id/students   → enrolled students (teacher/admin)
GET    /api/v1/courses/:id/analytics  → (placeholder untuk Fase 4)
GET    /api/v1/courses/:id/gradebook  → (placeholder untuk Fase 3)
```

#### `routes/section.ts` (NEW)

```typescript
GET    /api/v1/courses/:courseId/sections               → list + lessons metadata
POST   /api/v1/courses/:courseId/sections               → create section
PUT    /api/v1/courses/:courseId/sections/:sectionId    → update section
DELETE /api/v1/courses/:courseId/sections/:sectionId    → delete section (cascade)
PATCH  /api/v1/courses/:courseId/sections/reorder       → reorder { order: [uuid...] }
```

#### `routes/lesson.ts` (NEW)

```typescript
POST   /api/v1/sections/:sectionId/lessons                      → create lesson
GET    /api/v1/sections/:sectionId/lessons/:lessonId            → get lesson + content
PUT    /api/v1/sections/:sectionId/lessons/:lessonId            → update metadata
PUT    /api/v1/sections/:sectionId/lessons/:lessonId/content    → update content
DELETE /api/v1/sections/:sectionId/lessons/:lessonId            → delete
PATCH  /api/v1/sections/:sectionId/lessons/reorder              → reorder
POST   /api/v1/sections/:sectionId/lessons/:lessonId/complete   → mark complete
DELETE /api/v1/sections/:sectionId/lessons/:lessonId/complete   → unmark complete
PATCH  /api/v1/sections/:sectionId/lessons/:lessonId/video-position → save position
```

> Setelah mark complete/uncomplete: panggil `services/progress.ts` untuk recalculate

#### `routes/enrollment.ts` (NEW)

```typescript
POST   /api/v1/enrollments/courses/:courseId                           → enroll
DELETE /api/v1/enrollments/courses/:courseId                           → unenroll
GET    /api/v1/enrollments/my                                          → my courses + progress
GET    /api/v1/enrollments/my/:courseId/progress                       → detail progress
POST   /api/v1/enrollments/admin/courses/:courseId/users/:userId       → manual enroll (admin)
PATCH  /api/v1/enrollments/admin/:enrollmentId/suspend                 → suspend enrollment
```

#### `services/progress.ts` (NEW)

```typescript
async function recalculateProgress(userId: string, courseId: string): Promise<void>
```

---

### 1.3 Update `src/index.ts`

Register semua routes baru:

```typescript
import { categoryRoutes } from './routes/category';
import { courseRoutes } from './routes/course';
import { sectionRoutes } from './routes/section';
import { lessonRoutes } from './routes/lesson';
import { enrollmentRoutes } from './routes/enrollment';

app.route('/api/v1/categories', categoryRoutes);
app.route('/api/v1/courses', courseRoutes);
// section dan lesson route di-nest dalam courseRoutes jika perlu
app.route('/api/v1/enrollments', enrollmentRoutes);
```

---

## Minggu 2 — Frontend

### 2.1 Setup & Config

**`vite.config.ts`** — tambah path alias:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**`frontend/src/lib/queryClient.ts`** (NEW):
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 }, // 5 menit
  },
});
```

**`frontend/src/lib/utils.ts`** (NEW):
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('id');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return dayjs(date).format('D MMMM YYYY');
}

export function formatRelative(date: string | Date) {
  return dayjs(date).fromNow();
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}
```

---

### 2.2 Routing `App.tsx` (Full Rewrite)

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Suspense, lazy } from 'react';
import { useAuthStore } from '@/store/authStore';

// Lazy load halaman
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const CourseCatalog = lazy(() => import('@/pages/CourseCatalog'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const CoursePlayer = lazy(() => import('@/pages/CoursePlayer'));
// ... semua halaman

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/courses" element={<CourseCatalog />} />
            <Route path="/courses/:slug" element={<CourseDetail />} />
            <Route path="/verify/:code" element={<VerifyCertificate />} />

            {/* Protected routes */}
            <Route element={<RequireAuth />}>
              <Route path="/courses/:slug/learn" element={<CoursePlayer />} />
              <Route path="/dashboard" element={<RoleDashboard />} />

              {/* Student */}
              <Route element={<RequireRole role="student" />}>
                <Route path="/student/*" element={<StudentLayout />} />
              </Route>

              {/* Teacher */}
              <Route element={<RequireRole role={['teacher', 'admin']} />}>
                <Route path="/teacher/*" element={<TeacherLayout />} />
              </Route>

              {/* Admin */}
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin/*" element={<AdminLayout />} />
              </Route>
            </Route>

            {/* Redirect */}
            <Route path="/" element={<Navigate to="/courses" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

---

### 2.3 Design System

**`tailwind.config.js`** — Design tokens:
```javascript
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(221, 83%, 53%)',  // Blue
          foreground: '#ffffff',
          50: 'hsl(214, 100%, 97%)',
          500: 'hsl(221, 83%, 53%)',
          600: 'hsl(224, 76%, 48%)',
          700: 'hsl(226, 71%, 40%)',
        },
        secondary: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(222, 47%, 11%)',
        },
        muted: {
          DEFAULT: 'hsl(210, 40%, 96%)',
          foreground: 'hsl(215, 16%, 47%)',
        },
        border: 'hsl(214, 32%, 91%)',
        background: 'hsl(0, 0%, 100%)',
        foreground: 'hsl(222, 47%, 11%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
    },
  },
};
```

---

### 2.4 Halaman yang Harus Selesai di Fase 1

#### Priority 1 (Wajib)
- [ ] `Login.tsx` — redesign, form email/password, tombol Google (placeholder)
- [ ] `Register.tsx` — form register dengan pilihan role
- [ ] `CourseCatalog.tsx` — grid kursus + filter + search + pagination
- [ ] `CourseDetail.tsx` — halaman detail kursus + kurikulum
- [ ] `CoursePlayer.tsx` — versi dasar (text dan document saja, video Fase 2)
- [ ] `student/Dashboard.tsx` — stats + lanjutkan belajar

#### Priority 2 (Pendukung)
- [ ] Layout: `AppShell`, `Sidebar`, `TopNav`
- [ ] Components UI: `Button`, `Input`, `Card`, `Badge`, `Skeleton`, `Toast`, `Pagination`, `Progress`
- [ ] `ProtectedRoute` dan `RequireRole` component

---

## Checklist Fase 1

### Backend
- [ ] Schema 24 tabel applied ke database
- [ ] Seed data: admin + teacher + 5 students + 5 categories + 3 kursus
- [ ] `GET /api/v1/courses` berfungsi dengan filter & pagination
- [ ] `POST /api/v1/courses` bisa buat kursus baru
- [ ] CRUD sections berfungsi
- [ ] CRUD lessons berfungsi
- [ ] `POST /api/v1/enrollments/courses/:id` berfungsi
- [ ] `POST /lessons/:id/complete` + `services/progress.ts` berfungsi
- [ ] Semua routes terdaftar di `index.ts` dengan OpenAPI schema

### Frontend
- [ ] Routing lengkap dengan ProtectedRoute
- [ ] Design system (colors, font) teraplikasi
- [ ] Login page berfungsi (manual auth)
- [ ] Register page berfungsi
- [ ] Course Catalog tampil dengan data real dari API
- [ ] Course Detail tampil kurikulum (accordion)
- [ ] Course Player bisa buka lesson text/document
- [ ] Mark lesson selesai → progress update di sidebar
- [ ] Student dashboard tampil progress
- [ ] Tidak ada console.error yang berkaitan dengan produk (warning library OK)

### Integration
- [ ] Student bisa register → login → browse → enroll → buka lesson → tandai selesai
- [ ] Teacher bisa login → buat kursus → tambah section → tambah lesson
- [ ] Admin bisa login → publish kursus pending
