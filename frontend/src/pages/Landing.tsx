import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Video,
  Award,
  Users,
  MessageSquare,
  Clock,
  Star,
  GraduationCap,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Footer } from '@/components/layout/Footer';

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  level: string;
  price: number;
  averageRating: number | null;
  reviewCount: number;
  totalEnrolled: number;
  instructor: { id: string; name: string };
  category: { id: string; name: string } | null;
}

export default function Landing() {
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['landing-featured-courses'],
    queryFn: async () => {
      const res = await api.get<{ data: CourseItem[] }>('/courses?limit=3');
      return res.data;
    },
  });

  const featuredCourses = coursesData?.data ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              E-Learning<span className="text-primary-600">.</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/courses" className="hover:text-foreground transition-colors">
              Katalog Kursus
            </Link>
            <Link to="/verify/demo" className="hover:text-foreground transition-colors">
              Verifikasi Sertifikat
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Masuk
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">
                Daftar Sekarang
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-50/40 via-background to-background py-16 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.25),rgba(0,0,0,0))] pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/70 px-3.5 py-1 text-xs font-semibold text-primary-700 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300">
            <Sparkles className="h-3.5 w-3.5 text-primary-500" />
            Platform LMS Terinspirasi Standar Moodle
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Tingkatkan Keterampilanmu dengan{' '}
            <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-sky-400 bg-clip-text text-transparent">
              Pembelajaran Terstruktur
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Akses video berkualitas, kuis terstandar, tugas mandiri berbobot, dan dapatkan sertifikat digital resmi dengan kode verifikasi QR.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/courses" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 shadow-sm">
                Jelajahi Katalog Kursus <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/register" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full">
                Mulai Belajar Gratis
              </Button>
            </Link>
          </div>

          {/* Highlights Mini Banner */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-border/80 pt-8 sm:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-foreground">500+</p>
              <p className="text-xs text-muted-foreground mt-0.5">Siswa Terdaftar</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">100%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Fleksibel & Mandiri</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">Otomatis</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sertifikat Kelulusan QR</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">Zoom Ready</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sesi Tatap Muka</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-16 sm:py-20 border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Pengalaman Belajar Digital yang Komprehensif
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Semua alat pembelajaran penting disatukan dalam satu antarmuka yang bersih, cepat, dan responsif.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Pemutar Video Pintar</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Resume otomatis dari detik terakhir, kendali kecepatan putar (0.5x hingga 2x), dan deteksi kelulusan otomatis setelah 80% durasi ditonton.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Kuis & Ujian Terukur</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Pilihan ganda dan essay dengan batas waktu, pengacakan opsi, penilaian instan, dan batas percobaan kuis terstandar.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Pengumpulan Tugas Mandiri</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Kirim file tugas (PDF, dokumen, kode) dengan batas tanggal (due date), sistem penilaian instruktur, dan feedback mendalam.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Sertifikat Resmi & QR Code</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Terbit otomatis saat progres mencapai 100%. Dilengkapi nomor seri unik dan link verifikasi publik yang dapat dibagikan ke LinkedIn atau CV.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Diskusi & Tanya Jawab</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Forum interaktif terpasang di pemutar kursus. Bertanya langsung pada instruktur atau berdiskusi dengan sesama rekan belajar.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">Kelas Sinkron via Zoom</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Integrasi jadwal tatap muka daring dengan penghitung mundur (countdown) waktu nyata dan tautan masuk langsung sekali klik.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="py-16 sm:py-20 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Kursus Terpopuler
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mulai dari kursus pilihan yang paling banyak dipelajari siswa kami.
              </p>
            </div>
            <Link to="/courses">
              <Button variant="outline" size="sm" className="gap-1">
                Lihat Semua Kursus <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coursesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-44 w-full" />
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </Card>
              ))
            ) : featuredCourses.length > 0 ? (
              featuredCourses.map((c) => (
                <Card key={c.id} className="overflow-hidden flex flex-col group transition-all hover:shadow-md">
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    {c.thumbnailUrl ? (
                      <img
                        src={c.thumbnailUrl}
                        alt={c.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                        <BookOpen className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      <Badge variant="outline" className="bg-background/90 backdrop-blur-xs text-xs font-semibold capitalize">
                        {c.level}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="flex flex-1 flex-col p-5">
                    {c.category && (
                      <p className="text-xs font-medium text-primary-600 mb-1">
                        {c.category.name}
                      </p>
                    )}
                    <h3 className="text-base font-bold text-foreground line-clamp-2 group-hover:text-primary-600 transition-colors">
                      {c.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2 flex-1">
                      {c.shortDescription || 'Materi lengkap terstruktur untuk menguasai kompetensi secara komprehensif.'}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        <span className="font-semibold text-foreground">
                          {c.averageRating ? c.averageRating.toFixed(1) : '5.0'}
                        </span>
                        <span>({c.reviewCount})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{c.totalEnrolled} siswa</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link to={`/courses/${c.slug}`}>
                        <Button className="w-full" size="sm">
                          Lihat Detail Kursus
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 py-10 text-center text-muted-foreground text-sm">
                Belum ada kursus publik yang ditampilkan.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Instructor Invitation Section */}
      <section className="py-16 bg-muted/30 border-b border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xs">
            <div className="space-y-3 text-center md:text-left">
              <Badge variant="primary">Untuk Pengajar & Instruktur</Badge>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Ingin Mengajar di Platform Kami?
              </h2>
              <p className="text-sm text-muted-foreground max-w-xl">
                Buat kurikulum modular, unggah materi video, rancang kuis penilaian, dan pantau rekap nilai siswa (Gradebook) dengan mudah.
              </p>
            </div>
            <Link to="/register">
              <Button size="lg" className="shrink-0 gap-2">
                Daftar Sebagai Pengajar <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
