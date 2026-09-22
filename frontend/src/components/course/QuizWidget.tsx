import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, ListChecks, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import { cn, formatRelative } from '@/lib/utils';

interface QuizMeta {
  id: string;
  timeLimitMin: number | null;
  maxAttempts: number;
  passingScore: number;
  showResultImmediately: boolean;
  questionCount?: number;
  totalPoints?: number;
}

interface Question {
  id: string;
  type: 'multiple_choice' | 'multiple_answer' | 'true_false' | 'short_answer' | 'essay';
  questionText: string;
  imageUrl: string | null;
  points: number;
  options: { id: string; optionText: string }[];
}

interface StartResult {
  attemptId: string;
  attemptNumber: number;
  timeLimitMin: number | null;
  startedAt: string;
  questions: Question[];
}

interface AnswerReview {
  questionId: string;
  questionText: string | null;
  type: string;
  explanation: string | null;
  options: { id: string; optionText: string; isCorrect: boolean }[];
  selectedOptionIds: string[];
  textAnswer: string | null;
  isCorrect: boolean | null;
  pointsEarned: number;
}

interface QuizResult {
  attempt: { id: string; percentage: number; score: number; maxScore: number };
  score: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  passingScore: number;
  answers: AnswerReview[];
}

interface AttemptRow {
  id: string;
  attemptNumber: number;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  isPassed: boolean | null;
  submittedAt: string | null;
}

type Phase = 'intro' | 'active' | 'result';

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function QuizWidget({ quiz }: { quiz: QuizMeta }) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('intro');
  const [attempt, setAttempt] = useState<StartResult | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedOptionIds: string[]; textAnswer?: string }>>({});
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);

  // ============================================================
  // INTRO — riwayat attempt
  // ============================================================
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['quiz-attempts', quiz.id],
    queryFn: async () => {
      const { data } = await api.get<{ attempts: AttemptRow[] }>(`/quizzes/${quiz.id}/my-attempts`);
      return data;
    },
  });

  // ============================================================
  // START / SUBMIT
  // ============================================================
  const startMutation = useMutation({
    mutationFn: () => api.post<StartResult>(`/quizzes/${quiz.id}/start`),
    onSuccess: (res) => {
      setAttempt(res.data);
      setAnswers({});
      setCurrentIndex(0);
      setTimeLeftSec(res.data.timeLimitMin ? res.data.timeLimitMin * 60 : null);
      setPhase('active');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.error ?? 'Gagal memulai kuis', 'error');
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const payloadAnswers = attempt!.questions.map((q) => ({
        questionId: q.id,
        selectedOptionIds: answers[q.id]?.selectedOptionIds ?? [],
        textAnswer: answers[q.id]?.textAnswer,
      }));
      return api.post<QuizResult>(`/quizzes/attempts/${attempt!.attemptId}/submit`, { answers: payloadAnswers });
    },
    onSuccess: (res) => {
      setResult(res.data);
      setPhase('result');
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', quiz.id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });

  // Timer countdown + auto-submit
  useEffect(() => {
    if (phase !== 'active' || timeLeftSec === null) return;
    const t = setInterval(() => setTimeLeftSec((s) => (s === null ? s : s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeftSec]);

  useEffect(() => {
    if (timeLeftSec !== null && timeLeftSec <= 0 && phase === 'active' && !submitMutation.isPending) {
      submitMutation.mutate();
    }
  }, [timeLeftSec, phase, submitMutation]);

  const question = attempt?.questions[currentIndex];
  const answeredCount = useMemo(
    () => (attempt ? attempt.questions.filter((q) => hasAnswer(q.type, answers[q.id])).length : 0),
    [attempt, answers],
  );

  // ============================================================
  // RENDER: INTRO
  // ============================================================
  if (phase === 'intro') {
    return (
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-0.5 h-8 w-8 shrink-0 text-primary-600" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Kuis Pelajaran</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {quiz.questionCount ?? '—'} soal • Nilai lulus {quiz.passingScore}%
                {quiz.timeLimitMin ? ` • Waktu ${quiz.timeLimitMin} menit` : ''}
                {typeof quiz.totalPoints === 'number' && quiz.totalPoints > 0 ? ` • Total ${quiz.totalPoints} poin` : ''}
              </p>
            </div>
          </div>
          <Button className="mt-4" loading={startMutation.isPending} onClick={() => startMutation.mutate()}>
            Mulai Kuis
          </Button>
        </Card>

        {historyLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (historyData?.attempts ?? []).length > 0 && (
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Riwayat Percobaan</h3>
            <ul className="divide-y divide-border">
              {(historyData?.attempts ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted-foreground">Percobaan #{a.attemptNumber}</span>
                  {a.submittedAt ? (
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{Math.round(a.percentage ?? 0)}%</span>
                      {a.isPassed ? (
                        <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Lulus</Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Tidak lulus</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatRelative(a.submittedAt)}</span>
                    </span>
                  ) : (
                    <Badge variant="warning">Berlangsung</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: ACTIVE (menjawab)
  // ============================================================
  if (phase === 'active' && attempt && question) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Soal {currentIndex + 1} dari {attempt.questions.length}</span>
          {timeLeftSec !== null && (
            <span className={cn('flex items-center gap-1.5 font-semibold', timeLeftSec <= 60 ? 'text-red-600' : 'text-muted-foreground')}>
              <Clock className="h-4 w-4" /> {fmtClock(Math.max(0, timeLeftSec))}
            </span>
          )}
        </div>

        <Card className="p-5">
          <QuestionBody question={question} value={answers[question.id]} onChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))} />
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
            <ChevronLeft className="h-4 w-4" /> Sebelumnya
          </Button>
          {currentIndex < attempt.questions.length - 1 ? (
            <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => i + 1)}>
              Berikutnya <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>Kirim Jawaban</Button>
          )}
        </div>

        {answeredCount < attempt.questions.length && (
          <p className="text-xs text-muted-foreground">{answeredCount}/{attempt.questions.length} soal terjawab</p>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: RESULT
  // ============================================================
  if (phase === 'result' && result) {
    return (
      <div className="space-y-4">
        <Card className={cn('p-5', result.isPassed ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40')}>
          <div className="flex items-center gap-3">
            {result.isPassed ? (
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            ) : (
              <XCircle className="h-10 w-10 text-red-500" />
            )}
            <div>
              <p className={cn('text-lg font-bold', result.isPassed ? 'text-green-800' : 'text-red-700')}>
                {result.isPassed ? 'Selamat, Anda lulus!' : 'Belum lulus'}
              </p>
              <p className="text-sm text-muted-foreground">
                Skor: {result.score}/{result.maxScore} ({Math.round(result.percentage)}%) — nilai minimum {result.passingScore}%
              </p>
            </div>
          </div>
        </Card>

        {/* Review per soal */}
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pembahasan</h3>
          <ol className="space-y-6">
            {result.answers.map((a, i) => (
              <li key={a.questionId} className="border-b border-border pb-5 last:border-0 last:pb-0">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{i + 1}. {a.questionText ?? '(soal)'}</p>
                  {a.isCorrect === null ? (
                    <Badge variant="warning">Menunggu penilaian</Badge>
                  ) : a.isCorrect ? (
                    <Badge variant="success" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> +{a.pointsEarned} poin</Badge>
                  ) : (
                    <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Salah</Badge>
                  )}
                </div>

                {/* Pilihan jawaban */}
                {a.options.length > 0 && (
                  <ul className="space-y-1.5">
                    {a.options.map((o) => {
                      const selected = a.selectedOptionIds.includes(o.id);
                      return (
                        <li
                          key={o.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                            o.isCorrect ? 'border-green-300 bg-green-50 text-green-800' : selected ? 'border-red-300 bg-red-50 text-red-700' : 'border-border text-muted-foreground',
                          )}
                        >
                          {o.isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                          {!o.isCorrect && selected && <XCircle className="h-4 w-4 shrink-0" />}
                          <span>{o.optionText}</span>
                          {selected && !o.isCorrect && <span className="ml-auto text-xs">(jawaban Anda)</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Jawaban teks */}
                {(a.type === 'short_answer' || a.type === 'essay') && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jawaban Anda</p>
                    {a.textAnswer ? <p className="whitespace-pre-wrap">{a.textAnswer}</p> : <p className="italic text-muted-foreground">(tidak dijawab)</p>}
                  </div>
                )}

                {/* Jawaban benar untuk short_answer */}
                {a.type === 'short_answer' && a.options.length > 0 && (
                  <p className="mt-2 text-xs text-green-700">Jawaban benar: {a.options.find((o) => o.isCorrect)?.optionText}</p>
                )}

                {/* Penjelasan */}
                {a.explanation && (
                  <div className="mt-3 rounded-md border-l-2 border-primary-400 bg-muted/40 p-3 text-sm text-foreground">
                    <span className="font-semibold">Penjelasan: </span>{a.explanation}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Button variant="outline" onClick={() => { setPhase('intro'); setResult(null); }}>
          Kembali ke Halaman Kuis
        </Button>
      </div>
    );
  }

  return null;
}

// ============================================================
// Komponen soal
// ============================================================
function QuestionBody({ question, value, onChange }: {
  question: Question;
  value?: { selectedOptionIds: string[]; textAnswer?: string };
  onChange: (v: { selectedOptionIds: string[]; textAnswer?: string }) => void;
}) {
  const base = value ?? { selectedOptionIds: [] as string[] };
  const selected = base.selectedOptionIds;
  const text = value?.textAnswer ?? '';

  const toggleOption = (optionId: string, multi: boolean) => {
    if (multi) {
      onChange({ ...base, selectedOptionIds: selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId] });
    } else {
      onChange({ ...base, selectedOptionIds: [optionId], textAnswer: undefined });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium leading-relaxed text-foreground">{question.questionText}</p>
      {question.imageUrl && <img src={question.imageUrl} alt="" className="max-h-64 rounded-md border border-border" />}

      {/* Pilihan ganda / benar-salah */}
      {(question.type === 'multiple_choice' || question.type === 'true_false') && (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                selected.includes(o.id) ? 'border-primary-400 bg-primary-50' : 'border-border hover:bg-muted/50',
              )}
            >
              <input type="radio" name={question.id} value={o.id} checked={selected.includes(o.id)} onChange={() => toggleOption(o.id, false)} className="accent-primary-600" />
              <span className="text-foreground">{o.optionText}</span>
            </label>
          ))}
        </div>
      )}

      {/* Jawaban banyak */}
      {question.type === 'multiple_answer' && (
        <div className="space-y-2">
          {question.options.map((o) => (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
                selected.includes(o.id) ? 'border-primary-400 bg-primary-50' : 'border-border hover:bg-muted/50',
              )}
            >
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggleOption(o.id, true)} className="accent-primary-600" />
              <span className="text-foreground">{o.optionText}</span>
            </label>
          ))}
        </div>
      )}

      {/* Jawaban singkat / esai */}
      {(question.type === 'short_answer' || question.type === 'essay') && (
        <textarea
          value={text}
          onChange={(e) => onChange({ selectedOptionIds: [], textAnswer: e.target.value })}
          placeholder="Tulis jawaban Anda di sini..."
          rows={question.type === 'essay' ? 6 : 2}
          className="w-full rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-primary-400 focus:outline-none"
        />
      )}
    </div>
  );
}

function hasAnswer(type: Question['type'], v?: { selectedOptionIds: string[]; textAnswer?: string }) {
  if (!v) return false;
  if (type === 'short_answer' || type === 'essay') return !!v.textAnswer?.trim();
  return v.selectedOptionIds.length > 0;
}


