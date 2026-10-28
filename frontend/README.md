# Frontend — E-Learning Platform

React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query + Zustand + React Router v7.

## Tech Stack

- **Framework:** React 19 + TypeScript (strict)
- **Build:** Vite 8 + `@vitejs/plugin-react` (Oxc)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Server state:** TanStack Query v5 (`@tanstack/react-query`)
- **Client state:** Zustand (`src/store/authStore.ts`)
- **Routing:** React Router v7 — lazy loading + guard (`RequireAuth`, `RequireRole`, `RoleDashboard`)
- **HTTP:** Axios (`src/lib/api.ts`) — interceptor auto-refresh JWT (single-flight)
- **UI kit:** Komponen custom sendiri di `src/components/ui/*` (Button, Card, Input, Textarea, Select, Badge, Pagination, Progress, Skeleton, Toast, RichTextEditor)
- **Icons:** lucide-react
- **Date:** dayjs
- **Sanitasi HTML:** dompurify

Catatan: tidak memakai React Compiler / SWC / dnd-kit / recharts / TipTap / react-player — player video & editor kuis/rich text dikembangkan custom.

## Scripts

- `npm run dev` — dev server (Vite)
- `npm run build` — `tsc -b && vite build`
- `npm run preview` — preview build
- `npm run lint` — oxlint
- `npm run test` — vitest

## Struktur

```
src/
├── main.tsx
├── App.tsx            # router + lazy loading + providers (QueryClient, Toast)
├── index.css          # Tailwind v4
├── pages/             # halaman: Landing, Login, Register, Forgot/Reset, GoogleCallback,
│                     #        CourseCatalog, CourseDetail, CoursePlayer, student/*,
│                     #        teacher/*, admin/*, VerifyCertificate, Profile, NotFound, unauth
├── components/
│   ├── ui/            # design system (Button, Card, Input, ... RichTextEditor, Toast)
│   ├── course/        # QuizWidget, VideoPlayer, AssignmentWidget, DiscussionPanel, AnnouncementPanel
│   ├── course/editor/# CurriculumBuilder, LessonEditorPanel, QuizBuilder, FileUploader
│   ├── layout/        # AppShell, Sidebar, TopNav, NotificationBell, Footer
│   └── auth/          # RequireAuth, RequireRole, RoleDashboard
├── lib/               # api (axios+refresh), sanitize, utils, queryClient
├── store/             # authStore (Zustand)
├── hooks/             # useSession
└── types/             # tipe API
```

## Environment

- API base URL: `/api/v1` (di-proxy lewat nginx ke backend).
- Tidak ada `.env` frontend yang di-commit; konfigurasi kredensial ada di `backend/.env`.

## QA

- Test: **22/22 passed** (vitest, Testing Library + jsdom)
- Typecheck: `tsc -b` — bersih
- Lint: oxlint

## Dokumentasi Terkait

- Root project: [`../README.md`](../README.md)
- Backend & API: [`../backend/`](../backend/) (tanpa README terpisah — diatur di root README)
- Rencana implementasi: [`../implementation-plans/`](../implementation-plans/)
