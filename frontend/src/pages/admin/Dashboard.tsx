import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, FolderOpen, UserCheck, ArrowRight, ShieldCheck,
  Sparkles, Layers, Activity, TrendingUp
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { AnnouncementWidget } from '@/components/shared/AnnouncementWidget';

interface OverviewData {
  totals: { users: number; teachers: number; publishedCourses: number; enrollments: number; completedEnrollments: number };
  thisMonth: { newUsers: number; newEnrollments: number };
  topCourses: { id: string; title: string; slug: string; totalEnrolled: number }[];
  recentEnrollments: { userId: string; courseTitle: string; enrolledAt: string }[];
}

interface UsersResponse {
  data: unknown[];
  pagination: { total: number; totalPages: number };
}

interface CoursesResponse {
  data: unknown[];
  pagination: { total: number; totalPages: number };
}

export default function AdminDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await api.get<OverviewData>('/analytics/overview');
      return res.data;
    },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users-count'],
    queryFn: async () => {
      const res = await api.get<UsersResponse>(`/users?page=1&limit=1`);
      return res.data;
    },
  });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['admin-courses-count'],
    queryFn: async () => {
      const res = await api.get<CoursesResponse>(`/courses/admin/all?status=published&limit=1`);
      return res.data;
    },
  });

  const totals = data?.totals;

  const stats = [
    {
      label: 'Total Pengguna',
      value: usersData?.pagination?.total ?? totals?.users ?? 0,
      icon: <Users className="h-5 w-5" />,
      color: 'text-primary bg-primary/10 border-primary/20',
      to: '/admin/users',
      sublabel: 'Akun santri, guru, & admin',
    },
    {
      label: 'Guru & Pembimbing',
      value: totals?.teachers ?? 0,
      icon: <ShieldCheck className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      to: '/admin/users',
      sublabel: 'Pendidik aktif terverifikasi',
    },
    {
      label: 'Kursus Terbit',
      value: coursesData?.pagination?.total ?? totals?.publishedCourses ?? 0,
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      to: '/admin/courses',
      sublabel: 'Silabus terpublikasi & aktif',
    },
    {
      label: 'Total Santri Belajar',
      value: totals?.enrollments ?? 0,
      icon: <UserCheck className="h-5 w-5" />,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      to: '/admin/analytics',
      sublabel: 'Akumulasi seluruh enrollment',
    },
  ];

  const quickActions = [
    {
      title: 'Manajemen Pengguna',
      description: 'Kelola akun santri, aktivasi asatidz, dan sinkronisasi SSO SIDIQ.',
      to: '/admin/users',
      icon: <Users className="h-5 w-5 text-primary" />,
      badge: 'User Management',
    },
    {
      title: 'Manajemen Kursus',
      description: 'Moderasi kurikulum, audit materi silabus, dan kelola penerbitan.',
      to: '/admin/courses',
      icon: <BookOpen className="h-5 w-5 text-emerald-600" />,
      badge: 'Course Control',
    },
    {
      title: 'Kategori Kursus',
      description: 'Atur rumpun ilmu, bidang studi, dan taksonomi materi pesantren.',
      to: '/admin/categories',
      icon: <FolderOpen className="h-5 w-5 text-amber-600" />,
      badge: 'Taxonomy',
    },
    {
      title: 'Analitik & Evaluasi',
      description: 'Laporan metrik kelulusan, retensi santri, dan aktivitas belajar.',
      to: '/admin/analytics',
      icon: <Activity className="h-5 w-5 text-indigo-600" />,
      badge: 'Reports',
    },
  ];

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Banner Emerald SIDIQ */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 w-48 h-48 bg-white/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider opacity-90 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" /> Pusat Kendali Sistem E-Learning
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                {user?.name ?? 'Administrator SIDIQ'}
              </h2>
              <div className="text-xs opacity-90 font-mono mt-1 flex flex-wrap items-center gap-2">
                <span>{user?.email ?? 'admin@sidiq.id'}</span>
                <span>•</span>
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium text-emerald-100">
                  Akses Penuh Superadmin
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link to="/admin/courses">
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md shadow-sm font-semibold transition-all hover:scale-105"
              >
                <Layers className="mr-2 h-4 w-4" />
                Audit Seluruh Kursus
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Col Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading || usersLoading || coursesLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </div>
              <div className="mt-2 space-y-1">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            </Card>
          ))
        ) : (
          stats.map((s) => (
            <Link key={s.label} to={s.to} className="block group">
              <Card className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs md:text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                    {s.label}
                  </span>
                  <div className={`p-2 rounded-xl flex items-center justify-center ${s.color}`}>
                    {s.icon}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-extrabold text-foreground">{s.value}</div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{s.sublabel}</p>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Asymmetric 2/3 + 1/3 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3): Completion Stats & Top Courses */}
        <div className="lg:col-span-2 space-y-6">
          {data && (
            <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Ringkasan Kelulusan & Penerimaan Siswa
                </CardTitle>
                <CardDescription className="text-xs">
                  Statistik akumulasi ketuntasan kursus di lingkungan pesantren
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border bg-card/60 p-3.5 border-l-4 border-l-primary">
                    <span className="text-xs font-medium text-muted-foreground">Total Enrollment</span>
                    <p className="text-2xl font-extrabold text-foreground mt-1">{data.totals.enrollments}</p>
                  </div>
                  <div className="rounded-xl border bg-card/60 p-3.5 border-l-4 border-l-emerald-500">
                    <span className="text-xs font-medium text-muted-foreground">Tuntas / Lulus</span>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">{data.totals.completedEnrollments}</p>
                  </div>
                  <div className="rounded-xl border bg-card/60 p-3.5 border-l-4 border-l-blue-500">
                    <span className="text-xs font-medium text-muted-foreground">Tingkat Kelulusan</span>
                    <p className="text-2xl font-extrabold text-blue-600 mt-1">
                      {data.totals.enrollments > 0 ? Math.round((data.totals.completedEnrollments / data.totals.enrollments) * 100) : 0}%
                    </p>
                  </div>
                  <div className="rounded-xl border bg-card/60 p-3.5 border-l-4 border-l-amber-500">
                    <span className="text-xs font-medium text-muted-foreground">User Baru Bulan Ini</span>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">{data.thisMonth.newUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Platform Actions Grid */}
          <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Manajemen Pusat Platform
              </CardTitle>
              <CardDescription className="text-xs">
                Akses cepat modul konfigurasi master data sistem LMS
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {quickActions.map((a) => (
                  <Link
                    key={a.title}
                    to={a.to}
                    className="group rounded-xl border border-border p-3.5 transition-all hover:bg-muted/40 hover:border-primary/40 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                        {a.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                            {a.title}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{a.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3): Announcements & System Status */}
        <div className="space-y-6">
          <AnnouncementWidget />

          <Card className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Status Sinkronisasi SIDIQ
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                <span className="font-semibold">Webhook Sync Bridge</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-mono text-[10px]">AKTIF</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-muted-foreground">
                <span>SSO Token Provider</span>
                <span className="font-mono text-[11px] font-semibold text-foreground">JWT HS256</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-muted-foreground">
                <span>Database Connection</span>
                <span className="font-mono text-[11px] font-semibold text-emerald-600">PostgreSQL (Healthy)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
