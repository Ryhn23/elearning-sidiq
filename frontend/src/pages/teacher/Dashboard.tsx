import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Star, GraduationCap, ArrowRight, PlusCircle, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface MyCourseRow {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
}

export default function TeacherDashboard() {
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
    { label: 'Kursus Asuhan', value: courses.length, icon: <BookOpen className="h-5 w-5" />, color: 'text-primary bg-primary/10 border-primary/20' },
    { label: 'Total Santri Terdaftar', value: totalEnrolled, icon: <GraduationCap className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Rata-rata Penilaian', value: courseStats.length > 0 ? avgRating.toFixed(1) : '0', icon: <Star className="h-5 w-5" />, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Portal Asatidz & Pengajar</span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dasbor Pembimbing</h1>
            <p className="text-sm text-muted-foreground">Kelola silabus kursus, pantau kemajuan belajar santri, dan evaluasi buku nilai.</p>
          </div>
          <Link to="/teacher/courses/new">
            <Button className="font-semibold shadow-md">
              <PlusCircle className="mr-2 h-4 w-4" /> Buat Kursus Baru
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                <div className="space-y-2">
                  <div className="h-7 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </Card>
          ))
        ) : (
          stats.map((s) => (
            <Card key={s.label} className="p-4 border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kursus Saya</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Belum ada kursus</p>
              <div className="mt-4 flex gap-2">
                <Link to="/teacher/courses/new">
                  <Button size="sm"><PlusCircle className="mr-1 h-3.5 w-3.5" /> Buat Kursus Pertama</Button>
                </Link>
                <Link to="/courses">
                  <Button size="sm" variant="outline">Jelajahi Katalog</Button>
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Link to={`/teacher/courses/${c.id}/gradebook`} className="flex min-w-0 flex-1 items-center gap-4 rounded-md px-2 -mx-2 py-1 transition-colors hover:bg-muted/40">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-50">
                      {c.thumbnailUrl ? (
                        <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-primary-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Lihat gradebook & nilai peserta</p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link to={`/teacher/courses/${c.id}/students`} className="hidden sm:block">
                      <Button size="sm" variant="ghost">Student</Button>
                    </Link>
                    <Link to={`/teacher/courses/${c.id}/edit`} className="hidden sm:block">
                      <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    </Link>
                    <Link to={`/teacher/courses/${c.id}/gradebook`}>
                      <Button size="sm" variant="outline">
                        <GraduationCap className="h-3.5 w-3.5" /> Gradebook <ArrowRight className="h-3.5 w-3.5" />
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
  );
}
