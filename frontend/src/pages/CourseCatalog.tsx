import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, Users, Clock, BookOpen, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { formatPrice } from '@/lib/utils';
import { Footer } from '@/components/layout/Footer';
import type { CourseListItem, PaginationMeta } from '@/types/api';

const levelLabel: Record<string, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Mahir',
  all_levels: 'Semua Level',
};

interface CatalogResponse {
  data: CourseListItem[];
  pagination: PaginationMeta;
}

export default function CourseCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const page = Number(searchParams.get('page') ?? '1');
  const category = searchParams.get('category') ?? '';
  const level = searchParams.get('level') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['courses', { search, page, category, level, sort }],
    queryFn: async () => {
      const { data } = await api.get<CatalogResponse>('/courses', {
        params: {
          search: search || undefined,
          page,
          limit: 9,
          category: category || undefined,
          level: level || undefined,
          sort,
        },
      });
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<any[]>('/categories');
      return data;
    },
  });

  const courses = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1">
        {/* Hero */}
        <div className="bg-background border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Temukan Kursus Pilihan
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Jelajahi materi berkualitas dan terstruktur dari ustadz serta pengajar berpengalaman.
              </p>
            </div>

            {/* Search */}
            <div className="relative mt-6 max-w-xl">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setParam('search', e.target.value);
                }}
                placeholder="Cari materi, judul kursus, atau ustadz pengajar..."
                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Filters */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
                <Layers className="h-3.5 w-3.5" /> Filter:
              </div>
              <select
                value={category}
                onChange={(e) => setParam('category', e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Semua Kategori</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={level}
                onChange={(e) => setParam('level', e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none transition-colors"
              >
                <option value="">Semua Tingkat</option>
                <option value="beginner">Pemula</option>
                <option value="intermediate">Menengah</option>
                <option value="advanced">Mahir</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none transition-colors"
              >
                <option value="newest">Terbaru</option>
                <option value="popular">Paling Populer</option>
                <option value="rating">Rating Tertinggi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Course Grid */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 rounded-xl">
                  <Skeleton className="mb-4 h-40 w-full rounded-lg" />
                  <Skeleton className="mb-2 h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <BookOpen className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-foreground">Kursus tidak ditemukan</p>
              <p className="mt-1 text-sm text-muted-foreground">Coba ubah kata kunci pencarian atau sesuaikan filter Anda.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
              {pagination && (
                <div className="mt-10">
                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={(p) => setParam('page', String(p))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function CourseCard({ course }: { course: CourseListItem }) {
  return (
    <Link to={`/courses/${course.slug}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-primary-50/50 dark:bg-primary-950/20">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-primary-300">
              <BookOpen className="h-10 w-10" />
            </div>
          )}
          {course.category && (
            <Badge variant="primary" className="absolute left-3 top-3 shadow-xs">
              {course.category.name}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="line-clamp-2 text-base font-bold text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>
          <p className="text-xs font-medium text-muted-foreground">
            {course.instructor.name}
          </p>

          <div className="mt-auto flex items-center gap-4 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              {course.averageRating > 0 ? course.averageRating.toFixed(1) : 'Baru'}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {course.totalEnrolled}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {course.estimatedHours} jam
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <Badge variant="outline" className="text-[11px] capitalize">
              {levelLabel[course.level] ?? course.level}
            </Badge>
            <span className="text-sm font-bold text-foreground">
              {formatPrice(course.price)}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
