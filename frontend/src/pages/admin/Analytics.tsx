import { useQuery } from '@tanstack/react-query';
import { Users, BookOpen, GraduationCap, CheckCircle2, UserPlus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface OverviewData {
  totals: { users: number; teachers: number; publishedCourses: number; enrollments: number; completedEnrollments: number };
  thisMonth: { newUsers: number; newEnrollments: number };
  topCourses: { id: string; title: string; slug: string; totalEnrolled: number }[];
  recentEnrollments: { userId: string; courseTitle: string; enrolledAt: string }[];
}

export default function AdminAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await api.get<OverviewData>('/analytics/overview');
      return res.data;
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>;
  }

  const d = data;
  const completionRate = d && d.totals.enrollments > 0 ? Math.round((d.totals.completedEnrollments / d.totals.enrollments) * 100) : 0;

  const stats = [
    { label: 'Total Pengguna', value: d?.totals.users ?? 0, icon: <Users className="h-5 w-5" />, color: 'text-primary bg-primary/10' },
    { label: 'Ustadz / Pengajar', value: d?.totals.teachers ?? 0, icon: <GraduationCap className="h-5 w-5" />, color: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { label: 'Kursus Terbit', value: d?.totals.publishedCourses ?? 0, icon: <BookOpen className="h-5 w-5" />, color: 'text-teal-700 bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300' },
    { label: 'Total Enrollment', value: d?.totals.enrollments ?? 0, icon: <TrendingUp className="h-5 w-5" />, color: 'text-primary bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Analitik Platform</h1>
        <p className="mt-1 text-xs text-muted-foreground">Ringkasan performa dan metrik keterlibatan platform e-learning.</p>
      </div>

      {/* Stats utama */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 rounded-xl">
            <div className="flex items-center gap-3.5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bulan ini + completion */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 rounded-xl">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <UserPlus className="h-4 w-4" /> Pertumbuhan Bulan Ini
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-extrabold text-foreground">{d?.thisMonth.newUsers ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pengguna baru</p>
            </div>
            <div>
              <p className="text-2xl font-extrabold text-foreground">{d?.thisMonth.newEnrollments ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pendaftaran baru</p>
            </div>
          </div>
        </Card>
        <Card className="p-5 rounded-xl">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <CheckCircle2 className="h-4 w-4" /> Tingkat Penyelesaian Materi
          </h3>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-3xl font-extrabold text-primary">{completionRate}%</p>
            <p className="pb-1 text-xs text-muted-foreground">
              {d?.totals.completedEnrollments ?? 0} dari {d?.totals.enrollments ?? 0} enrollment telah lulus 100%
            </p>
          </div>
        </Card>
      </div>

      {/* Top kursus */}
      <Card className="rounded-xl overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="text-sm font-semibold">Kursus Terpopuler</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {(d?.topCourses.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Belum ada data kursus.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d!.topCourses.map((c, i) => (
                <li key={c.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.totalEnrolled} siswa terdaftar</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
