import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, CheckCircle2, Clock, Award, ArrowRight, GraduationCap,
  Sparkles, FileText, Compass
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { AnnouncementWidget } from '@/components/shared/AnnouncementWidget';
import type { EnrollmentItem } from '@/types/api';

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'my'],
    queryFn: async () => {
      const { data } = await api.get<{ data: EnrollmentItem[] }>('/enrollments/my');
      return data.data;
    },
  });

  const { data: certificates } = useQuery({
    queryKey: ['my-certificates'],
    queryFn: async () => {
      const res = await api.get<{ certificates: unknown[] }>('/certificates/my');
      return res.data.certificates;
    },
  });

  const list = enrollments ?? [];
  const inProgress = list.filter((e) => e.status === 'active');
  const completed = list.filter((e) => e.status === 'completed');

  const stats = [
    {
      label: 'Kursus Terdaftar',
      value: list.length,
      icon: <BookOpen className="h-5 w-5" />,
      color: 'text-primary bg-primary/10 border-primary/20',
      sublabel: 'Total materi diikuti',
    },
    {
      label: 'Sedang Dikerjakan',
      value: inProgress.length,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      sublabel: 'Perlu diselesaikan',
    },
    {
      label: 'Tuntas / Lulus',
      value: completed.length,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      sublabel: 'Memenuhi syarat evaluasi',
    },
    {
      label: 'Sertifikat Digital',
      value: certificates?.length ?? completed.length,
      icon: <Award className="h-5 w-5" />,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      sublabel: 'Siap diunduh & diverifikasi',
    },
  ];

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Header Banner - Elegant Emerald Style (SIDIQ ERP Standard) */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        {/* Subtle Decorative Ambient Lighting */}
        <div className="absolute -right-8 -bottom-8 w-56 h-56 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 w-48 h-48 bg-white/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider opacity-90 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" /> Portal Pembelajaran Santri
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                Ahlan wa Sahlan, {user?.name ?? 'Santri SIDIQ'}
              </h2>
              <div className="text-xs opacity-90 font-mono mt-1 flex flex-wrap items-center gap-2">
                <span>{user?.email ?? 'santri@sidiq.id'}</span>
                <span>•</span>
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium text-emerald-100">
                  Tersinkronisasi SIDIQ
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Link to="/courses">
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md shadow-sm font-semibold transition-all hover:scale-105"
              >
                <Compass className="mr-2 h-4 w-4" />
                Jelajahi Katalog Kursus
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards 4-Column Grid */}
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

      {/* Asymmetric Content Area (2/3 Primary + 1/3 Side Widgets) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3): Active Courses & Learning Progress */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Lanjutkan Pembelajaran
                </CardTitle>
                <CardDescription className="text-xs">Materi yang sedang aktif Anda pelajari saat ini</CardDescription>
              </div>
              <Link to="/courses" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Katalog Lengkap <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Belum ada kursus yang Anda ikuti</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                    Buka katalog kursus untuk memilih mata pelajaran atau materi bimbingan yang ingin Anda pelajari.
                  </p>
                  <Link to="/courses" className="mt-4">
                    <Button size="sm">Jelajahi Katalog Kursus</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {list.map((e) => (
                    <div key={e.id} className="py-3.5 first:pt-0 last:pb-0">
                      <Link
                        to={`/courses/${e.course.slug}/learn`}
                        className="flex items-center gap-4 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden border border-border">
                          {e.course.thumbnailUrl ? (
                            <img src={e.course.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <BookOpen className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {e.course.title}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <Progress value={e.progress} size="sm" className="max-w-xs flex-1" />
                            <span className="text-xs font-semibold text-muted-foreground">{Math.round(e.progress)}%</span>
                          </div>
                        </div>
                        {e.status === 'completed' ? (
                          <Badge variant="success" className="shrink-0 text-xs">Tuntas</Badge>
                        ) : (
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3): Announcements & Learning Shortcuts */}
        <div className="space-y-6">
          {/* Announcement Widget */}
          <AnnouncementWidget />

          {/* Quick Learning Shortcuts Card */}
          <Card className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Pintasan Belajar
            </h4>
            <div className="space-y-2">
              <Link
                to="/courses"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-xs font-semibold text-foreground group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Compass className="h-4 w-4" />
                  </div>
                  <span>Jelajahi Katalog Kursus</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/student/grades"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-xs font-semibold text-foreground group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span>Buku Nilai & Evaluasi</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/student/certificates"
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-xs font-semibold text-foreground group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                    <Award className="h-4 w-4" />
                  </div>
                  <span>Sertifikat Digital Saya</span>
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
