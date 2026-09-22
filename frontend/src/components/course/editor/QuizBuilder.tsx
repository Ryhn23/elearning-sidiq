import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';

interface QuizMeta {
  id: string;
  timeLimitMin: number | null;
  maxAttempts: number;
  passingScore: number;
  showResultImmediately: boolean;
}

interface QuestionOption {
  id?: string;
  optionText: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: 'multiple_choice' | 'multiple_answer' | 'true_false' | 'short_answer' | 'essay';
  questionText: string;
  points: number;
  explanation?: string | null;
  options: QuestionOption[];
}

interface QuizDetail {
  quiz: QuizMeta & Record<string, unknown>;
  questions: Question[];
}

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Pilihan Ganda' },
  { value: 'multiple_answer', label: 'Jawaban Berganda (multi)' },
  { value: 'true_false', label: 'Benar / Salah' },
  { value: 'short_answer', label: 'Jawaban Singkat' },
  { value: 'essay', label: 'Esai' },
] as const;

function validateQuestion(type: Question['type'], options: QuestionOption[]): string | null {
  const correctCount = options.filter((o) => o.isCorrect).length;
  switch (type) {
    case 'multiple_choice':
      if (options.length < 2 || correctCount !== 1) return 'Butuh minimal 2 pilihan dengan tepat 1 jawaban benar';
      break;
    case 'multiple_answer':
      if (options.length < 2 || correctCount < 2) return 'Butuh minimal 2 pilihan dengan minimal 2 jawaban benar';
      break;
    case 'true_false':
      if (options.length !== 2 || correctCount !== 1) return 'Butuh tepat 2 pilihan dengan 1 jawaban benar';
      break;
    case 'short_answer':
      if (options.length !== 1 || correctCount !== 1) return 'Butuh tepat 1 opsi sebagai jawaban benar';
      break;
    case 'essay':
      if (options.length > 0) return 'Esai tidak memiliki opsi jawaban';
      break;
  }
  return null;
}

function emptyDraft(): { type: Question['type']; questionText: string; points: number; explanation: string; options: QuestionOption[] } {
  return { type: 'multiple_choice', questionText: '', points: 1, explanation: '', options: [{ optionText: '', isCorrect: true }, { optionText: '', isCorrect: false }] };
}

/**
 * Builder kuis untuk satu lesson (create quiz + CRUD soal).
 */
export default function QuizBuilder({ lessonId, quiz }: { lessonId: string; quiz?: QuizMeta | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () => api.post(`/quizzes/lessons/${lessonId}`, { maxAttempts: 3, passingScore: 70 }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', res.data.id] });
      toast('Kuis dibuat. Sekarang tambahkan soalnya.');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal membuat kuis', 'error'),
  });

  const quizId = quiz?.id;
  const { data, isLoading } = useQuery({
    queryKey: ['quiz-detail', quizId],
    enabled: !!quizId,
    queryFn: async () => (await api.get(`/quizzes/${quizId}`)).data as QuizDetail,
  });

  if (!quiz) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Lesson ini belum memiliki kuis.</p>
          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
            Buat Kuis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : data ? (
        <>
          <QuizSettings quiz={data.quiz} />
          <QuestionManager quizId={quiz.id} questions={data.questions} />
        </>
      ) : null}
    </div>
  );
}

function QuizSettings({ quiz }: { quiz: QuizDetail['quiz'] }) {
  const { toast } = useToast();
  const [timeLimitMin, setTimeLimitMin] = useState<string>(quiz.timeLimitMin ? String(quiz.timeLimitMin) : '');
  const [maxAttempts, setMaxAttempts] = useState(String(quiz.maxAttempts));
  const [passingScore, setPassingScore] = useState(String(quiz.passingScore));

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/quizzes/${quiz.id}`, {
        timeLimitMin: timeLimitMin ? Number(timeLimitMin) : null,
        maxAttempts: Number(maxAttempts),
        passingScore: Number(passingScore),
      }),
    onSuccess: () => toast('Pengaturan kuis disimpan'),
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan', 'error'),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pengaturan Kuis</CardTitle>
        <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          Simpan Pengaturan
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="Batas Waktu (menit)" type="number" min={1} value={timeLimitMin} onChange={(e) => setTimeLimitMin(e.target.value)} placeholder="Tanpa batas" />
        <Input label="Maksimal Percobaan" type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
        <Input label="Nilai Lulus (%)" type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(e.target.value)} />
      </CardContent>
    </Card>
  );
}

function QuestionManager({ quizId, questions }: { quizId: string; questions: Question[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['quiz-detail', quizId] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quizzes/${quizId}/questions/${id}`),
    onSuccess: () => {
      invalidate();
      toast('Soal dihapus');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menghapus soal', 'error'),
  });

  const [openNew, setOpenNew] = useState(false);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Soal ({questions.length})</CardTitle>
        <Button size="sm" variant={openNew ? 'outline' : 'primary'} onClick={() => setOpenNew((v) => !v)}>
          {openNew ? 'Tutup Form' : <><Plus className="mr-1 h-4 w-4" /> Tambah Soal</>}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.length === 0 && !openNew && (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada soal. Klik "Tambah Soal" untuk membuat.</p>
        )}

        {questions.map((q, i) => (
          <QuestionEditor key={q.id} index={i + 1} question={q} quizId={quizId} onSaved={() => { invalidate(); toast('Soal disimpan'); }} onDelete={() => deleteMutation.mutate(q.id)} deleting={deleteMutation.isPending} />
        ))}

        {openNew && (
          <QuestionForm
            initial={emptyDraft()}
            onSubmit={async (payload) => {
              await api.post(`/quizzes/${quizId}/questions`, payload);
              invalidate();
              setOpenNew(false);
              toast('Soal ditambahkan');
            }}
            onCancel={() => setOpenNew(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function QuestionEditor({ index, question, quizId, onSaved, onDelete, deleting }: {
  index: number;
  question: Question;
  quizId: string;
  onSaved: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">{index}. {question.questionText}</span>
        <Badge variant={question.type === 'essay' ? 'warning' : 'default'} className="ml-auto hidden sm:inline-flex">
          {QUESTION_TYPES.find((t) => t.value === question.type)?.label ?? question.type}
        </Badge>
      </button>

      {open && (
        <div className="border-t border-border p-3">
          <QuestionForm
            initial={{ type: question.type, questionText: question.questionText, points: question.points, explanation: question.explanation ?? '', options: question.options }}
            onSubmit={async (payload) => {
              await api.put(`/quizzes/${quizId}/questions/${question.id}`, payload);
              onSaved();
            }}
            onCancel={() => setOpen(false)}
            submitLabel="Simpan Soal"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="destructive" disabled={deleting} onClick={onDelete}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus Soal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionForm({ initial, onSubmit, onCancel, submitLabel = 'Simpan' }: {
  initial: ReturnType<typeof emptyDraft>;
  onSubmit: (payload: { type: string; questionText: string; points: number; explanation?: string; options: { optionText: string; isCorrect: boolean }[] }) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [type, setType] = useState<Question['type']>(initial.type);
  const [questionText, setQuestionText] = useState(initial.questionText);
  const [points, setPoints] = useState(String(initial.points));
  const [explanation, setExplanation] = useState(initial.explanation);
  const [options, setOptions] = useState<QuestionOption[]>(initial.options);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!questionText.trim()) return;
    const err = validateQuestion(type, options.filter((o) => o.optionText.trim()));
    if (err) return;
    setSaving(true);
    try {
      await onSubmit({ type, questionText: questionText.trim(), points: Number(points), explanation: explanation || undefined, options: options.filter((o) => o.optionText.trim()).map(({ optionText, isCorrect }) => ({ optionText: optionText.trim(), isCorrect })) });
      onCancel();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-primary-500/40 bg-muted/20 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
        <Select label="Jenis Soal" value={type} onChange={(e) => setType(e.target.value as Question['type'])}>
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Input label="Poin" type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
      </div>

      <Textarea label="Pertanyaan" rows={2} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Tulis pertanyaan di sini..." />

      {type !== 'essay' && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Pilihan Jawaban</p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opt.isCorrect}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, isCorrect: e.target.checked } : o)))}
                className="h-4 w-4 accent-primary-600"
                title="Jawaban benar"
              />
              <Input value={opt.optionText} onChange={(e) => setOptions(options.map((o, j) => (j === i ? { ...o, optionText: e.target.value } : o)))} placeholder={`Pilihan ${i + 1}`} className="h-8" />
              <Button size="sm" variant="ghost" onClick={() => setOptions(options.filter((_, j) => j !== i))} disabled={options.length <= (type === 'true_false' || type === 'short_answer' ? 1 : 2)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {type !== 'true_false' && type !== 'short_answer' && (
            <Button size="sm" variant="outline" onClick={() => setOptions([...options, { optionText: '', isCorrect: false }])}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Tambah Pilihan
            </Button>
          )}
        </div>
      )}

      <Textarea label="Penjelasan (opsional)" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Jelaskan mengapa jawaban tersebut benar..." />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Batal</Button>
        <Button size="sm" loading={saving} onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
