import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, FolderOpen, FileVideo, FileText, Type as TypeIcon, Link2, ClipboardList, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import LessonEditorPanel, { type LessonFull } from './LessonEditorPanel';

interface SectionWithLessons {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  lessons: LessonFull[];
}

const LESSON_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Dokumen' },
  { value: 'text', label: 'Teks' },
  { value: 'zoom_link', label: 'Zoom Link' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'quiz', label: 'Kuis' },
] as const;

const TYPE_ICON = {
  video: FileVideo,
  document: FileText,
  text: TypeIcon,
  zoom_link: Link2,
  assignment: ClipboardList,
  quiz: HelpCircle,
} as const;

/** Builder kurikulum: kelola section + lesson untuk satu kursus. */
export default function CurriculumBuilder({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['course-full', courseId] });

  const { data, isLoading } = useQuery({
    queryKey: ['course-full', courseId],
    queryFn: async () => (await api.get(`/courses/${courseId}/full`)).data as { sections: SectionWithLessons[] },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const sections = data?.sections ?? [];

  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada section. Tambahkan section pertama di bawah untuk mulai menyusun kurikulum.
          </CardContent>
        </Card>
      )}

      {sections.map((section, i) => (
        <SectionEditor key={section.id} courseId={courseId} index={i} total={sections.length} section={section} onInvalidated={invalidate} />
      ))}

      <AddSectionForm courseId={courseId} onCreated={() => { invalidate(); }} />
    </div>
  );
}

function AddSectionForm({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.post(`/courses/${courseId}/sections`, { title: title.trim() }),
    onSuccess: (res) => {
      onCreated();
      setTitle('');
      // Scroll ke section baru setelah data ter-refresh
      setTimeout(() => document.getElementById(`section-${res.data.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    },
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input label="Section Baru" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Contoh: "Pengantar React"' />
        </div>
        <Button loading={mutation.isPending} disabled={!title.trim()} onClick={() => mutation.mutate()}>
          <Plus className="mr-1 h-4 w-4" /> Tambah Section
        </Button>
      </CardContent>
    </Card>
  );
}

function SectionEditor({ courseId, index, total, section, onInvalidated }: {
  courseId: string;
  index: number;
  total: number;
  section: SectionWithLessons;
  onInvalidated: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(section.title);
  const [open, setOpen] = useState(true);
  const [newLessonType, setNewLessonType] = useState<string>('video');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);

  const invalidateAll = () => { onInvalidated(); queryClient.invalidateQueries({ queryKey: ['course-full', courseId] }); };

  const deleteSectionMutation = useMutation({
    mutationFn: () => api.delete(`/courses/${courseId}/sections/${section.id}`),
    onSuccess: () => { invalidateAll(); toast('Section dihapus'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menghapus section', 'error'),
  });

  const saveTitleMutation = useMutation({
    mutationFn: () => api.put(`/courses/${courseId}/sections/${section.id}`, { title: title.trim() }),
    onSuccess: () => { invalidateAll(); toast('Section disimpan'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menyimpan section', 'error'),
  });

  const addLessonMutation = useMutation({
    mutationFn: () => api.post(`/sections/${section.id}/lessons`, { title: newLessonTitle.trim(), type: newLessonType }),
    onSuccess: (res) => { invalidateAll(); setNewLessonTitle(''); toast(`Lesson "${res.data.title}" ditambahkan`); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menambah lesson', 'error'),
  });

  const deleteLessonMutation = useMutation({
    mutationFn: (lessonId: string) => api.delete(`/sections/${section.id}/lessons/${lessonId}`),
    onSuccess: () => { invalidateAll(); toast('Lesson dihapus'); },
    onError: (err: any) => toast(err.response?.data?.error ?? 'Gagal menghapus lesson', 'error'),
  });

  const moveSection = async (dir: -1 | 1) => {
    // Urutan section diambil dari data terbaru via query cache
    const cached = queryClient.getQueryData<{ sections: SectionWithLessons[] }>(['course-full', courseId]);
    const order = (cached?.sections ?? []).map((s) => s.id);
    const idx = order.indexOf(section.id);
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    try {
      await api.patch(`/courses/${courseId}/sections/reorder`, { order });
      invalidateAll();
    } catch {
      toast('Gagal mengubah urutan section', 'error');
    }
  };

  const moveLesson = async (lessonId: string, dir: -1 | 1) => {
    const lessons = section.lessons;
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const target = idx + dir;
    if (target < 0 || target >= lessons.length) return;
    const order = lessons.map((l) => l.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    try {
      await api.patch(`/sections/${section.id}/lessons/reorder`, { order });
      invalidateAll();
    } catch {
      toast('Gagal mengubah urutan lesson', 'error');
    }
  };

  return (
    <Card id={`section-${section.id}`}>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <FolderOpen className="h-4 w-4 shrink-0 text-primary-600" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== section.title && saveTitleMutation.mutate()}
            className="w-full min-w-0 bg-transparent text-sm font-semibold text-foreground focus:outline-none"
          />
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => moveSection(-1)} title="Naik"><ChevronUp className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" disabled={index === total - 1} onClick={() => moveSection(1)} title="Turun"><ChevronDown className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" loading={deleteSectionMutation.isPending} onClick={() => { if (confirm(`Hapus section "${section.title}" beserta semua lesson-nya?`)) deleteSectionMutation.mutate(); }} title="Hapus Section">
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </div>

      {open && (
        <CardContent className="space-y-2 p-3">
          {section.lessons.map((lesson, li) => {
            const Icon = TYPE_ICON[lesson.type];
            return (
              <div key={lesson.id} className="rounded-md border border-border">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button type="button" onClick={() => setExpandedLessonId(expandedLessonId === lesson.id ? null : lesson.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    {expandedLessonId === lesson.id ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm text-foreground">{lesson.title}</span>
                    {lesson.isFreePreview && <Badge variant="success" className="hidden sm:inline-flex">Preview</Badge>}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" disabled={li === 0} onClick={() => moveLesson(lesson.id, -1)} title="Naik"><ChevronUp className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" disabled={li === section.lessons.length - 1} onClick={() => moveLesson(lesson.id, 1)} title="Turun"><ChevronDown className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" loading={deleteLessonMutation.isPending} onClick={() => { if (confirm(`Hapus lesson "${lesson.title}"?`)) deleteLessonMutation.mutate(lesson.id); }} title="Hapus Lesson">
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>

                {expandedLessonId === lesson.id && (
                  <div className="border-t border-border p-2">
                    <LessonEditorPanel courseId={courseId} sectionId={section.id} lesson={lesson} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Form tambah lesson */}
          <div className="mt-3 rounded-md border border-dashed border-border p-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tambah Lesson</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="sm:w-40">
                <Select label="Tipe" value={newLessonType} onChange={(e) => setNewLessonType(e.target.value)}>
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Input label="Judul" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} placeholder='Contoh: "Memahami Component"' />
              </div>
              <Button size="sm" loading={addLessonMutation.isPending} disabled={!newLessonTitle.trim()} onClick={() => addLessonMutation.mutate()}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
