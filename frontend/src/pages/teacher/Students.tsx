import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Users, Download, Search, ShieldCheck, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/useToast';

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
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/teacher" className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Manajemen Siswa (Students)</h1>
          <p className="mt-1 text-xs text-muted-foreground">Daftar siswa terdaftar dan pantau kemajuan belajar kursus.</p>
        </div>

        {rows.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="self-start sm:self-auto gap-1.5"
            loading={exporting}
            onClick={handleExportCsv}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      {rows.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email siswa..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="completed">Selesai</option>
            <option value="suspended">Ditangguhkan</option>
          </select>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center p-12 text-center rounded-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
            <Users className="h-7 w-7" />
          </div>
          <p className="text-base font-semibold text-foreground">Belum ada peserta</p>
          <p className="mt-1 text-xs text-muted-foreground">Siswa akan otomatis muncul setelah mendaftar ke kursus ini.</p>
        </Card>
      ) : (
        <Card className="rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <Table className="border-0 rounded-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Siswa</TableHead>
                  <TableHead>Terdaftar</TableHead>
                  <TableHead className="w-1/3">Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="cursor-pointer" onClick={() => setSelectedStudent(s)}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {s.avatarUrl ? (
                            <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            s.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground hover:text-primary transition-colors">{s.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(s.enrolledAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={s.progress} size="sm" className="max-w-[140px]" />
                        <span className="text-xs tabular-nums text-muted-foreground font-medium">{Math.round(s.progress)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'completed' ? 'success' : s.status === 'suspended' ? 'destructive' : 'primary'}>
                        {statusLabel[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {s.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant={s.status === 'suspended' ? 'outline' : 'ghost'}
                          loading={toggleStatusMutation.isPending && toggleStatusMutation.variables === s.id}
                          onClick={() => toggleStatusMutation.mutate(s.id)}
                          title={s.status === 'suspended' ? 'Aktifkan kembali siswa' : 'Tangguhkan akses siswa'}
                        >
                          {s.status === 'suspended' ? (
                            <span className="flex items-center gap-1 text-primary">
                              <ShieldCheck className="h-3.5 w-3.5" /> Aktifkan
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600">
                              <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                            </span>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border p-4">
              <p className="text-xs text-muted-foreground">
                Menampilkan {filteredRows.length} dari {rows.length} siswa
              </p>
              <Link to={`/teacher/courses/${courseId}/gradebook`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> Ke Buku Nilai (Gradebook)
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Detail Student using Radix Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        {selectedStudent && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Detail Siswa</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                {selectedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{selectedStudent.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tanggal Mendaftar:</span>
                <span className="font-semibold text-foreground">{fmtDate(selectedStudent.enrolledAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Progress Kursus:</span>
                <div className="flex items-center gap-2">
                  <Progress value={selectedStudent.progress} size="sm" className="w-20" />
                  <span className="font-bold text-foreground">{Math.round(selectedStudent.progress)}%</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status Akses:</span>
                <Badge variant={selectedStudent.status === 'completed' ? 'success' : selectedStudent.status === 'suspended' ? 'destructive' : 'primary'}>
                  {statusLabel[selectedStudent.status]}
                </Badge>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedStudent(null)}>
                Tutup
              </Button>
              {selectedStudent.status !== 'completed' && (
                <Button
                  size="sm"
                  variant={selectedStudent.status === 'suspended' ? 'primary' : 'destructive'}
                  loading={toggleStatusMutation.isPending}
                  onClick={async () => {
                    await toggleStatusMutation.mutateAsync(selectedStudent.id);
                    setSelectedStudent((prev) =>
                      prev ? { ...prev, status: prev.status === 'suspended' ? 'active' : 'suspended' } : null
                    );
                  }}
                >
                  {selectedStudent.status === 'suspended' ? 'Aktifkan Siswa' : 'Suspend Akses'}
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
