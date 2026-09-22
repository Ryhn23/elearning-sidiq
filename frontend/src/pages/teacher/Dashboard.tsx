import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Star, ClipboardList, GraduationCap, ArrowRight, PlusCircle, Pencil } from 'lucide-react';
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
  const stats = [
    { label: 'Kursus Dibuat', value: '—', icon: <BookOpen className="h-5 w-5" /> },
    { label: 'Total Peserta', value: '—', icon: <Star className="h-5 w-5" /> },
    { label: 'Rating Rata-rata', value: '—', icon: <ClipboardList className="h-5 w-5" /> },
  ];

  const { data: myCourses, isLoading } = useQuery({
    queryKey: ['my-courses'],
    queryFn: async () => {
      const res = await api.get<{ data: MyCourseRow[] }>('/courses/my');
      return res.data.data;
    },
  });

  const courses = myCourses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Dashboard Pengajar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola kursus dan peserta Anda.</p>
        </div>
        <Link to="/teacher/courses/new">
          <Button size="sm"><PlusCircle className="mr-1 h-4 w-4" /> Buat Kursus</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600">
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
