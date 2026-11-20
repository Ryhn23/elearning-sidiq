import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Download, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { useToast } from '@/components/ui/useToast';
import { PageHeader } from '@/components/layout/PageHeader';

interface GradebookRow {
  userId: string;
  name: string;
  email: string;
  progress: number;
  status: 'active' | 'completed';
  quizCount: number;
  assignmentCount: number;
  quizAvg: number | null;
  assignmentAvg: number | null;
  finalGrade: number | null;
}

function gradeColor(g: number) {
  if (g >= 80) return 'text-primary font-bold';
  if (g >= 60) return 'text-amber-600 font-semibold';
  return 'text-destructive font-semibold';
}

function getLetterGrade(score: number | null): string {
  if (score === null) return '-';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export default function Gradebook() {
  const { courseId } = useParams<{ courseId: string }>();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['gradebook', courseId],
    queryFn: async () => {
      const res = await api.get<{ data: GradebookRow[] }>(`/courses/${courseId}/gradebook`);
      return res.data;
    },
    enabled: !!courseId,
  });

  const rows = data?.data ?? [];

  const handleExportCsv = async () => {
    if (!courseId) return;
    try {
      setExporting(true);
      const res = await api.get(`/courses/${courseId}/gradebook/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gradebook-${courseId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast('File CSV gradebook berhasil diunduh');
    } catch {
      toast('Gagal mengunduh CSV gradebook', 'error');
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    if (statusFilter === 'passed') return r.finalGrade !== null && r.finalGrade >= 60;
    if (statusFilter === 'failed') return r.finalGrade !== null && r.finalGrade < 60;
    return true;
  });

  // Calculate statistics
  const totalStudents = rows.length;
  const gradedRows = rows.filter((r) => r.finalGrade !== null);
  const classAvg = gradedRows.length > 0 ? Math.round(gradedRows.reduce((acc, r) => acc + (r.finalGrade ?? 0), 0) / gradedRows.length) : 0;
  const passedStudents = rows.filter((r) => r.finalGrade !== null && r.finalGrade >= 60).length;
  const failedStudents = rows.filter((r) => r.finalGrade !== null && r.finalGrade < 60).length;

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Page Header */}
      <PageHeader
        title="Buku Nilai (Gradebook)"
        subtitle="Rekap nilai kuis, tugas, dan grade kelulusan seluruh santri / siswa pada kursus ini."
        icon={GraduationCap}
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
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Peserta</span>
          <span className="text-2xl font-bold text-foreground">{totalStudents}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Rata-rata Kelas</span>
          <span className="text-2xl font-bold text-blue-600">{classAvg}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Lulus (≥ 60)</span>
          <span className="text-2xl font-bold text-emerald-600">{passedStudents}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Perlu Remidi (&lt; 60)</span>
          <span className="text-2xl font-bold text-amber-600">{failedStudents}</span>
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
              placeholder="Cari siswa atau email..."
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary transition-colors h-10 w-full sm:w-auto"
            >
              <option value="all">Semua Status Kelulusan</option>
              <option value="passed">Lulus (Nilai ≥ 60)</option>
              <option value="failed">Belum Lulus (Nilai &lt; 60)</option>
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
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <GraduationCap className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Belum ada peserta terdaftar</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Nilai akan otomatis terisi setelah santri menyelesaikan materi kuis atau tugas di kursus ini.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 text-center font-semibold">No.</TableHead>
                  <TableHead className="font-semibold">Nama Siswa / Santri</TableHead>
                  <TableHead className="font-semibold">Progress Belajar</TableHead>
                  <TableHead className="font-semibold text-center">Rata-rata Kuis</TableHead>
                  <TableHead className="font-semibold text-center">Rata-rata Tugas</TableHead>
                  <TableHead className="font-semibold text-center">Nilai Akhir</TableHead>
                  <TableHead className="text-center font-semibold">Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r, idx) => (
                  <TableRow key={r.userId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-medium text-muted-foreground w-12 text-xs">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(r.progress)}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {Math.round(r.progress)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {r.quizAvg !== null ? (
                        <span className={gradeColor(r.quizAvg)}>{r.quizAvg}%</span>
                      ) : (
                        <span className="text-muted-foreground">— ({r.quizCount} kuis)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {r.assignmentAvg !== null ? (
                        <span className={gradeColor(r.assignmentAvg)}>{r.assignmentAvg}</span>
                      ) : (
                        <span className="text-muted-foreground">— ({r.assignmentCount} tugas)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.finalGrade !== null ? (
                        <Badge
                          variant={r.finalGrade >= 80 ? 'success' : r.finalGrade >= 60 ? 'warning' : 'destructive'}
                          className="font-bold text-xs px-2.5 py-0.5"
                        >
                          {r.finalGrade}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-foreground">
                        {getLetterGrade(r.finalGrade)}
                      </span>
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
