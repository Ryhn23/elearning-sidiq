import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight,
  FileText, PlayCircle, Menu, X, Award, MessageSquare, Megaphone,
  StickyNote, Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { sanitizeHtml } from '@/lib/sanitize';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { useToast } from '@/components/ui/useToast';
import VideoPlayer from '@/components/course/VideoPlayer';
import AssignmentWidget from '@/components/course/AssignmentWidget';
import QuizWidget from '@/components/course/QuizWidget';
import { AnnouncementPanel } from '@/components/course/AnnouncementPanel';
import { DiscussionPanel } from '@/components/course/DiscussionPanel';
import { cn, formatDuration } from '@/lib/utils';

interface FullCourse {
  id: string;
  slug: string;
  title: string;
  sections: {
    id: string;
    title: string;
    sortOrder: number;
    lessons: {
      id: string;
      /** Diisi saat di-flatten oleh CoursePlayer (bukan dari API). */
      sectionId?: string;
      title: string;
      type: string;
      sortOrder: number;
      durationMinutes: number;
      content?: {
        videoUrl: string | null;
        documentUrl: string | null;
        documentName: string | null;
        textContent: string | null;
        zoomUrl: string | null;
        assignmentInstructions: string | null;
      } | null;
      quiz?: {
        id: string;
        timeLimitMin: number | null;
        maxAttempts: number;
        passingScore: number;
        showResultImmediately: boolean;
        questionCount?: number;
        totalPoints?: number;
      } | null;
      assignment?: {
        id: string;
        dueDate: string | null;
        maxScore: number;
        maxFileSizeMb: number;
        allowedFileTypes: string[] | null;
      } | null;
    }[];
  }[];
}

interface ProgressData {
  enrollment: { progress: number };
  lessons: { lessonId: string; isCompleted: boolean; videoPosition?: number | null }[];
}

export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course-full', slug],
    queryFn: async () => {
      const { data } = await api.get<FullCourse>(`/courses/${slug}/full`);
      return data;
    },
    enabled: !!slug,
  });

  const { data: progressData } = useQuery({
    queryKey: ['progress', course?.id],
    queryFn: async () => {
      const { data } = await api.get<ProgressData>(`/enrollments/my/${course!.id}/progress`);
      return data;
    },
    enabled: !!course?.id,
  });

  const completedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const l of progressData?.lessons ?? []) m.set(l.lessonId, l.isCompleted);
    return m;
  }, [progressData]);

  const allLessons = useMemo(
    () => (course?.sections ?? []).flatMap((s) => s.lessons.map((l) => ({ ...l, sectionId: s.id }))),
    [course],
  );

  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [playerTab, setPlayerTab] = useState<'lesson' | 'discussion' | 'announcements' | 'notes'>('lesson');

  // Default: lesson pertama yang belum selesai (atau lesson pertama)
  useEffect(() => {
    if (!course || allLessons.length === 0) return;
    const stillValid = currentLessonId && allLessons.some((l) => l.id === currentLessonId);
    if (!stillValid) {
      const next = allLessons.find((l) => !completedMap.get(l.id)) ?? allLessons[0];
      setCurrentLessonId(next.id);
    }
  }, [course, allLessons, completedMap, currentLessonId]);

  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);
  const currentLesson = allLessons[currentIndex];

  const completeMutation = useMutation({
    mutationFn: (lesson: { sectionId: string; id: string }) =>
      api.post(`/sections/${lesson.sectionId}/lessons/${lesson.id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', course?.id] });
      toast('Pelajaran ditandai selesai');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-muted/40">
        <Skeleton className="h-14 w-full" />
        <div className="flex flex-1">
          <Skeleton className="hidden w-80 border-r lg:block" />
          <Skeleton className="flex-1" />
        </div>
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-foreground">Konten kursus tidak tersedia</p>
        <p className="mt-1 text-sm text-muted-foreground">Pastikan Anda sudah mendaftar kursus ini.</p>
        <Button className="mt-4" onClick={() => navigate('/courses')}>Kembali ke Katalog</Button>
      </div>
    );
  }

  const progress = progressData?.enrollment?.progress ?? 0;
  const isCurrentCompleted = currentLesson ? completedMap.get(currentLesson.id) : false;

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <button
          className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Menu pelajaran"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Link
          to={`/courses/${slug}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Detail Kursus</span>
        </Link>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-l border-border pl-3">
          <button
            onClick={() => setPlayerTab('lesson')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              playerTab === 'lesson'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Materi</span>
          </button>
          <button
            onClick={() => setPlayerTab('discussion')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              playerTab === 'discussion'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tanya Jawab</span>
          </button>
          <button
            onClick={() => setPlayerTab('announcements')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all',
              playerTab === 'announcements'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pengumuman</span>
          </button>
          <button
            onClick={() => setPlayerTab('notes')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
              playerTab === 'notes'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Catatan</span>
          </button>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="truncate text-xs font-medium text-foreground max-w-[140px] sm:max-w-xs">{course.title}</span>
          <div className="hidden w-36 sm:block">
            <Progress value={progress} size="sm" />
          </div>
          <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Lesson sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-80 overflow-y-auto border-r border-border bg-background pt-14 transition-transform lg:static lg:z-auto lg:pt-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="p-3">
            {course.sections.map((section, si) => (
              <div key={section.id} className="mb-3">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bagian {si + 1}: {section.title}
                </p>
                <ul>
                  {section.lessons.map((lesson) => {
                    const active = lesson.id === currentLessonId && playerTab === 'lesson';
                    const done = completedMap.get(lesson.id);
                    return (
                      <li key={lesson.id}>
                        <button
                          onClick={() => {
                            setCurrentLessonId(lesson.id);
                            setPlayerTab('lesson');
                            setSidebarOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-all',
                            active
                              ? 'bg-primary/10 font-semibold text-primary shadow-xs border-l-2 border-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                          )}
                          <span className="flex-1 truncate">{lesson.title}</span>
                          <span className="text-xs text-muted-foreground">{formatDuration(lesson.durationMinutes)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {playerTab === 'discussion' ? (
            <div className="mx-auto max-w-3xl p-4 sm:p-6">
              <DiscussionPanel courseId={course.id} canModerate={false} />
            </div>
          ) : playerTab === 'announcements' ? (
            <div className="mx-auto max-w-3xl p-4 sm:p-6">
              <AnnouncementPanel courseId={course.id} canManage={false} />
            </div>
          ) : playerTab === 'notes' ? (
            <NotesPanel courseId={course.id} lessonTitle={currentLesson?.title} />
          ) : currentLesson ? (
            <div className="mx-auto max-w-3xl p-4 sm:p-6">
              <LessonContent
                key={currentLesson.id}
                lesson={currentLesson}
                savedPositionSec={progressData?.lessons.find((p) => p.lessonId === currentLesson.id)?.videoPosition ?? null}
                isCompleted={!!isCurrentCompleted}
                onMarkComplete={() => completeMutation.mutate(currentLesson)}
              />

              {/* Mark complete */}
              <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4">
                {isCurrentCompleted ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    loading={completeMutation.isPending}
                    onClick={() => completeMutation.mutate(currentLesson)}
                  >
                    Tandai Selesai
                  </Button>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndex <= 0}
                    onClick={() => setCurrentLessonId(allLessons[currentIndex - 1].id)}
                  >
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentIndex >= allLessons.length - 1}
                    onClick={() => setCurrentLessonId(allLessons[currentIndex + 1].id)}
                  >
                    Berikutnya <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {progress >= 100 && (
                <Card className="mt-6 flex items-center gap-3 border-green-200 bg-green-50 p-4">
                  <Award className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Selamat! Kursus selesai.</p>
                    <p className="text-xs text-green-700">Anda telah menyelesaikan semua pelajaran.</p>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Pilih pelajaran untuk memulai.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function LessonContent({ lesson, savedPositionSec, isCompleted, onMarkComplete }: {
  lesson: FullCourse['sections'][number]['lessons'][number];
  savedPositionSec?: number | null;
  isCompleted: boolean;
  onMarkComplete: () => void;
}) {
  const content = lesson.content;

  if (lesson.type === 'text' && content?.textContent) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        {/* Konten dari pengajar (dipercaya sebagai HTML) */}
        <div className="space-y-3 text-sm leading-relaxed text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.textContent) }} />
        </div>
      </Card>
    );
  }

  if (lesson.type === 'document' && content?.documentUrl) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-4">
          <FileText className="h-8 w-8 text-primary-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{content.documentName ?? 'Dokumen'}</p>
            <p className="text-xs text-muted-foreground">Dokumen pelajaran</p>
          </div>
          <a href={content.documentUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">Buka Dokumen</Button>
          </a>
        </div>
      </Card>
    );
  }

  if (lesson.type === 'video') {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        {content?.videoUrl ? (
          <VideoPlayer
            src={content.videoUrl}
            lessonId={lesson.id}
            sectionId={lesson.sectionId!}
            savedPositionSec={savedPositionSec}
            onAutoComplete={() => { if (!isCompleted) onMarkComplete(); }}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md bg-slate-900">
            <div className="text-center text-white/70">
              <PlayCircle className="mx-auto mb-2 h-12 w-12" />
              <p className="text-sm">Belum ada video untuk pelajaran ini</p>
            </div>
          </div>
        )}
      </Card>
    );
  }

  if (lesson.type === 'zoom_link' && content?.zoomUrl) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-4">
          <p className="text-sm text-foreground">Sesi Zoom tersedia untuk diikuti.</p>
          <a href={content.zoomUrl} target="_blank" rel="noreferrer">
            <Button size="sm">Buka Sesi Zoom</Button>
          </a>
        </div>
      </Card>
    );
  }

  if (lesson.type === 'assignment') {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        {lesson.assignment ? (
          <AssignmentWidget lesson={lesson} assignment={lesson.assignment} />
        ) : content?.assignmentInstructions ? (
          <Card className="p-6">
            <div className="space-y-3 text-sm leading-relaxed text-foreground [&_li]:ml-4 [&_li]:list-disc [&_ul]:space-y-1">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.assignmentInstructions) }} />
            </div>
          </Card>
        ) : null}
      </div>
    );
  }

  if (lesson.type === 'quiz') {
    return (
      <div>
        <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
        {lesson.quiz ? (
          <QuizWidget quiz={lesson.quiz} />
        ) : (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Belum ada kuis untuk pelajaran ini.</p>
          </Card>
        )}
      </div>
    );
  }

  // fallback
  return (
    <Card className="p-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{lesson.title}</h1>
      <p className="text-sm text-muted-foreground">Konten pelajaran ini akan tersedia segera.</p>
    </Card>
  );
}

function NotesPanel({ courseId, lessonTitle }: { courseId: string; lessonTitle?: string }) {
  const storageKey = `course_notes_${courseId}`;
  const [notes, setNotes] = useState(() => localStorage.getItem(storageKey) || '');
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saved'>('idle');

  const handleChange = (val: string) => {
    setNotes(val);
    localStorage.setItem(storageKey, val);
    setSavedStatus('saved');
    setTimeout(() => setSavedStatus('idle'), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([notes], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catatan-kursus-${courseId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (window.confirm('Yakin ingin mengosongkan semua catatan kursus ini?')) {
      setNotes('');
      localStorage.removeItem(storageKey);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary-600" /> Catatan Belajar Pribadi
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lessonTitle ? `Materi saat ini: ${lessonTitle}` : 'Catat ringkasan dan konsep penting selama belajar.'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {savedStatus === 'saved' && (
            <span className="text-xs font-medium text-green-600">
              ✓ Tersimpan
            </span>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload} disabled={!notes.trim()}>
            <Download className="h-3.5 w-3.5" /> Unduh .txt
          </Button>
          <Button size="sm" variant="ghost" onClick={handleClear} disabled={!notes.trim()}>
            Kosongkan
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-2 shadow-xs">
        <textarea
          rows={14}
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Tulis catatan, ringkasan, atau rumus penting di sini. Catatan tersimpan otomatis di browser Anda..."
          className="w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        💡 Catatan disimpan secara lokal di perangkat Anda (zero-latency & privasi penuh). Setiap kali Anda kembali ke kursus ini, catatan akan otomatis dimuat.
      </p>
    </div>
  );
}
