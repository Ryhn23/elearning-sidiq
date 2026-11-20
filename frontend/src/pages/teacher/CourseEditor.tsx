import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Send, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import FileUploader, { type UploadedFile } from '@/components/course/editor/FileUploader';
import CurriculumBuilder from '@/components/course/editor/CurriculumBuilder';

interface CourseDetail {
  id: string;
  title: string;
  description?: string | null;
  shortDescription?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  language: string;
  estimatedHours?: number | null;
  price: number;
  status: string;
  learningOutcomes?: string[];
  requirements?: string[];
  tags?: string[];
  certificateEnabled?: boolean;
  sidiqPelajaranId?: string | null;
  sidiqKelasId?: string | null;
  sections?: { id: string; title: string; lessons: unknown[] }[];
}

const STEPS = [
  { n: 1, label: 'Info Dasar' },
  { n: 2, label: 'Kurikulum' },
  { n: 3, label: 'Pengaturan' },
  { n: 4, label: 'Publikasi' },
];

const STATUS_BADGE: Record<string, { variant: 'default' | 'primary' | 'success' | 'warning' | 'destructive'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  pending_review: { variant: 'warning', label: 'Menunggu Review' },
  published: { variant: 'success', label: 'Terbit' },
  rejected: { variant: 'destructive', label: 'Ditolak' },
};

export default function CourseEditor() {
  const { courseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !courseId;
  const step = Math.min(4, Math.max(1, Number(searchParams.get('step') ?? '1')));

  function goStep(n: number) {
    if (isNew && n > 1) return; // kursus baru harus dibuat dulu di step 1
    setSearchParams({ step: String(n) });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link to="/teacher/courses" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Kursus
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{isNew ? 'Buat Kursus Baru' : 'Editor Kursus'}</h1>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const active = (isNew ? s.n === 1 : step === s.n);
          const locked = isNew && s.n > 1;
          return (
            <button
              key={s.n}
              onClick={() => goStep(s.n)}
              disabled={locked || active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-primary-600 text-white' : locked ? 'cursor-not-allowed bg-muted/50 text-muted-foreground/50' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {s.n}. {s.label}
            </button>
          );
        })}
      </div>

      {step === 1 && <BasicInfoStep isNew={isNew} courseId={courseId!} onCreated={(id) => navigate(`/teacher/courses/${id}/edit?step=2`)} />}
      {!isNew && step === 2 && <CurriculumBuilder courseId={courseId!} />}
      {!isNew && step === 3 && <SettingsStep courseId={courseId!} />}
      {!isNew && step === 4 && <PublishStep courseId={courseId!} onGoStep={(n) => setSearchParams({ step: String(n) })} />}
    </div>
  );
}

// ============================================================
// STEP 1 — Info Dasar (create / edit)
// ============================================================
function BasicInfoStep({ isNew, courseId, onCreated }: { isNew: boolean; courseId?: string; onCreated?: (id: string) => void }) {
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [sidiqPelajaranId, setSidiqPelajaranId] = useState<string>('');
  const [level, setLevel] = useState('all_levels');
  const [price, setPrice] = useState('0');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  const { data: course } = useQuery({
    queryKey: ['course-detail', courseId],
    enabled: !isNew && !!courseId,
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data as CourseDetail,
  });

  // Prefill form saat data kursus pertama kali tersedia (mode edit)
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!isNew && course && !initialized) {
      setTitle(course.title ?? '');
      setShortDescription(course.shortDescription ?? '');
      setDescription(course.description ?? '');
      setCategoryId(course.categoryId ?? '');
      setSidiqPelajaranId(course.sidiqPelajaranId ?? '');
      setLevel(course.level ?? 'all_levels');
      setPrice(String(course.price ?? 0));
      setThumbnailUrl(course.thumbnailUrl ?? '');
      setInitialized(true);
    }
  }, [course, isNew, initialized]);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get('/categories')).data as { id: string; name: string }[] });

  const { data: sidiqMapel } = useQuery({
    queryKey: ['sidiq-pelajaran'],
    queryFn: async () => {
      try {
        const res = await api.get('/integrations/sidiq/sync/pelajaran');
        return (res.data?.data ?? []) as { id: string; nama_pelajaran: string; kode_pelajaran?: string; kategori?: string }[];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        shortDescription: shortDescription.trim() || undefined,
        description: description || undefined,
        categoryId: categoryId || null,
        sidiqPelajaranId: sidiqPelajaranId || null,
        level,
        price: Number(price),
        thumbnailUrl: thumbnailUrl || '',
      };
      return isNew ? api.post('/courses', body) : api.put(`/courses/${courseId}`, body);
    },
    onSuccess: (res) => {
      if (isNew) {
        toast('Kursus berhasil dibuat!');
        onCreated?.(res.data.id);
      } else {
        toast('Info kursus disimpan');
      }
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan', 'error'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isNew ? 'Lengkapi info dasar kursus' : 'Info Dasar Kursus'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input label="Judul Kursus *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Contoh: "React Fundamentals"' />
        <Textarea label="Deskripsi Singkat" rows={2} maxLength={500} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} hint={`${shortDescription.length}/500 — tampil di katalog & kartu kursus`} />
        <Textarea label="Deskripsi Lengkap (HTML)" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="<p>Penjelasan lengkap materi, target peserta, dll...</p>" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Pilih kategori —</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">Pemula</option>
              <option value="intermediate">Menengah</option>
              <option value="advanced">Lanjutan</option>
              <option value="all_levels">Semua Level</option>
            </Select>
            <Input label="Harga (Rp)" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} hint="0 = gratis" />
          </div>
        </div>

        <div className="rounded-lg border border-primary-500/20 bg-primary-50/40 p-3.5 dark:bg-primary-950/20">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
            Terkoneksi SIDIQ ERP (Sinkronisasi Nilai Otomatis)
          </p>
          <Select
            label="Mata Pelajaran SIDIQ"
            value={sidiqPelajaranId}
            onChange={(e) => setSidiqPelajaranId(e.target.value)}
            hint="Jika dipilih, seluruh nilai kuis, tugas, dan sertifikat santri di kursus ini akan otomatis masuk ke database SIDIQ."
          >
            <option value="">— Standalone LMS (Tidak Terkoneksi ke SIDIQ) —</option>
            {(sidiqMapel ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama_pelajaran} {m.kode_pelajaran ? `(${m.kode_pelajaran})` : ''} {m.kategori ? `— ${m.kategori}` : ''}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Thumbnail</p>
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="Thumbnail" className="h-32 rounded-md object-cover" />
          ) : null}
          <FileUploader kind="image" hint="JPG/PNG, maks 5 MB" onUploaded={(f: UploadedFile) => setThumbnailUrl(f.url)} className="mt-2 max-w-sm" />
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button loading={saveMutation.isPending} disabled={!title.trim()} onClick={() => saveMutation.mutate()}>
            {isNew ? 'Buat Kursus & Lanjut ke Kurikulum' : 'Simpan Info Dasar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// STEP 3 — Pengaturan (outcomes, requirements, tags, sertifikat)
// ============================================================
function SettingsStep({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data as CourseDetail,
  });

  const [outcomes, setOutcomes] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<string | null>(null);
  const [tags, setTags] = useState<string | null>(null);
  const [certificateEnabled, setCertificateEnabled] = useState<boolean | null>(null);
  const [estimatedHours, setEstimatedHours] = useState<string>('');

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!course) return Promise.reject(new Error('Kursus belum dimuat'));
      return api.put(`/courses/${courseId}`, {
        learningOutcomes: (outcomes ?? course.learningOutcomes?.join('\n') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        requirements: (requirements ?? course.requirements?.join('\n') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        tags: (tags ?? course.tags?.join(', ') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        certificateEnabled: certificateEnabled ?? !!course.certificateEnabled,
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['course-detail', courseId] }); toast('Pengaturan disimpan'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan pengaturan', 'error'),
  });

  if (isLoading || !course) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader><CardTitle>Pengaturan Kursus</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Textarea label="Tujuan Pembelajaran" rows={4} defaultValue={(course.learningOutcomes ?? []).join('\n')} onChange={(e) => setOutcomes(e.target.value)} hint="Satu poin per baris" />
        <Textarea label="Prasyarat / Requirements" rows={3} defaultValue={(course.requirements ?? []).join('\n')} onChange={(e) => setRequirements(e.target.value)} hint="Satu prasyarat per baris" />
        <Input label="Tags" value={tags ?? (course.tags ?? []).join(', ')} onChange={(e) => setTags(e.target.value)} placeholder="react, javascript, web" hint="Pisahkan dengan koma" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Estimasi Durasi (jam)" type="number" min={0} value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder={course.estimatedHours ? String(course.estimatedHours) : '-'} />
          <label className="flex cursor-pointer items-center gap-2 self-end pb-1 text-sm font-medium text-foreground">
            <input type="checkbox" checked={certificateEnabled ?? !!course.certificateEnabled} onChange={(e) => setCertificateEnabled(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            Berikan sertifikat penyelesaian
          </label>
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            <Save className="mr-1 h-4 w-4" /> Simpan Pengaturan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// STEP 4 — Publikasi (ringkasan + submit review)
// ============================================================
function PublishStep({ courseId, onGoStep }: { courseId: string; onGoStep: (n: number) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-detail', courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}`)).data as CourseDetail,
  });

  const submitMutation = useMutation({
    mutationFn: () => api.patch(`/courses/${courseId}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-detail', courseId] });
      toast('Kursus dikirim untuk review. Admin akan mempublikannya.');
    },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal mengirim kursus', 'error'),
  });

  if (isLoading || !course) return <Skeleton className="h-64 w-full" />;

  const totalLessons = (course.sections ?? []).reduce((acc, s) => acc + s.lessons.length, 0);
  const status = STATUS_BADGE[course.status] ?? { variant: 'default' as const, label: course.status };
  const canSubmit = course.status === 'draft' || course.status === 'rejected';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Ringkasan Kursus</CardTitle>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Judul</dt><dd className="font-medium text-foreground">{course.title}</dd></div>
            <div><dt className="text-muted-foreground">Harga</dt><dd className="font-medium text-foreground">{Number(course.price) === 0 ? 'Gratis' : `Rp ${Number(course.price).toLocaleString('id-ID')}`}</dd></div>
            <div><dt className="text-muted-foreground">Level</dt><dd className="font-medium text-foreground capitalize">{course.level.replace('_', ' ')}</dd></div>
            <div><dt className="text-muted-foreground">Sertifikat</dt><dd className="font-medium text-foreground">{course.certificateEnabled ? 'Ya' : 'Tidak'}</dd></div>
            <div><dt className="text-muted-foreground">Jumlah Section</dt><dd className="font-medium text-foreground">{(course.sections ?? []).length}</dd></div>
            <div><dt className="text-muted-foreground">Total Lesson</dt><dd className="font-medium text-foreground">{totalLessons}</dd></div>
          </dl>

          {totalLessons === 0 && (
            <p className="mt-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Kursus belum memiliki lesson. Selesaikan step Kurikulum dulu agar review bisa diloloskan.
            </p>
          )}

          {course.status === 'rejected' && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Kursus sebelumnya ditolak admin. Perbaiki lalu kirim ulang untuk review.
            </p>
          )}

          {course.status === 'pending_review' && (
            <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Kursus sedang menunggu review admin. Anda tetap bisa mengedit, namun perubahan tidak akan otomatis mengubah status.
            </p>
          )}

          {course.status === 'published' && (
            <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Kursus sudah terbit dan bisa diakses peserta.
            </p>
          )}
        </CardContent>
      </Card>

      {canSubmit && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Kirim untuk Review</p>
              <p className="text-xs text-muted-foreground">Admin akan memverifikasi konten lalu mempublikasikan kursus Anda.</p>
            </div>
            <Button loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              <Send className="mr-1 h-4 w-4" /> Kirim untuk Review
            </Button>
          </CardContent>
        </Card>
      )}

      {course.status !== 'published' && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onGoStep(2)}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Kembali ke Kurikulum
          </Button>
        </div>
      )}
    </div>
  );
}
