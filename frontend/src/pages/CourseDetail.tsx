import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Star, Users, Clock, BookOpen, CheckCircle2, PlayCircle, FileText,
  ChevronDown, Award, Globe, Megaphone, MessageSquare, Trash2,
} from 'lucide-react';
import { AnnouncementPanel } from '@/components/course/AnnouncementPanel';
import { DiscussionPanel } from '@/components/course/DiscussionPanel';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/useToast';
import { formatDuration, formatPrice, cn } from '@/lib/utils';
import type { CourseDetailData, EnrollmentItem, LessonMeta } from '@/types/api';

const levelLabel: Record<string, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Mahir',
  all_levels: 'Semua Level',
};

const typeIcon: Record<string, React.ReactNode> = {
  video: <PlayCircle className="h-4 w-4" />,
  text: <FileText className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  quiz: <CheckCircle2 className="h-4 w-4" />,
  zoom: <PlayCircle className="h-4 w-4" />,
  assignment: <FileText className="h-4 w-4" />,
};

type DetailTab = 'curriculum' | 'reviews' | 'announcements' | 'discussion';

export default function CourseDetail() {
  const { slug } = useParams<{ slug: string }>();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<DetailTab>('curriculum');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course', slug],
    queryFn: async () => {
      const { data } = await api.get<CourseDetailData>(`/courses/${slug}`);
      return data;
    },
    enabled: !!slug,
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ['enrollments', 'my'],
    queryFn: async () => {
      const { data } = await api.get<{ data: EnrollmentItem[] }>('/enrollments/my');
      return data.data;
    },
    enabled: !!token,
  });

  const enrollment = myEnrollments?.find((e) => e.courseId === course?.id);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/enrollments/courses/${course!.id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      toast('Berhasil mendaftar kursus!');
      navigate(`/courses/${slug}/learn`);
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal mendaftar kursus', 'error');
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/courses/${course!.id}/reviews`, {
        rating: reviewRating,
        review: reviewText.trim() || undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course', slug] });
      toast(data?.message ?? 'Ulasan berhasil dikirim!');
      setReviewText('');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal mengirim ulasan', 'error');
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { data } = await api.delete(`/courses/${course!.id}/reviews/${reviewId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', slug] });
      toast('Ulasan berhasil dihapus');
    },
    onError: (err: any) => {
      toast(err.response?.data?.error ?? 'Gagal menghapus ulasan', 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <Skeleton className="mb-6 h-40 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium text-foreground">Kursus tidak ditemukan</p>
        <Link to="/courses" className="mt-4 text-sm text-primary-600 hover:underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  const totalLessons = course.sections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalMinutes = course.sections.reduce(
    (acc, s) => acc + s.lessons.reduce((la, l) => la + l.durationMinutes, 0),
    0,
  );

  const existingUserReview = course.reviews?.find((r) => r.author.id === user?.id);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Hero */}
      <div className="bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Link to="/courses" className="text-sm text-primary-600 hover:underline">
            ← Katalog Kursus
          </Link>
          <div className="mt-4 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                {course.category && (
                  <Badge variant="outline">{course.category.name}</Badge>
                )}
                <Badge variant="outline">{levelLabel[course.level] ?? course.level}</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{course.title}</h1>
              <p className="mt-3 text-base text-muted-foreground">{course.description}</p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {course.averageRating > 0 ? (
                    <>
                      <span className="font-semibold text-foreground">{course.averageRating.toFixed(1)}</span>
                      ({course.totalReviews} ulasan)
                    </>
                  ) : (
                    'Belum ada ulasan'
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {course.totalEnrolled} peserta
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {formatDuration(totalMinutes)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Bahasa Indonesia
                </span>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                Diampu oleh{' '}
                <span className="font-medium text-foreground">{course.instructor.name}</span>
              </p>
            </div>

            {/* Enroll panel */}
            <Card className="h-fit p-5 lg:sticky lg:top-6">
              <div className="flex h-36 items-center justify-center rounded-md bg-primary-50">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full rounded-md object-cover" />
                ) : (
                  <BookOpen className="h-12 w-12 text-primary-300" />
                )}
              </div>

              <p className="mt-4 text-2xl font-bold text-foreground">{formatPrice(course.price)}</p>

              <div className="mt-4">
                {enrollment ? (
                  <Button className="w-full" onClick={() => navigate(`/courses/${slug}/learn`)}>
                    Lanjut Belajar
                  </Button>
                ) : token ? (
                  <Button className="w-full" loading={enrollMutation.isPending} onClick={() => enrollMutation.mutate()}>
                    Daftar Sekarang
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => navigate('/login', { state: { from: `/courses/${slug}` } })}>
                    Masuk untuk Mendaftar
                  </Button>
                )}
              </div>

              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> {totalLessons} pelajaran
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {course.estimatedHours} jam estimasi
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant="outline">{levelLabel[course.level] ?? course.level}</Badge>
                </li>
                {course.certificateEnabled && (
                  <li className="flex items-center gap-2">
                    <Award className="h-4 w-4" /> Sertifikat penyelesaian
                  </li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6">
          <button
            onClick={() => setTab('curriculum')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === 'curriculum'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="h-4 w-4" /> Kurikulum
          </button>
          <button
            onClick={() => setTab('reviews')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === 'reviews'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className="h-4 w-4" /> Ulasan ({course.totalReviews})
          </button>
          {enrollment && (
            <>
              <button
                onClick={() => setTab('announcements')}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  tab === 'announcements'
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Megaphone className="h-4 w-4" /> Pengumuman
              </button>
              <button
                onClick={() => setTab('discussion')}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  tab === 'discussion'
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <MessageSquare className="h-4 w-4" /> Diskusi
              </button>
            </>
          )}
        </div>
      </div>

      {/* Curriculum + info */}
      {tab === 'curriculum' && (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <div className="border-b border-border p-4">
                <h2 className="text-base font-semibold text-foreground">Kurikulum Kursus</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {course.sections.length} bagian • {totalLessons} pelajaran • {formatDuration(totalMinutes)}
                </p>
              </div>
              <div className="divide-y divide-border">
                {course.sections.map((section, i) => (
                  <CurriculumSection key={section.id} index={i + 1} section={section} />
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {course.learningOutcomes.length > 0 && (
              <Card className="p-5">
                <h3 className="text-base font-semibold text-foreground">Yang Akan Anda Pelajari</h3>
                <ul className="mt-3 space-y-2">
                  {course.learningOutcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                      {o}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="text-base font-semibold text-foreground">Pengajar</h3>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
                  {course.instructor.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{course.instructor.name}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
      )}

      {/* Reviews Tab */}
      {tab === 'reviews' && (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="text-center sm:text-left">
                  <p className="text-5xl font-extrabold text-foreground">{course.averageRating.toFixed(1)}</p>
                  <div className="mt-2 flex justify-center gap-1 sm:justify-start">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-5 w-5',
                          s <= Math.round(course.averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground/30',
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{course.totalReviews} ulasan total</p>
                </div>

                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const countForStar = course.ratingDistribution?.[stars] ?? 0;
                    const pct = course.totalReviews > 0 ? (countForStar / course.totalReviews) * 100 : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="w-12 text-right">{stars} bintang</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-8">{countForStar}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {enrollment && (
              <Card className="p-6">
                <h3 className="text-base font-semibold text-foreground">
                  {existingUserReview ? 'Perbarui Ulasan Anda' : 'Tulis Ulasan Kursus'}
                </h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Beri Penilaian</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 text-muted-foreground/40 transition-colors hover:text-yellow-400"
                        >
                          <Star
                            className={cn(
                              'h-6 w-6',
                              star <= reviewRating ? 'fill-yellow-400 text-yellow-400' : '',
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    label="Ulasan Anda (opsional)"
                    rows={3}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />
                  <Button
                    loading={submitReviewMutation.isPending}
                    onClick={() => submitReviewMutation.mutate()}
                  >
                    {existingUserReview ? 'Perbarui Ulasan' : 'Kirim Ulasan'}
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Semua Ulasan</h3>
              {(!course.reviews || course.reviews.length === 0) ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">Belum ada ulasan.</Card>
              ) : (
                course.reviews.map((rev) => (
                  <Card key={rev.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700">
                          {rev.author.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{rev.author.name}</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={cn(
                                  'h-3.5 w-3.5',
                                  s <= rev.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      {(user?.id === rev.author.id || user?.role === 'admin') && (
                        <button
                          onClick={() => { if (window.confirm('Hapus ulasan ini?')) deleteReviewMutation.mutate(rev.id); }}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {rev.review && <p className="mt-3 text-sm text-foreground/90 pl-13">{rev.review}</p>}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {enrollment && tab === 'announcements' && (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <AnnouncementPanel courseId={course.id} canManage={user?.role === 'admin' || course.instructorId === user?.id} />
        </div>
      )}

      {enrollment && tab === 'discussion' && (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <DiscussionPanel courseId={course.id} canModerate={user?.role === 'admin' || course.instructorId === user?.id} />
        </div>
      )}
    </div>
  );
}

function CurriculumSection({ section, index }: { section: CourseDetailData['sections'][number]; index: number }) {
  const [open, setOpen] = useState(true);
  const totalMin = section.lessons.reduce((a, l) => a + l.durationMinutes, 0);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">
            {index}. {section.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {section.lessons.length} pelajaran • {formatDuration(totalMin)}
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <ul className="border-t border-border bg-muted/30">
          {section.lessons.map((lesson) => (
            <LessonRow key={lesson.id} lesson={lesson} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LessonRow({ lesson }: { lesson: LessonMeta }) {
  return (
    <li className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{typeIcon[lesson.type]}</span>
      <span className="flex-1 truncate text-foreground">{lesson.title}</span>
      {lesson.isFreePreview && <Badge variant="success">Gratis</Badge>}
      <span className="text-xs text-muted-foreground">{formatDuration(lesson.durationMinutes)}</span>
    </li>
  );
}
