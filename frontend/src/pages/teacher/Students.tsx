import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Download, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

interface StudentRow {
  id: string;
  enrollmentId?: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  enrolledAt: string;
  progress: number;
  status: 'active' | 'suspended' | 'completed';
}

const statusLabel: Record<StudentRow['status'], string> = {
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  completed: 'Selesai',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TeacherStudents() {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentRow['status']>('all');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: async () => {
      const res = await api.get<{ data: StudentRow[] }>(`/courses/${courseId}/students`);
      return res.data;
    },
    enabled: !!courseId,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await api.patch<{ message: string; status: StudentRow['status'] }>(
        `/courses/${courseId}/students/${studentId}/status`
      );
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
      toast(res.message || 'Status berhasil diperbarui');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal mengubah status', 'error');
    },
  });

  const handleExportCsv = async () => {
    if (!courseId) return;
    try {
      setExporting(true);
      const res = await api.get(`/courses/${courseId}/students/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `students-${courseId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast('File CSV siswa berhasil diunduh');
    } catch {
      toast('Gagal mengunduh CSV siswa', 'error');
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.data ?? [];

  const filteredRows = rows.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const activeCount = rows.filter((s) => s.status === 'active').length;
  const completedCount = rows.filter((s) => s.status === 'completed').length;
  const suspendedCount = rows.filter((s) => s.status === 'suspended').length;

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Page Header */}
      <PageHeader
        title="Manajemen Siswa (Students)"
        subtitle="Daftar santri terdaftar dan pemantauan kemajuan belajar materi kursus."
        icon={Users}
        breadcrumbs={
          <Link to="/teacher" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dasbor Pengajar
          </Link>
        }
        actions={
          rows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold"
              loading={exporting}
              onClick={handleExportCsv}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )
        }
      />

      {/* Metric Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-primary">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Santri</span>
          <span className="text-2xl font-bold text-foreground">{rows.length}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Aktif Belajar</span>
          <span className="text-2xl font-bold text-emerald-600">{activeCount}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Tuntas / Selesai</span>
          <span className="text-2xl font-bold text-blue-600">{completedCount}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Ditangguhkan</span>
          <span className="text-2xl font-bold text-amber-600">{suspendedCount}</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      {rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari santri atau email..."
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10 w-full sm:w-auto"
            >
              <option value="all">Semua Status Siswa</option>
              <option value="active">Aktif</option>
              <option value="completed">Selesai</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-full">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Belum ada santri terdaftar pada kursus ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold">Nama Siswa / Santri</TableHead>
                  <TableHead className="font-semibold">Kemajuan Belajar</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Tanggal Terdaftar</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((s, idx) => (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground w-12 text-xs">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={s.progress} size="sm" className="max-w-[120px]" />
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {Math.round(s.progress)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === 'completed' ? 'success' : s.status === 'active' ? 'primary' : 'warning'}
                        className="text-xs font-semibold"
                      >
                        {statusLabel[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {fmtDate(s.enrolledAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={s.status === 'suspended' ? 'outline' : 'secondary'}
                        className="h-8 text-xs font-semibold"
                        loading={toggleStatusMutation.isPending}
                        onClick={() => toggleStatusMutation.mutate(s.id)}
                      >
                        {s.status === 'suspended' ? (
                          <>
                            <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Aktifkan
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="mr-1 h-3.5 w-3.5 text-amber-600" /> Tangguhkan
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
