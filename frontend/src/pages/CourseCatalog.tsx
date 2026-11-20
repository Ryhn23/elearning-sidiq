import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, Users, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { formatPrice } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import type { CourseListItem, PaginationMeta } from '@/types/api';

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
          limit: 12,
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
    <div className="space-y-6 w-full pb-10">
      {/* Standard Page Header */}
      <PageHeader
        title="Katalog Kursus & Materi Pembelajaran"
        subtitle="Jelajahi modul silabus berkualitas dari ustadz dan pengajar berpengalaman Pesantren SIDIQ."
        icon={BookOpen}
      />

      {/* Hero Filter Bar */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-emerald-500/5 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setParam('search', e.target.value);
              }}
              placeholder="Cari materi, judul kursus, atau nama pengajar..."
              className="pl-9 rounded-xl bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={category}
              onChange={(e) => setParam('category', e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary transition-colors"
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
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary transition-colors"
            >
              <option value="">Semua Tingkatan</option>
              <option value="beginner">Pemula</option>
              <option value="intermediate">Menengah</option>
              <option value="advanced">Mahir</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:border-primary transition-colors"
            >
              <option value="newest">Terbaru</option>
              <option value="popular">Terpopuler</option>
              <option value="rating">Rating Tertinggi</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            onClick={() => setParam('category', '')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              category === ''
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            Semua
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => setParam('category', c.slug)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                category === c.slug
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Courses Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="rounded-2xl overflow-hidden border border-border p-4 space-y-3">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card className="rounded-2xl p-12 text-center border-dashed">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">Tidak ada kursus ditemukan</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Coba gunakan kata kunci lain atau ubah filter kategori di atas.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch('');
              setParam('search', '');
              setParam('category', '');
              setParam('level', '');
            }}
          >
            Reset Semua Filter
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((c) => (
            <Link key={c.id} to={`/courses/${c.slug}`} className="group block">
              <Card className="h-full rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 overflow-hidden flex flex-col group-hover:-translate-y-1">
                {/* Thumbnail */}
                <div className="relative aspect-video w-full overflow-hidden bg-primary/10">
                  {c.thumbnailUrl ? (
                    <img
                      src={c.thumbnailUrl}
                      alt={c.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-10 w-10 text-primary/40" />
                    </div>
                  )}
                  {c.category && (
                    <Badge className="absolute left-2.5 top-2.5 bg-background/80 backdrop-blur-md text-foreground border-border text-[10px] font-semibold">
                      {c.category.name}
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <span>{c.instructor.name}</span>
                    </p>
                    <h3 className="font-bold text-foreground text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {c.title}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-semibold text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{Number(c.averageRating).toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{c.totalEnrolled} santri</span>
                    </div>
                    <div className="font-bold text-primary">
                      {c.price === 0 ? 'Gratis' : formatPrice(c.price)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pt-4 flex justify-center">
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(p) => setParam('page', String(p))}
          />
        </div>
      )}
    </div>
  );
}
