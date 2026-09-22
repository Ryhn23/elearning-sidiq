import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap, Download, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

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
  if (g >= 80) return 'text-green-600';
  if (g >= 60) return 'text-yellow-600';
  return 'text-red-500';
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
          <Link to="/teacher" className="mb-2 inline-flex items-center gap-1 text-sm text-primary-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Gradebook</h1>
          <p className="mt-1 text-sm text-muted-foreground">Rekap nilai dan grade kelulusan seluruh peserta kursus.</p>
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa atau email..."
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary-500"
          >
            <option value="all">Semua Status Kelulusan</option>
            <option value="passed">Lulus (Nilai ≥ 60)</option>
            <option value="failed">Belum Lulus (Nilai &lt; 60)</option>
          </select>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center p-10 text-center">
          <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Belum ada peserta</p>
          <p className="mt-1 text-sm text-muted-foreground">Nilai akan muncul setelah ada student yang enrolled.</p>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {filteredRows.length} dari {rows.length} Peserta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="-mx-4 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium sm:px-6">Student</th>
                    <th className="px-3 py-2 font-medium">Progress</th>
                    <th className="px-3 py-2 font-medium">Kuis (%)</th>
                    <th className="px-3 py-2 font-medium">Tugas</th>
                    <th className="px-4 py-2 font-medium sm:px-6">Nilai Akhir</th>
                    <th className="px-4 py-2 text-center font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((r) => (
                    <tr key={r.userId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 sm:px-6">
                        <p className="font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round(r.progress)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{Math.round(r.progress)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.quizAvg !== null ? (
                          <span className={`font-semibold ${gradeColor(r.quizAvg)}`}>{r.quizAvg}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">— ({r.quizCount} kuis)</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.assignmentAvg !== null ? (
                          <span className={`font-semibold ${gradeColor(r.assignmentAvg)}`}>{r.assignmentAvg}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">— ({r.assignmentCount} tugas)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        {r.finalGrade !== null ? (
                          <Badge variant={r.finalGrade >= 80 ? 'success' : r.finalGrade >= 60 ? 'warning' : 'destructive'}>
                            {r.finalGrade}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Belum ada nilai</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                          {getLetterGrade(r.finalGrade)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
