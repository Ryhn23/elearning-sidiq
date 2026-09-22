import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle2, Archive, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'pending_review' | 'published' | 'archived';
  price: number;
  totalEnrolled: number;
  createdAt: string;
  instructor: { id: string; name: string };
  category: { id: string; name: string } | null;
}

const statusLabel: Record<CourseRow['status'], string> = {
  draft: 'Draft',
  pending_review: 'Menunggu Review',
  published: 'Published',
  archived: 'Diarsipkan',
};

const statusVariant: Record<CourseRow['status'], 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  draft: 'default',
  pending_review: 'warning',
  published: 'success',
  archived: 'outline',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminCourses() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | CourseRow['status']>('all');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-courses', search, status, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      const res = await api.get<{ data: CourseRow[]; pagination: { total: number; totalPages: number } }>(`/courses/admin/all?${params}`);
      return res.data;
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'publish' | 'archive' }) => {
      await api.patch(`/courses/${id}/${action}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-courses'] });
      toast(vars.action === 'publish' ? 'Kursus berhasil dipublish' : 'Kursu diarsipkan');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal memperbarui kursus', 'error');
    },
  });

  const courses = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Manajemen Kursus</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola semua kursus dan approval konten.</p>
      </div>

      {/* Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari judul atau instruktur..."
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
        >
          <option value="all">Semua Status</option>
          <option value="draft">Draft</option>
          <option value="pending_review">Menunggu Review</option>
          <option value="published">Published</option>
          <option value="archived">Diarsipkan</option>
        </select>
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : courses.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada kursus yang cocok.</p>
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto sm:-mx-6">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 font-medium sm:px-6">Kursus</th>
                      <th className="px-3 py-2 font-medium">Instruktur</th>
                      <th className="px-3 py-2 font-medium">Student</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Dibuat</th>
                      <th className="px-4 py-2 text-right font-medium sm:px-6">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {courses.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="max-w-[280px] px-4 py-3 sm:px-6">
                          <p className="truncate font-medium text-foreground">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.category?.name ?? '—'}</p>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{c.instructor.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{c.totalEnrolled}</td>
                        <td className="px-3 py-3">
                          <Badge variant={statusVariant[c.status]}>{statusLabel[c.status]}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{fmtDate(c.createdAt)}</td>
                        <td className="px-4 py-3 text-right sm:px-6">
                          <div className="flex items-center justify-end gap-2">
                            {c.status === 'pending_review' && (
                              <Button
                                size="sm"
                                loading={actionMutation.isPending}
                                onClick={() => actionMutation.mutate({ id: c.id, action: 'publish' })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </Button>
                            )}
                            {c.status === 'published' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionMutation.isPending}
                                onClick={() => actionMutation.mutate({ id: c.id, action: 'archive' })}
                              >
                                <Archive className="h-3.5 w-3.5" /> Arsipkan
                              </Button>
                            )}
                            {c.status === 'published' && (
                              <Link to={`/courses/${c.slug}`} className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-primary-600 hover:text-primary-700">
                                <Eye className="h-3.5 w-3.5" /> Lihat
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">{data?.pagination.total ?? 0} kursus</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => p - 1)}>Sebelumnya</Button>
                  <span className="self-center text-xs text-muted-foreground">{page}/{totalPages}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Berikutnya</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
