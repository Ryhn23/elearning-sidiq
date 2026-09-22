# 07 — Dependencies Tambahan

> **Kembali ke:** [Index](./00-INDEX.md)

---

## Backend — `package.json`

### Install Command

```bash
cd backend
npm install ioredis minio nodemailer googleapis pdf-lib qrcode file-type slugify nanoid isomorphic-dompurify
npm install -D @types/nodemailer @types/qrcode vitest
```

### Detail Packages

| Package | Versi | Fase | Fungsi |
|---|---|:---:|---|
| `ioredis` | ^5.x | 2 | Redis client untuk rate limiting + blacklist token |
| `minio` | ^8.x | 2 | MinIO S3 client untuk upload/download file |
| `nodemailer` | ^7.x | 2 | Kirim email (welcome, notifikasi, dll) |
| `googleapis` | ^150.x | 4 | Google OAuth 2.0 (bind akun + login via Google) |
| `pdf-lib` | ^1.x | 3 | Generate PDF sertifikat |
| `qrcode` | ^1.x | 3 | Generate QR code untuk URL verifikasi sertifikat |
| `file-type` | ^19.x | 2 | Deteksi MIME type via magic bytes (bukan extension) |
| `slugify` | ^1.x | 1 | Generate URL-friendly slug dari judul kursus |
| `nanoid` | ^5.x | 3 | Generate kode unik untuk sertifikat (e.g., `ABC-DEF-GHI`) |
| `isomorphic-dompurify` | ^2.x | 4 | Sanitize HTML dari rich text editor (server-side) |

### Dev Dependencies

| Package | Fungsi |
|---|---|
| `@types/nodemailer` | TypeScript types untuk nodemailer |
| `@types/qrcode` | TypeScript types untuk qrcode |
| `vitest` | Unit testing framework |

---

## Frontend — `package.json`

### Install Command

```bash
cd frontend
npm install @tanstack/react-query @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @dnd-kit/core @dnd-kit/sortable recharts react-player dayjs clsx tailwind-merge
```

### Detail Packages

| Package | Versi | Fase | Fungsi |
|---|---|:---:|---|
| `@tanstack/react-query` | ^5.x | 1 | Server state management (fetch, cache, invalidation) |
| `@tiptap/react` | ^2.x | 2 | Rich text editor (React integration) |
| `@tiptap/starter-kit` | ^2.x | 2 | TipTap bundle: heading, bold, italic, list, dll |
| `@tiptap/extension-image` | ^2.x | 2 | Image embedding di TipTap |
| `@tiptap/extension-link` | ^2.x | 2 | Link di TipTap |
| `@dnd-kit/core` | ^6.x | 2 | Drag-and-drop core (reorder sections/lessons) |
| `@dnd-kit/sortable` | ^8.x | 2 | Sortable list wrapper untuk dnd-kit |
| `recharts` | ^2.x | 4 | Charts (analytics dashboard) |
| `react-player` | ^2.x | 2 | Video player (support URL MinIO, YouTube, Vimeo) |
| `dayjs` | ^1.x | 1 | Tanggal/waktu (format, relative time, countdown) |
| `clsx` | ^2.x | 1 | Conditional class utility |
| `tailwind-merge` | ^2.x | 1 | Merge TailwindCSS classes tanpa conflict |

---

## Yang Sudah Ada (Jangan Dihapus)

### Backend (existing)
- `hono` — web framework
- `@hono/zod-openapi` — API validation + OpenAPI spec
- `drizzle-orm` — ORM
- `postgres` — PostgreSQL driver
- `@hono/swagger-ui` — Swagger UI
- `bcryptjs` / `@node-rs/bcrypt` — password hashing (cek yang sudah ada)
- `jsonwebtoken` — JWT

### Frontend (existing)
- `react`, `react-dom` — React 19
- `react-router-dom` — routing
- `zustand` — client state
- `axios` — HTTP client
- `tailwindcss` v4 — CSS framework

---

## Notes Kompatibilitas

> [!WARNING]
> `file-type` v19+ adalah pure ESM. Jika backend menggunakan CommonJS (`"type": "commonjs"` di package.json), gunakan versi 16.x atau convert backend ke ESM.

> [!NOTE]
> `nanoid` v5+ juga pure ESM. Alternatif: gunakan `crypto.randomBytes(6).toString('hex').toUpperCase()` untuk generate kode sertifikat tanpa dependency tambahan.

> [!TIP]
> Untuk development email, daftarkan akun gratis di [Mailtrap.io](https://mailtrap.io) — semua email ditangkap di inbox Mailtrap, tidak benar-benar terkirim ke user.
