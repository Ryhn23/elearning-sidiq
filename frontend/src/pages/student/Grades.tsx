import { useQuery } from '@tanstack/react-query';
import { Star, FileText, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { PageHeader } from '@/components/layout/PageHeader';

interface QuizGradeRow {
  attemptId: string;
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  submittedAt: string;
  courseTitle: string;
  courseSlug: string;
}

interface AssignmentGradeRow {
  submissionId: string;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  courseTitle: string;
  courseSlug: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Grades() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-grades'],
    queryFn: async () => {
      const res = await api.get<{ quizzes: QuizGradeRow[]; assignments: AssignmentGradeRow[] }>('/enrollments/my/grades');
      return res.data;
    },
  });

  const quizzes = data?.quizzes ?? [];
  const assignments = data?.assignments ?? [];

  const totalQuizzes = quizzes.length;
  const passedQuizzes = quizzes.filter((q) => q.isPassed).length;
  const totalAssignments = assignments.length;
  const gradedAssignments = assignments.filter((a) => a.score !== null).length;

  return (
    <div className="space-y-6 w-full pb-8">
      {/* Standard Page Header */}
      <PageHeader
        title="Nilai & Capaian Belajar"
        subtitle="Rekapitulasi capaian kuis dan penilaian tugas mandiri seluruh kursus Anda di SIDIQ LMS."
        icon={Star}
        breadcrumbs={
          <Link to="/student" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dasbor Santri
          </Link>
        }
      />

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-primary">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Kuis Diikuti</span>
          <span className="text-2xl font-bold text-foreground">{totalQuizzes}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-emerald-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Kuis Lulus</span>
          <span className="text-2xl font-bold text-emerald-600">{passedQuizzes}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-blue-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Tugas Terkumpul</span>
          <span className="text-2xl font-bold text-blue-600">{totalAssignments}</span>
        </div>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1 border-l-4 border-l-amber-500">
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">Tugas Dinilai</span>
          <span className="text-2xl font-bold text-amber-600">{gradedAssignments}</span>
        </div>
      </div>

      {/* Kuis Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> Hasil Evaluasi Kuis
          </h3>
        </div>
        <div className="overflow-x-auto max-w-[calc(100vw-2rem)] md:max-w-full">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Belum ada hasil kuis yang tercatat.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Mata Pelajaran / Kursus</TableHead>
                  <TableHead className="font-semibold">Tanggal Ujian</TableHead>
                  <TableHead className="font-semibold">Perolehan Skor</TableHead>
                  <TableHead className="font-semibold">Status Kelulusan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((q) => (
                  <TableRow key={q.attemptId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-foreground text-sm">{q.courseTitle}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{fmtDate(q.submittedAt)}</TableCell>
                    <TableCell>
                      <span className="font-bold text-foreground">{Math.round(q.percentage)}%</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">({q.score}/{q.maxScore})</span>
                    </TableCell>
                    <TableCell>
                      {q.isPassed ? (
                        <Badge variant="success" className="text-xs">Lulus</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Tidak Lulus</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Tugas List */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/40">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Nilai & Evaluasi Tugas Mandiri
          </h3>
        </div>
        <div className="p-4 sm:p-6">
          {assignments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Belum ada tugas yang dinilai oleh ustadz pengajar.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {assignments.map((a) => (
                <li key={a.submissionId} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground text-sm">{a.courseTitle}</p>
                      {a.score !== null ? (
                        <Badge variant="success" className="text-xs font-bold">{a.score} / 100</Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">Menunggu Penilaian</Badge>
                      )}
                    </div>
                    {a.feedback && (
                      <p className="mt-1 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40">
                        <span className="font-semibold text-foreground">Catatan Pengajar:</span> {a.feedback}
                      </p>
                    )}
                    <span className="mt-1 block text-[11px] text-muted-foreground font-mono">
                      Diserahkan: {fmtDate(a.submittedAt)}
                    </span>
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
