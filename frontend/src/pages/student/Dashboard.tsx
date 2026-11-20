import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, Award, ArrowRight, GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
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
    { label: 'Kursus Terdaftar', value: list.length, icon: <BookOpen className="h-5 w-5" />, color: 'text-primary bg-primary/10 border-primary/20' },
    { label: 'Sedang Dikerjakan', value: inProgress.length, icon: <Clock className="h-5 w-5" />, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { label: 'Tuntas / Selesai', value: completed.length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Sertifikat Digital', value: certificates?.length ?? completed.length, icon: <Award className="h-5 w-5" />, color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner Card (SIDIQ Aesthetic) */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Portal Pembelajaran Santri</span>
              <Badge variant="outline" className="text-[10px] font-normal">Terkoneksi SIDIQ</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Ahlan wa Sahlan, {user?.name?.split(' ')[0] ?? 'Santri'} 👋
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Tingkatkan wawasan dan pemahaman materi agama serta akademik melalui platform E-Learning terpadu.
            </p>
          </div>
          <Link to="/courses" className="shrink-0">
            <Button className="font-semibold shadow-md">
              <BookOpen className="mr-2 h-4 w-4" />
              Jelajahi Kursus
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${s.color}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground leading-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Continue Learning Course List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Lanjutkan Pembelajaran</CardTitle>
            <CardDescription>Materi yang sedang aktif Anda pelajari saat ini</CardDescription>
          </div>
          <Link to="/courses" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Semua Kursus <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
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
                <Button size="sm">Jelajahi Katalog</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {list.map((e) => (
                <div key={e.id} className="py-3.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/courses/${e.course.slug}/learn`}
                    className="flex items-center gap-4 p-2.5 rounded-xl hover:bg-accent transition-colors"
                  >
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden border border-border">
                      {e.course.thumbnailUrl ? (
                        <img src={e.course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{e.course.title}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={e.progress} size="sm" className="max-w-xs" />
                        <span className="text-xs font-medium text-muted-foreground">{Math.round(e.progress)}%</span>
                      </div>
                    </div>
                    {e.status === 'completed' ? (
                      <Badge variant="success" className="shrink-0">Tuntas</Badge>
                    ) : (
                      <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
