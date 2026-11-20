import { useQuery } from '@tanstack/react-query';
import { Star, FileText, ClipboardCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';

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

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Nilai Saya</h1>
        <p className="mt-1 text-xs text-muted-foreground">Rekapitulasi capaian kuis dan penilaian tugas mandiri seluruh kursus.</p>
      </div>

      {/* Kuis Table */}
      <Card className="rounded-xl overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Star className="h-4 w-4 text-primary" /> Hasil Kuis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quizzes.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Belum ada hasil kuis yang tercatat.</p>
          ) : (
            <Table className="border-0 rounded-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Kursus</TableHead>
                  <TableHead>Tanggal Selesai</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((q) => (
                  <TableRow key={q.attemptId}>
                    <TableCell className="font-semibold text-foreground">{q.courseTitle}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(q.submittedAt)}</TableCell>
                    <TableCell>
                      <span className="font-bold text-foreground">{Math.round(q.percentage)}%</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">({q.score}/{q.maxScore})</span>
                    </TableCell>
                    <TableCell>
                      {q.isPassed ? (
                        <Badge variant="success">Lulus</Badge>
                      ) : (
                        <Badge variant="destructive">Tidak Lulus</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tugas List */}
      <Card className="rounded-xl overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <FileText className="h-4 w-4 text-primary" /> Nilai & Feedback Tugas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {assignments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Belum ada tugas yang dinilai oleh pengajar.</p>
          ) : (
            <ul className="divide-y divide-border">
              {assignments.map((a) => (
                <li key={a.submissionId} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground text-sm">{a.courseTitle}</p>
                      <span className="text-xs text-muted-foreground">{fmtDate(a.submittedAt)}</span>
                    </div>
                    {a.score !== null ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Nilai:</span>
                        <Badge variant={a.score >= 80 ? 'success' : a.score >= 60 ? 'warning' : 'destructive'}>
                          {a.score}
                        </Badge>
                      </div>
                    ) : (
                      <span className="mt-1 inline-block text-xs text-muted-foreground">Sedang dinilai</span>
                    )}
                    {a.feedback && (
                      <p className="mt-2 rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground italic">
                        "{a.feedback}"
                      </p>
                    )}
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
