# 11 — FASE 4: Auth Lanjut, Analytics & Polish (Minggu 7-8)

> **Kembali ke:** [Index](./00-INDEX.md)  
> **Prasyarat:** Fase 3 sudah selesai  
> **Target:** Google OAuth bind, analytics, security hardening, performance polish

---

## Status

- [ ] **Minggu 7** — Refresh token + Google OAuth + Forgot Password + Analytics
- [ ] **Minggu 8** — Rate limiting Redis + Sanitization + TanStack Query refactor + Polish

---

## Minggu 7 — Backend

### 7.1 Refresh Token System

Update `routes/auth.ts`:

**Saat login** — simpan refresh token ke DB:
```typescript
// POST /auth/login
const refreshToken = sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

// Simpan ke DB
await db.insert(refreshTokens).values({
  userId: user.id,
  token: refreshToken,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

return c.json({ accessToken, refreshToken, user: sanitizedUser });
```

**POST /auth/refresh** — token rotation:
```typescript
// 1. Verify refresh token (JWT signature)
// 2. Cari token di DB → jika tidak ada = sudah di-logout atau dicuri
// 3. Cek expiresAt tidak kadaluarsa
// 4. Hapus token lama dari DB
// 5. Generate access token baru + refresh token baru
// 6. Simpan refresh token baru ke DB
// 7. Return { accessToken, refreshToken }
```

**POST /auth/logout**:
```typescript
// Hapus refresh token dari DB (invalidate permanent)
await db.delete(refreshTokens).where(eq(refreshTokens.token, body.refreshToken));
```

### 7.2 Google OAuth Bind

**Setup Google Cloud:**
1. Buka https://console.cloud.google.com
2. Buat OAuth 2.0 Client ID (Web Application)
3. Tambah Authorized redirect URIs:
   - `http://localhost:8080/api/v1/auth/me/google/callback` (dev)
   - `https://yourdomain.com/api/v1/auth/me/google/callback` (prod)
4. Salin `CLIENT_ID` dan `CLIENT_SECRET` ke `.env`

**`POST /auth/me/google/bind`** (authenticated):
```typescript
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// Generate URL dengan state = userId
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['openid', 'email', 'profile'],
  state: userId,  // dikembalikan oleh Google di callback
  prompt: 'select_account',
});

return c.json({ authUrl });
```

**`GET /auth/me/google/callback`** (OAuth callback):
```typescript
const { code, state: userId } = c.req.query();

// Tukar code dengan token
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);

// Ambil profil Google
const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
const { data: profile } = await oauth2.userinfo.get();

// Cek apakah google_id sudah dipakai akun lain
const existing = await db.query.users.findFirst({
  where: eq(users.googleId, profile.id!),
});
if (existing && existing.id !== userId) {
  return c.redirect(`${process.env.APP_URL}/settings?error=google_already_bound`);
}

// Simpan google_id ke user
await db.update(users)
  .set({ googleId: profile.id, googleEmail: profile.email })
  .where(eq(users.id, userId));

return c.redirect(`${process.env.APP_URL}/student/profile?google_bind=success`);
```

**`GET /auth/google/login`** (login via Google setelah bind):
```typescript
const authUrl = oauth2Client.generateAuthUrl({
  scope: ['openid', 'email', 'profile'],
  prompt: 'select_account',
});
return c.redirect(authUrl);
```

**`GET /auth/google/callback`** (login callback):
```typescript
const { code } = c.req.query();
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);
const { data: profile } = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();

// Cari user by google_id
const user = await db.query.users.findFirst({
  where: eq(users.googleId, profile.id!),
});

if (!user) {
  return c.redirect(`${process.env.APP_URL}/login?error=google_not_bound`);
}

if (!user.isActive) {
  return c.redirect(`${process.env.APP_URL}/login?error=account_disabled`);
}

// Issue JWT seperti login biasa
const accessToken = sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '15m' });
const refreshToken = sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });

// Simpan refresh token ke DB
await db.insert(refreshTokens).values({
  userId: user.id, token: refreshToken,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

// Redirect ke frontend dengan token di query param (lalu frontend simpan ke state)
// ATAU set cookie HTTPOnly (lebih aman)
return c.redirect(
  `${process.env.APP_URL}/auth/google/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`
);
```

### 7.3 Forgot Password + Reset

**`POST /auth/forgot-password`**:
```typescript
const { email } = await c.req.json();
const user = await db.query.users.findFirst({ where: eq(users.email, email) });

if (!user) {
  // Jangan reveal apakah email terdaftar (anti-enumeration)
  return c.json({ message: 'Jika email terdaftar, link reset telah dikirim.' });
}

// Generate token
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = createHash('sha256').update(rawToken).digest('hex');

// Simpan ke tabel password_reset_tokens (expire 1 jam)
await db.insert(passwordResetTokens).values({
  userId: user.id,
  tokenHash,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
});

// Kirim email
await sendEmail({
  to: user.email,
  subject: 'Reset Password',
  html: passwordResetEmail(user.name, `${process.env.APP_URL}/reset-password?token=${rawToken}`),
});

return c.json({ message: 'Jika email terdaftar, link reset telah dikirim.' });
```

**`POST /auth/reset-password`**:
```typescript
const { token, newPassword } = await c.req.json();
const tokenHash = createHash('sha256').update(token).digest('hex');

const resetToken = await db.query.passwordResetTokens.findFirst({
  where: and(
    eq(passwordResetTokens.tokenHash, tokenHash),
    gt(passwordResetTokens.expiresAt, new Date())
  ),
});

if (!resetToken) {
  return c.json({ error: 'Token tidak valid atau sudah kadaluarsa' }, 400);
}

const passwordHash = await hash(newPassword, 12);
await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id));

// Invalidate semua refresh tokens user ini
await db.delete(refreshTokens).where(eq(refreshTokens.userId, resetToken.userId));

return c.json({ message: 'Password berhasil diubah, silakan login kembali.' });
```

### 7.4 `routes/analytics.ts` (NEW)

```typescript
// GET /api/v1/analytics/overview (admin only)
const [
  totalUsers,
  totalCourses,
  publishedCourses,
  totalEnrollments,
  completedEnrollments,
] = await Promise.all([
  db.select({ count: count() }).from(users),
  db.select({ count: count() }).from(courses),
  db.select({ count: count() }).from(courses).where(eq(courses.status, 'published')),
  db.select({ count: count() }).from(enrollments),
  db.select({ count: count() }).from(enrollments).where(eq(enrollments.status, 'completed')),
]);

// Enrollment per bulan (6 bulan terakhir) untuk line chart
// Top 5 kursus terpopuler
```

---

## Minggu 7 — Frontend

### Settings Page (`/student/profile`)

**Tab "Akun Google":**
```tsx
function GoogleBindSection() {
  const { user } = useAuthStore();
  const bindMutation = useMutation({
    mutationFn: () => api.post('/auth/me/google/bind'),
    onSuccess: (data) => {
      window.location.href = data.authUrl; // redirect ke Google
    },
  });
  const unbindMutation = useMutation({
    mutationFn: () => api.delete('/auth/me/google/unbind'),
    onSuccess: () => queryClient.invalidateQueries(['me']),
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Akun Google</h3>
      {user?.googleId ? (
        <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
          <div>
            <p className="font-medium text-green-700">✅ Terhubung</p>
            <p className="text-sm text-gray-500">{user.googleEmail}</p>
          </div>
          <ConfirmDialog
            trigger={<Button variant="danger" size="sm">Lepas</Button>}
            title="Lepas akun Google?"
            description="Kamu tidak bisa lagi login via Google jika dilepas."
            onConfirm={() => unbindMutation.mutate()}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <p className="font-medium">Belum terhubung</p>
            <p className="text-sm text-gray-500">Hubungkan untuk login lebih mudah</p>
          </div>
          <Button onClick={() => bindMutation.mutate()} loading={bindMutation.isPending}>
            Hubungkan Google
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Callback handler (`/auth/google/callback`):**
```tsx
// pages/GoogleCallback.tsx
function GoogleCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');
    
    if (error) {
      if (error === 'google_not_bound') {
        toast.error('Akun Google belum dihubungkan. Login manual dulu.');
      }
      navigate('/login');
      return;
    }
    
    if (accessToken && refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
      // Fetch profil user
      api.get('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then(({ data }) => {
          setAuth(data, accessToken);
          navigate('/dashboard');
        });
    }
  }, []);
  
  return <LoadingSpinner />;
}
```

### Admin Analytics Dashboard

```tsx
// pages/admin/Analytics.tsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// KPI Cards
// Line chart: enrollment per bulan (data dari /analytics/overview)
// Bar chart: top 5 kursus
// Pie chart: distribusi role user
```

### Teacher Course Analytics

```tsx
// pages/teacher/CourseAnalytics.tsx (accessible dari /teacher/courses/:id/analytics)
// Stats: total enrolled, active, completed, completion rate
// Bar chart: progress distribution (0-25%, 25-50%, 50-75%, 75-100%)
// Line chart: enrollment per minggu (sejak kursus publish)
```

---

## Minggu 8 — Security & Polish

### 8.1 Rate Limiting dengan Redis

Install middleware ke `src/index.ts`:
```typescript
import { rateLimit } from './middleware/rateLimit';

// Auth endpoints
app.use('/api/v1/auth/login', rateLimit('login', 5, 900));       // 5/15menit
app.use('/api/v1/auth/register', rateLimit('register', 3, 3600)); // 3/jam
app.use('/api/v1/auth/forgot-password', rateLimit('forgot', 3, 3600));

// Upload
app.use('/api/v1/upload/*', rateLimit('upload', 10, 60));

// General API
app.use('/api/*', rateLimit('api', 100, 60));
```

### 8.2 HTML Sanitization

Di semua route yang menerima HTML (TipTap content):
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Dalam route handler sebelum insert ke DB:
if (body.textContent) {
  body.textContent = DOMPurify.sanitize(body.textContent, {
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em',
                   'a', 'img', 'blockquote', 'code', 'pre', 'br', 'table', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
  });
}
```

### 8.3 TanStack Query Refactor (Frontend)

Ganti semua `useState + useEffect + axios.get()` dengan `useQuery`:

```typescript
// SEBELUM (pola lama)
const [courses, setCourses] = useState([]);
useEffect(() => {
  axios.get('/courses').then(r => setCourses(r.data));
}, []);

// SESUDAH (pola baru)
const { data: courses, isLoading } = useQuery({
  queryKey: ['courses', filters],
  queryFn: () => api.get('/courses', { params: filters }).then(r => r.data),
});
```

### 8.4 Code Splitting & Performance

```typescript
// Lazy load semua halaman (sudah di setup App.tsx)
const CourseCatalog = lazy(() => import('@/pages/CourseCatalog'));
const CoursePlayer = lazy(() => import('@/pages/CoursePlayer'));
// dst.

// Preload halaman yang sering dikunjungi setelah login:
// - Prefetch course catalog saat user landing di dashboard
// - Prefetch lesson content saat user hover/focus lesson di navigator
```

### 8.5 Lighthouse Targets

| Metric | Target |
|---|---|
| Performance | ≥ 80 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |
| SEO | ≥ 90 |

**Langkah audit:**
```bash
# Build production bundle
cd frontend && npm run build

# Serve dengan nginx atau preview
npm run preview

# Buka Chrome DevTools → Lighthouse → Generate report
```

**Optimasi umum:**
- Image: gunakan `loading="lazy"` + `width`/`height` untuk semua `<img>`
- Font: Google Fonts dengan `display=swap`
- Bundle: Vite otomatis code split — pastikan tidak ada barrel imports yang besar

### 8.6 WCAG Accessibility Review

- [ ] Semua form input punya `<label>` terhubung via `htmlFor`
- [ ] Tombol punya accessible name (bukan hanya icon)
- [ ] Modal punya `role="dialog"` + `aria-labelledby` + focus trap
- [ ] Color contrast ratio ≥ 4.5:1 untuk text
- [ ] Keyboard navigation: Tab, Enter, Escape berfungsi di modal/dropdown
- [ ] Skip to main content link di awal halaman

### 8.7 Docker Healthchecks & Resource Limits

Sudah dicontohkan di [05-infrastructure.md](./05-infrastructure.md). Pastikan semua service punya:
```yaml
healthcheck: ...
deploy:
  resources:
    limits:
      memory: 512M  # sesuaikan per service
```

### 8.8 README.md Final

Buat `README.md` di root project:
```markdown
# E-Learning Platform

## Prerequisites
- Docker & Docker Compose v2
- (Opsional) Google OAuth credentials untuk fitur Google bind

## Quick Start
1. cp .env.example .env  # lalu isi semua nilai
2. docker-compose up -d
3. docker-compose exec backend tsx seed.ts
4. Buka http://localhost:8080

## Akun Default (dari seed)
- Admin: admin@example.com / admin123
- Teacher: teacher@example.com / teacher123
- Student: student@example.com / student123

## Dokumentasi
Lihat folder docs/ untuk panduan teknis lengkap.
```

---

## Checklist Fase 4

### Backend
- [ ] Refresh token rotation berfungsi (setiap /refresh dapat token baru)
- [ ] Logout menghapus refresh token dari DB
- [ ] `POST /auth/me/google/bind` → return authUrl yang valid
- [ ] Callback Google bind → simpan google_id ke user
- [ ] `GET /auth/google/login` + callback → login berhasil jika sudah bind
- [ ] Error jika Google belum bind → redirect dengan error param
- [ ] Forgot password → email terkirim dengan link valid
- [ ] Reset password → password berubah + semua refresh token diinvalidate
- [ ] Analytics overview berfungsi
- [ ] Rate limiting aktif (test dengan curl loop)

### Frontend
- [ ] Axios interceptor auto-refresh saat 401
- [ ] Refresh token disimpan di localStorage, access token di Zustand
- [ ] Settings page Tab "Akun Google" berfungsi
- [ ] `/auth/google/callback` handler benar (ambil token dari query param)
- [ ] Forgot password → form → tampil konfirmasi
- [ ] Reset password → form → redirect login setelah berhasil
- [ ] Admin analytics dashboard dengan charts
- [ ] Teacher analytics per kursus
- [ ] Semua `useState + useEffect` fetch sudah diganti dengan `useQuery`
- [ ] Lazy loading semua halaman aktif
- [ ] Tidak ada warning konsol terkait accessibility

### Performance & Security
- [ ] Lighthouse Performance ≥ 80
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Rate limiting 5x login/15min tercegah (test manual)
- [ ] Upload file: MIME validation berfungsi (coba upload .exe rename jadi .pdf)
- [ ] HTML sanitization: coba input `<script>alert(1)</script>` → tidak execute
- [ ] Nginx security headers ada (cek via curl -I)
- [ ] `.env.example` lengkap dengan semua variabel
- [ ] `README.md` dengan instruksi setup
