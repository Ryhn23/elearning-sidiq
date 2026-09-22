import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, Users, Clock, BookOpen } from 'lucide-react';
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
    if (key !== 'page') next.delete('page'); // reset halaman saat filter berubah
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
    <div className="min-h-screen flex flex-col bg-muted/40">
      <div className="flex-1">
      {/* Hero */}
      <div className="bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Temukan Kursusmu</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Jelajahi kursus berkualitas dari pengajar berpengalaman.
          </p>

          {/* Search */}
          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParam('search', e.target.value);
              }}
              placeholder="Cari kursus, topik, atau pengajar..."
              className="h-11 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={category}
              onChange={(e) => setParam('category', e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary-500 focus:outline-none"
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
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary-500 focus:outline-none"
            >
              <option value="">Semua Level</option>
              <option value="beginner">Pemula</option>
              <option value="intermediate">Menengah</option>
              <option value="advanced">Mahir</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-primary-500 focus:outline-none"
            >
              <option value="newest">Terbaru</option>
              <option value="popular">Paling Populer</option>
              <option value="rating">Rating Tertinggi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="mb-4 h-36 w-full" />
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">Kursus tidak ditemukan</p>
            <p className="mt-1 text-sm text-muted-foreground">Coba ubah kata kunci atau filter Anda.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
            {pagination && (
              <div className="mt-8">
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
    <Link to={`/courses/${course.slug}`} className="group block">
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md">
        {/* Thumbnail */}
        <div className="relative flex h-36 items-center justify-center bg-primary-50">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt={course.title} className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="h-10 w-10 text-primary-300" />
          )}
          {course.category && (
            <Badge variant="primary" className="absolute left-3 top-3">
              {course.category.name}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground group-hover:text-primary-700">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground">{course.instructor.name}</p>

          <div className="mt-auto flex items-center gap-4 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
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

          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <Badge variant="outline">{levelLabel[course.level] ?? course.level}</Badge>
            <span className="text-sm font-semibold text-foreground">{formatPrice(course.price)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
