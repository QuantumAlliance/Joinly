import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Numbered pager as drawn on Users and Categories.
 *
 * The Users frame runs to 58 pages and renders `‹ 1 2 3 … 58 ›`, so the window
 * always shows the first pages, an ellipsis, and the last page.
 */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const pages = new Set<number>([1, totalPages, page]);
  // Keep a run of three around the front when we're near the start, matching
  // the frame's "1 2 3 … 58".
  if (page <= 3) [2, 3].forEach((p) => pages.add(p));
  else if (page >= totalPages - 2) [totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  else [page - 1, page + 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const CHIP = 'grid h-[42px] min-w-[42px] place-items-center rounded-lg text-sm font-medium';

export default function Pagination({
  page,
  totalPages,
  onChange,
  className = '',
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={`${CHIP} min-w-6 border border-field px-2 text-muted disabled:opacity-40`}
      >
        <ChevronLeft size={16} />
      </button>

      {pageWindow(page, totalPages).map((entry, i) =>
        entry === 'gap' ? (
          <span key={`gap-${i}`} className="grid h-[42px] w-6 place-items-center text-sm text-muted">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            aria-current={entry === page ? 'page' : undefined}
            onClick={() => onChange(entry)}
            className={
              entry === page
                ? `${CHIP} bg-action text-white`
                : `${CHIP} border border-field text-body hover:bg-head-bg`
            }
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        aria-label="Next page"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={`${CHIP} min-w-6 border border-field px-2 text-muted disabled:opacity-40`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
