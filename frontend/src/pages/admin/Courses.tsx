import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, CheckCircle2, Archive, Eye, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

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
      toast(vars.action === 'publish' ? 'Kursus berhasil dipublish' : 'Kursus diarsipkan');
    },
    onError: (err) => {
      const axErr = err as Error & { response?: { data?: { error?: string } } };
      toast(axErr.response?.data?.error ?? 'Gagal memperbarui kursus', 'error');
    },
  });

  const courses = data?.data ?? [];
  const totalCourses = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const countPublished = courses.filter((c) => c.status === 'published').length;
  const countPending = courses.filter((c) => c.status === 'pending_review').length;
  const countDraft = courses.filter((c) => c.status === 'draft' || c.status === 'archived').length;

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Page Header */}
      <PageHeader
        title="Manajemen Kursus"
        subtitle="Kelola seluruh katalog kursus, status publikasi silabus, dan moderasi konten."
        icon={BookOpen}
        actions={
          <Link to="/courses">
            <Button size="sm" variant="outline" className="gap-1.5 font-semibold">
              <Eye className="h-4 w-4" /> Lihat Katalog Publik
            </Button>
          </Link>
        }
      />

      {/* Metric Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-primary">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Kursus</span>
          <span className="text-2xl font-bold text-foreground">{totalCourses}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Terpublikasi</span>
          <span className="text-2xl font-bold text-emerald-600">{status === 'published' ? totalCourses : countPublished}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Menunggu Review</span>
          <span className="text-2xl font-bold text-amber-600">{status === 'pending_review' ? totalCourses : countPending}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Draft & Arsip</span>
          <span className="text-2xl font-bold text-blue-600">{countDraft}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari judul atau instruktur..."
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10 w-full sm:w-auto"
          >
            <option value="all">Semua Status (All)</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Menunggu Review</option>
            <option value="published">Published</option>
            <option value="archived">Diarsipkan</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-full">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Tidak ada data kursus yang cocok dengan pencarian.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold">Judul Kursus & Kategori</TableHead>
                  <TableHead className="font-semibold">Instruktur / Asatidz</TableHead>
                  <TableHead className="font-semibold text-center">Siswa</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Dibuat</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c, idx) => (
                  <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground w-12 text-xs">
                      {(page - 1) * 15 + idx + 1}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate font-semibold text-foreground text-sm">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.category?.name ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {c.instructor.name}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-foreground text-center">
                      {c.totalEnrolled}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status]} className="text-xs">
                        {statusLabel[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono">
                      {fmtDate(c.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === 'pending_review' && (
                          <Button
                            size="sm"
                            className="h-8 text-xs font-semibold"
                            loading={actionMutation.isPending}
                            onClick={() => actionMutation.mutate({ id: c.id, action: 'publish' })}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Setujui
                          </Button>
                        )}
                        {c.status === 'published' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold"
                            disabled={actionMutation.isPending}
                            onClick={() => actionMutation.mutate({ id: c.id, action: 'archive' })}
                          >
                            <Archive className="mr-1 h-3.5 w-3.5" /> Arsipkan
                          </Button>
                        )}
                        {c.status === 'published' && (
                          <Link
                            to={`/courses/${c.slug}`}
                            className="inline-flex h-8 items-center gap-1 px-2.5 text-xs font-semibold text-primary hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" /> Pratinjau
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Standard Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border p-4 gap-3 text-xs text-muted-foreground">
          <p>
            Menampilkan <span className="font-semibold text-foreground">{courses.length}</span> dari{' '}
            <span className="font-semibold text-foreground">{totalCourses}</span> kursus
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-semibold text-foreground px-2">
              Halaman {page} dari {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="text-xs"
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
