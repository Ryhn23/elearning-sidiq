import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Clock, Award, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
    { label: 'Kursus Diikuti', value: list.length, icon: <BookOpen className="h-5 w-5" />, color: 'text-primary-600 bg-primary-50' },
    { label: 'Sedang Dikerjakan', value: inProgress.length, icon: <Clock className="h-5 w-5" />, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Selesai', value: completed.length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-green-600 bg-green-50' },
    { label: 'Sertifikat', value: certificates?.length ?? completed.length, icon: <Award className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">
          Halo, {user?.name?.split(' ')[0] ?? 'Mahasiswa'} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Lanjutkan perjalanan belajarmu.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-md ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Continue learning */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Lanjutkan Belajar</CardTitle>
          <Link to="/courses" className="text-sm text-primary-600 hover:underline">
            Lihat semua kursus →
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Belum ada kursus yang diikuti</p>
              <p className="mt-1 text-sm text-muted-foreground">Mulai dari katalog dan temukan topik favoritmu.</p>
              <Link to="/courses" className="mt-4">
                <Button size="sm">Jelajahi Kursus</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id}>
                  <Link to={`/courses/${e.course.slug}/learn`} className="flex items-center gap-4 py-3 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-primary-50">
                      {e.course.thumbnailUrl ? (
                        <img src={e.course.thumbnailUrl} alt="" className="h-full w-full rounded-md object-cover" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-primary-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{e.course.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Progress value={e.progress} size="sm" className="max-w-xs" />
                        <span className="text-xs text-muted-foreground">{Math.round(e.progress)}%</span>
                      </div>
                    </div>
                    {e.status === 'completed' ? (
                      <Badge variant="success">Selesai</Badge>
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
