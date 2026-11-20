import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ArrowRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';
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
    { id: 'completed', label: 'Tuntas / Selesai' },
  ];

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Standard Page Header */}
      <PageHeader
        title="Kursus Saya"
        subtitle="Daftar silabus aktif dan pemantauan progres ketuntasan belajar Anda di SIDIQ LMS."
        icon={BookOpen}
        actions={
          <Link to="/courses">
            <Button size="sm" className="gap-1.5 font-semibold">
              <BookOpen className="h-4 w-4" /> Jelajahi Katalog
            </Button>
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-semibold transition-all',
              filter === f.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'border border-border bg-card text-muted-foreground hover:bg-muted/70',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <BookOpen className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Belum ada kursus pada filter ini</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Mulai belajar dengan memilih materi kursus dari katalog resmi pesantren.
              </p>
              <Link to="/courses" className="mt-5">
                <Button size="sm">Jelajahi Katalog Kursus</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {list.map((e) => (
                <li key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <Link
                    to={`/courses/${e.course.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-4 hover:bg-muted/40 rounded-xl p-2 -m-2 transition-colors group"
                  >
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 border border-border">
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
                        <span className="text-xs font-semibold tabular-nums text-primary">{Math.round(e.progress)}%</span>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {e.status === 'completed' ? (
                      <Badge variant="success" className="text-xs">Tuntas</Badge>
                    ) : (
                      <Link to={`/courses/${e.course.slug}/learn`}>
                        <Button size="sm" variant="outline" className="gap-1.5 font-semibold">
                          Lanjutkan Belajar <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Batalkan Pendaftaran"
                      loading={unenrollMutation.isPending}
                      onClick={() => {
                        if (confirm(`Yakin ingin membatalkan pendaftaran kursus "${e.course.title}"?`)) {
                          unenrollMutation.mutate(e.course.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
