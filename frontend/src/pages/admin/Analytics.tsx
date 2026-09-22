import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, BookOpen, GraduationCap, CheckCircle2, UserPlus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

interface OverviewData {
  totals: { users: number; teachers: number; publishedCourses: number; enrollments: number; completedEnrollments: number };
  thisMonth: { newUsers: number; newEnrollments: number };
  topCourses: { id: string; title: string; slug: string; totalEnrolled: number }[];
  recentEnrollments: { userId: string; courseTitle: string; enrolledAt: string }[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
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
    return <div className="space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const d = data;
  const completionRate = d && d.totals.enrollments > 0 ? Math.round((d.totals.completedEnrollments / d.totals.enrollments) * 100) : 0;

  const stats = [
    { label: 'Total User', value: d?.totals.users ?? 0, icon: <Users className="h-5 w-5" />, color: 'text-primary-600 bg-primary-50' },
    { label: 'Pengajar', value: d?.totals.teachers ?? 0, icon: <GraduationCap className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50' },
    { label: 'Kursus Terbit', value: d?.totals.publishedCourses ?? 0, icon: <BookOpen className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Enrollment', value: d?.totals.enrollments ?? 0, icon: <TrendingUp className="h-5 w-5" />, color: 'text-green-600 bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Analitik Platform</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan performa platform e-learning.</p>
      </div>

      {/* Stats utama */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-md ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Bulan ini + completion */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><UserPlus className="h-4 w-4 text-primary-600" /> Bulan Ini</h3>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-bold text-foreground">{d?.thisMonth.newUsers ?? 0}</p>
              <p className="text-xs text-muted-foreground">User baru</p>
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{d?.thisMonth.newEnrollments ?? 0}</p>
              <p className="text-xs text-muted-foreground">Enrollment baru</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" /> Tingkat Penyelesaian</h3>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-bold text-foreground">{completionRate}%</p>
            <p className="pb-1 text-xs text-muted-foreground">
              {d?.totals.completedEnrollments ?? 0} dari {d?.totals.enrollments ?? 0} enrollment selesai
            </p>
          </div>
        </Card>
      </div>

      {/* Top kursus */}
      <Card>
        <CardHeader><CardTitle>Kursus Terpopuler</CardTitle></CardHeader>
        <CardContent>
          {(d?.topCourses.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d!.topCourses.map((c, i) => (
                <li key={c.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-xs font-bold text-primary-700">{i + 1}</span>
                  <Link to={`/courses/${c.slug}`} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:text-primary-600 hover:underline">
                    {c.title}
                  </Link>
                  <Badge variant="primary">{c.totalEnrolled} peserta</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Aktivitas terbaru */}
      <Card>
        <CardHeader><CardTitle>Aktivitas Terbaru</CardTitle></CardHeader>
        <CardContent>
          {(d?.recentEnrollments.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d!.recentEnrollments.map((e, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {e.userId.charAt(0).toUpperCase()}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-foreground">
                    <span className="font-medium">{e.userId}</span> mendaftar ke <span className="font-medium">{e.courseTitle}</span>
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.enrolledAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
