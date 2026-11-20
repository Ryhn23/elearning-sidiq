import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen, Star, GraduationCap, ArrowRight, PlusCircle, Pencil,
  Briefcase, Sparkles, FileSpreadsheet, Users
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnnouncementWidget } from '@/components/shared/AnnouncementWidget';

interface MyCourseRow {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
}

export default function TeacherDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: myCourses, isLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const res = await api.get<{ data: MyCourseRow[] }>('/courses/my');
      return res.data.data;
    },
  });

  const courses = myCourses ?? [];

  const statsQuery = useQuery({
    queryKey: ['teacher-course-stats'],
    queryFn: async () => {
      const results = await Promise.all(
        courses.map(async (c) => {
          const res = await api.get<{ totalEnrolled: number; rating: { averageRating: number; totalReviews: number } }>(`/analytics/courses/${c.id}`);
          return res.data;
        }),
      );
      return results;
    },
    enabled: courses.length > 0,
  });

  const courseStats = statsQuery.data ?? [];
  const totalEnrolled = courseStats.reduce((s, c) => s + (c.totalEnrolled ?? 0), 0);
  const avgRating = courseStats.length > 0 ? courseStats.reduce((s, c) => s + (c.rating?.averageRating ?? 0), 0) / courseStats.length : 0;

  const stats = [
    {
      label: 'Kursus Asuhan',
      value: courses.length,
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-primary bg-primary/10 border-primary/20',
      sublabel: 'Silabus materi aktif',
    },
    {
      label: 'Total Santri Terdaftar',
      value: totalEnrolled,
      icon: <GraduationCap className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      sublabel: 'Peserta aktif di semua kelas',
    },
    {
      label: 'Rata-rata Penilaian',
      value: courseStats.length > 0 ? avgRating.toFixed(1) : '5.0',
      icon: <Star className="h-5 w-5" />,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      sublabel: 'Berdasarkan ulasan santri',
    },
    {
      label: 'Buku Nilai Siap',
      value: courses.length,
      icon: <FileSpreadsheet className="h-5 w-5" />,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      sublabel: 'Rekap tugas & kuis otomatis',
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
              <Briefcase className="w-9 h-9 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider opacity-90 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" /> Dasbor Asatidz & Pembimbing
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                {user?.name ?? 'Ustadz / Pengajar'}
              </h2>
              <div className="text-xs opacity-90 font-mono mt-1 flex flex-wrap items-center gap-2">
                <span>{user?.email ?? 'guru@sidiq.id'}</span>
                <span>•</span>
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium text-emerald-100">
                  Guru & Pembina Pesantren
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link to="/teacher/courses/new">
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md shadow-sm font-semibold transition-all hover:scale-105"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Kursus Baru
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 4-Col Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium text-muted-foreground">{s.label}</span>
              <div className={`p-2 rounded-xl flex items-center justify-center ${s.color}`}>
                {s.icon}
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl md:text-3xl font-extrabold text-foreground">{s.value}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.sublabel}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Asymmetric 2/3 + 1/3 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3): Courses Managed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Kursus Asuhan Anda
                </CardTitle>
                <CardDescription className="text-xs">
                  Daftar seluruh silabus materi kursus yang aktif Anda bimbing
                </CardDescription>
              </div>
              <Link to="/teacher/courses/new">
                <Button size="sm" variant="outline" className="text-xs gap-1">
                  <PlusCircle className="h-3.5 w-3.5" /> Tambah
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : courses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Belum ada kursus yang Anda buat</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    Mulai bagikan modul pembelajaran, tugas, dan kuis untuk para santri.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Link to="/teacher/courses/new">
                      <Button size="sm">
                        <PlusCircle className="mr-1 h-3.5 w-3.5" /> Buat Kursus Pertama
                      </Button>
                    </Link>
                    <Link to="/courses">
                      <Button size="sm" variant="outline">Jelajahi Katalog</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {courses.map((c) => (
                    <li key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                      <Link
                        to={`/teacher/courses/${c.id}/gradebook`}
                        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl p-1.5 -m-1.5 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 border border-border">
                          {c.thumbnailUrl ? (
                            <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <BookOpen className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {c.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Klik untuk membuka Buku Nilai & Evaluasi peserta
                          </p>
                        </div>
                      </Link>

                      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                        <Link to={`/teacher/courses/${c.id}/students`}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                            <Users className="mr-1 h-3.5 w-3.5" /> Santri
                          </Button>
                        </Link>
                        <Link to={`/teacher/courses/${c.id}/edit`}>
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>
                        <Link to={`/teacher/courses/${c.id}/gradebook`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1 font-semibold">
                            <GraduationCap className="h-3.5 w-3.5 text-primary" /> Gradebook
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3): Announcements & Quick Teacher Shortcuts */}
        <div className="space-y-6">
          <AnnouncementWidget />

          <Card className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Pintasan Pengajar
            </h4>
            <div className="space-y-2">
              <Link
                to="/teacher/courses/new"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-xs font-semibold text-foreground group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <span>Buat Silabus Kursus Baru</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/courses"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-xs font-semibold text-foreground group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <span>Lihat Seluruh Kursus LMS</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
