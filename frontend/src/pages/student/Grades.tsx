import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Award, ClipboardCheck, FileText, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

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
        <p className="mt-1 text-sm text-muted-foreground">Rekap hasil kuis dan tugas dari semua kursus.</p>
      </div>

      {/* Kuis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary-600" /> Hasil Kuis
          </CardTitle>
        </CardHeader>
        <CardContent>
          {quizzes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada hasil kuis.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium sm:px-6">Kursus</th>
                    <th className="px-3 py-2 font-medium">Tanggal</th>
                    <th className="px-3 py-2 font-medium">Skor</th>
                    <th className="px-4 py-2 font-medium sm:px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quizzes.map((q) => (
                    <tr key={q.attemptId} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground sm:px-6">{q.courseTitle}</td>
                      <td className="px-3 py-3 text-muted-foreground">{fmtDate(q.submittedAt)}</td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-foreground">{Math.round(q.percentage)}%</span>
                        <span className="ml-1 text-xs text-muted-foreground">({q.score}/{q.maxScore})</span>
                      </td>
                      <td className="px-4 py-3 sm:px-6">
                        {q.isPassed ? (
                          <Badge variant="success">Lulus</Badge>
                        ) : (
                          <Badge variant="destructive">Tidak Lulus</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tugas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary-600" /> Nilai Tugas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada tugas yang dinilai.</p>
          ) : (
            <ul className="divide-y divide-border">
              {assignments.map((a) => (
                <li key={a.submissionId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{a.courseTitle}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Dikirim {fmtDate(a.submittedAt)}</p>
                    {a.feedback && (
                      <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">"{a.feedback}"</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-foreground">{a.score}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Ringkasan */}
      {quizzes.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50/50 p-4">
          <Award className="h-5 w-5 text-primary-600" />
          <p className="text-sm text-foreground">
            Rata-rata kuis: <span className="font-bold">{Math.round(quizzes.reduce((s, q) => s + q.percentage, 0) / quizzes.length)}%</span>
            {' '}dari {quizzes.length} kuis • {quizzes.filter((q) => q.isPassed).length} lulus
          </p>
        </div>
      )}

      <Link to="/student/courses" className="block text-sm text-primary-600 hover:underline">
        ← Kembali ke Kursus Saya
      </Link>
    </div>
  );
}
