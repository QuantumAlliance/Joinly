import { AlertTriangle } from 'lucide-react';

/**
 * Shown when a query fails, so an API outage does not render as an innocent
 * "nothing here yet" empty state. Every list screen used to treat `error` as
 * an empty result, which made a dead API look like a quiet week.
 */
export default function ApiError({
  what = 'this data',
  onRetry,
}: {
  what?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-warn-bg text-warn-fg">
        <AlertTriangle size={18} />
      </span>
      <div>
        <p className="text-base font-medium text-ink-strong">Could not load {what}.</p>
        <p className="mt-1 text-sm text-muted">
          The API did not answer. Check that it is running, then try again.
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 h-10 rounded-full bg-action px-5 text-sm font-medium text-white hover:bg-action-hover"
        >
          Try again
        </button>
      )}
    </div>
  );
}
