import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" />
        Sebelumnya
      </button>

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium',
            p === page
              ? 'bg-primary-600 text-white'
              : 'border border-border text-foreground hover:bg-muted',
          )}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Berikutnya
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
