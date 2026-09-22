import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ArrowRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/useToast';
import type { EnrollmentItem } from '@/types/api';

type Filter = 'all' | 'active' | 'completed';

export default function MyCourses() {
  const [filter, setFilter] = useState<Filter>('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ['enrollments', 'my'],
    queryFn: async () => {
      const { data } = await api.get<{ data: EnrollmentItem[] }>('/enrollments/my');
      return data.data;
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await api.delete(`/enrollments/courses/${courseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'my'] });
      toast('Pendaftaran kursus dibatalkan');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal membatalkan pendaftaran', 'error');
    },
  });

  const list = (enrollments ?? []).filter((e) => filter === 'all' || e.status === filter);

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'active', label: 'Sedang Dikerjakan' },
    { id: 'completed', label: 'Selesai' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Kursus Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daftar kursus yang sedang kamu ikuti.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-primary-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Belum ada kursus</p>
              <Link to="/courses" className="mt-4">
                <Button size="sm">Jelajahi Katalog</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <Link to={`/courses/${e.course.slug}`} className="flex min-w-0 flex-1 items-center gap-4 hover:bg-muted/40 rounded-md px-2 -mx-2 transition-colors">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-50">
                      {e.course.thumbnailUrl ? (
                        <img src={e.course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
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
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.status === 'completed' ? (
                      <Badge variant="success">Selesai</Badge>
                    ) : (
                      <Link to={`/courses/${e.course.slug}/learn`}>
                        <Button size="sm" variant="outline">
                          Lanjutkan <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Batalkan pendaftaran dari kursus "${e.course.title}"?`)) {
                          unenrollMutation.mutate(e.course.id);
                        }
                      }}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                      title="Batalkan pendaftaran"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {list.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {list.length} kursus • {list.filter((e) => e.status === 'completed').length} selesai
        </p>
      )}
    </div>
  );
}
