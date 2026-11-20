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
import { cn } from '@/lib/utils';
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
    { id: 'all', label: 'Semua Kursus' },
    { id: 'active', label: 'Sedang Berjalan' },
    { id: 'completed', label: 'Selesai' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Kursus Saya</h1>
        <p className="mt-1 text-xs text-muted-foreground">Daftar kursus aktif dan progres pembelajaran yang sedang kamu ikuti.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
              filter === f.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted/70',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <BookOpen className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Belum ada kursus</p>
              <p className="mt-1 text-xs text-muted-foreground">Mulai belajar dengan mendaftar kursus di katalog sekarang.</p>
              <Link to="/courses" className="mt-5">
                <Button size="sm">Jelajahi Katalog</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <Link to={`/courses/${e.course.slug}`} className="flex min-w-0 flex-1 items-center gap-4 hover:bg-muted/40 rounded-xl p-2 -m-2 transition-colors">
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-50/50 dark:bg-primary-950/20">
                      {e.course.thumbnailUrl ? (
                        <img src={e.course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground hover:text-primary transition-colors">{e.course.title}</p>
                      <div className="mt-2 flex items-center gap-2.5">
                        <Progress value={e.progress} size="sm" className="max-w-xs" />
                        <span className="text-xs font-semibold tabular-nums text-primary">{Math.round(e.progress)}%</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.status === 'completed' ? (
                      <Badge variant="success">Selesai</Badge>
                    ) : (
                      <Link to={`/courses/${e.course.slug}/learn`}>
                        <Button size="sm" variant="outline" className="gap-1.5">
                          Lanjutkan <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Batalkan pendaftaran kursus "${e.course.title}"? Progress belajar akan hilang.`)) {
                          unenrollMutation.mutate(e.course.id);
                        }
                      }}
                      className="p-2 text-muted-foreground/60 hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10"
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
    </div>
  );
}
