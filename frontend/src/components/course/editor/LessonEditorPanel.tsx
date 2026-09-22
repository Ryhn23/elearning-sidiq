import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/useToast';
import FileUploader, { type UploadedFile } from './FileUploader';
import QuizBuilder from './QuizBuilder';
import { RichTextEditor } from '@/components/ui/RichTextEditor';

export interface LessonFull {
  id: string;
  sectionId: string;
  title: string;
  type: 'video' | 'document' | 'text' | 'zoom_link' | 'assignment' | 'quiz';
  durationMinutes: number | null;
  isFreePreview: boolean;
  content?: {
    videoUrl?: string | null;
    documentUrl?: string | null;
    documentName?: string | null;
    textContent?: string | null;
    zoomUrl?: string | null;
    zoomMeetingId?: string | null;
    zoomStartAt?: string | null;
    zoomDurationMin?: number | null;
    assignmentInstructions?: string | null;
  } | null;
  quiz?: { id: string; timeLimitMin: number | null; maxAttempts: number; passingScore: number; showResultImmediately: boolean } | null;
  assignment?: { id: string; dueDate: string | null; maxScore: number; maxFileSizeMb: number; allowedFileTypes: string[] } | null;
}

interface Props {
  courseId: string;
  sectionId: string;
  lesson: LessonFull;
}

const TYPE_LABEL: Record<LessonFull['type'], string> = {
  video: 'Video',
  document: 'Dokumen',
  text: 'Teks',
  zoom_link: 'Zoom Link',
  assignment: 'Assignment',
  quiz: 'Kuis',
};

/** Panel editor konten untuk satu lesson (dibuka dari CurriculumBuilder). */
export default function LessonEditorPanel({ courseId, sectionId, lesson }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['course-full', courseId] });

  const [title, setTitle] = useState(lesson.title);
  const [durationMinutes, setDurationMinutes] = useState<string>(lesson.durationMinutes ? String(lesson.durationMinutes) : '');
  const [isFreePreview, setIsFreePreview] = useState(!!lesson.isFreePreview);

  const saveMetaMutation = useMutation({
    mutationFn: () =>
      api.put(`/sections/${sectionId}/lessons/${lesson.id}`, {
        title: title.trim(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        isFreePreview,
      }),
    onSuccess: () => { invalidate(); toast('Lesson disimpan'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan lesson', 'error'),
  });

  const saveContentMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put(`/sections/${sectionId}/lessons/${lesson.id}/content`, body),
    onSuccess: () => { invalidate(); toast('Konten disimpan'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan konten', 'error'),
  });

  const content = lesson.content;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      {/* Metadata */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_auto]">
        <Input label="Judul Lesson" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Durasi (menit)" type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="-" />
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} className="h-4 w-4 accent-primary-600" />
            Free preview
          </label>
        </div>
      </div>

      {/* Konten per tipe */}
      {lesson.type === 'video' && (
        <VideoContentEditor content={content ?? null} onUploaded={(f) => saveContentMutation.mutate({ videoUrl: f.url })} saving={saveContentMutation.isPending} />
      )}
      {lesson.type === 'document' && (
        <DocumentContentEditor content={content ?? null} onUploaded={(f) => saveContentMutation.mutate({ documentUrl: f.url, documentName: f.fileName })} saving={saveContentMutation.isPending} />
      )}
      {lesson.type === 'text' && (
        <TextContentEditor initial={content?.textContent ?? ''} onSave={(v) => saveContentMutation.mutate({ textContent: v })} saving={saveContentMutation.isPending} />
      )}
      {lesson.type === 'zoom_link' && (
        <ZoomContentEditor content={content ?? null} onSave={(body) => saveContentMutation.mutate(body)} saving={saveContentMutation.isPending} />
      )}
      {lesson.type === 'assignment' && (
        <>
          <TextContentEditor label="Instruksi Tugas" initial={content?.assignmentInstructions ?? ''} onSave={(v) => saveContentMutation.mutate({ assignmentInstructions: v })} saving={saveContentMutation.isPending} />
          <AssignmentSettings lesson={lesson} onSaved={() => { invalidate(); toast('Pengaturan assignment disimpan'); }} />
        </>
      )}
      {lesson.type === 'quiz' && (
        <QuizBuilder lessonId={lesson.id} quiz={lesson.quiz ?? null} />
      )}

      <div className="flex items-center justify-between pt-1">
        <Badge variant="outline">{TYPE_LABEL[lesson.type]}</Badge>
        <Button size="sm" loading={saveMetaMutation.isPending || saveContentMutation.isPending} onClick={() => saveMetaMutation.mutate()}>
          Simpan Lesson
        </Button>
      </div>
    </div>
  );
}

function VideoContentEditor({ content, onUploaded, saving }: { content: LessonFull['content']; onUploaded: (f: UploadedFile) => void; saving: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Video</p>
      {content?.videoUrl ? (
        <a href={content.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
          <Link2 className="h-3 w-3" /> Video terpasang — ganti dengan upload baru
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">Belum ada video.</p>
      )}
      {saving && <p className="text-xs text-primary-600">Menyimpan...</p>}
      <FileUploader kind="video" hint="MP4/WebM, maks 2 GB" onUploaded={onUploaded} />
    </div>
  );
}

function DocumentContentEditor({ content, onUploaded, saving }: { content: LessonFull['content']; onUploaded: (f: UploadedFile) => void; saving: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Dokumen</p>
      {content?.documentUrl ? (
        <a href={content.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
          <Link2 className="h-3 w-3" /> {content.documentName ?? 'Dokumen terpasang'} — ganti dengan upload baru
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">Belum ada dokumen.</p>
      )}
      {saving && <p className="text-xs text-primary-600">Menyimpan...</p>}
      <FileUploader kind="document" hint="PDF/DOCX/PPT/ZIP, maks 50 MB" onUploaded={onUploaded} />
    </div>
  );
}

function TextContentEditor({ label = 'Konten Teks', initial, onSave, saving }: { label?: string; initial: string; onSave: (value: string) => void; saving: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="space-y-3">
      <RichTextEditor label={label} rows={6} value={value} onChange={setValue} placeholder="Tulis materi pelajaran lengkap di sini..." />
      <Button size="sm" variant="outline" loading={saving} onClick={() => onSave(value)}>Simpan Konten Teks</Button>
    </div>
  );
}

function ZoomContentEditor({ content, onSave, saving }: { content: LessonFull['content']; onSave: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [zoomUrl, setZoomUrl] = useState(content?.zoomUrl ?? '');
  const [meetingId, setMeetingId] = useState(content?.zoomMeetingId ?? '');
  const [startAt, setStartAt] = useState(content?.zoomStartAt ? content.zoomStartAt.slice(0, 16) : '');
  const [durationMin, setDurationMin] = useState<string>(content?.zoomDurationMin ? String(content.zoomDurationMin) : '60');

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Sesi Zoom</p>
      <Input label="URL Meeting" value={zoomUrl} onChange={(e) => setZoomUrl(e.target.value)} placeholder="https://zoom.us/j/..." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Meeting ID (opsional)" value={meetingId} onChange={(e) => setMeetingId(e.target.value)} />
        <Input label="Durasi (menit)" type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
      </div>
      <Input label="Waktu Mulai" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      <Button size="sm" variant="outline" loading={saving} onClick={() => onSave({ zoomUrl: zoomUrl || '', zoomMeetingId: meetingId, zoomStartAt: startAt ? new Date(startAt).toISOString() : null, zoomDurationMin: Number(durationMin) })}>
        Simpan Pengaturan Zoom
      </Button>
    </div>
  );
}

function AssignmentSettings({ lesson, onSaved }: { lesson: LessonFull; onSaved: () => void }) {
  const { toast } = useToast();
  const a = lesson.assignment;

  const [dueDate, setDueDate] = useState<string>(a?.dueDate ? new Date(a.dueDate).toISOString().slice(0, 16) : '');
  const [maxScore, setMaxScore] = useState(String(a?.maxScore ?? 100));
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(String(a?.maxFileSizeMb ?? 10));
  const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(a?.allowedFileTypes ?? ['pdf', 'docx', 'zip']);

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        maxScore: Number(maxScore),
        maxFileSizeMb: Number(maxFileSizeMb),
        allowedFileTypes,
      };
      return a ? api.put(`/assignments/${a.id}`, body) : api.post(`/assignments/lessons/${lesson.id}`, body);
    },
    onSuccess: onSaved,
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan assignment', 'error'),
  });

  const FILE_TYPES = ['pdf', 'docx', 'zip', 'jpg', 'png'];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pengaturan Tugas</CardTitle>
        {a ? <Badge variant="success">Aktif</Badge> : <Badge variant="warning">Belum dibuat</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Batas Waktu (opsional)" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input label="Skor Maksimal" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </div>
        <Input label="Ukuran File Maks (MB)" type="number" min={1} max={50} value={maxFileSizeMb} onChange={(e) => setMaxFileSizeMb(e.target.value)} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-foreground">Jenis File yang Diizinkan</p>
          <div className="flex flex-wrap gap-3">
            {FILE_TYPES.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={allowedFileTypes.includes(t)}
                  onChange={(e) => setAllowedFileTypes(e.target.checked ? [...allowedFileTypes, t] : allowedFileTypes.filter((x) => x !== t))}
                  className="h-4 w-4 accent-primary-600"
                />
                {t.toUpperCase()}
              </label>
            ))}
          </div>
        </div>
        <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {a ? 'Simpan Pengaturan' : 'Buat Assignment'}
        </Button>
      </CardContent>
    </Card>
  );
}
