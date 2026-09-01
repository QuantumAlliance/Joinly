/**
 * Status treatments, matched to the frames.
 *
 * Three distinct shapes appear in the design and they are not interchangeable:
 *  - `pill`   rounded chip with a leading dot — Users table
 *  - `plain`  chip with no dot — Categories, Recent Users
 *  - `text`   coloured label with a leading dot, no chip — User Details tables
 */
import type { ActivityStatus, CategoryStatus, NotificationStatus, UserStatus } from '../app/api/types';

export type AnyStatus =
  | UserStatus
  | ActivityStatus
  | CategoryStatus
  | NotificationStatus
  /** The User Details history table relabels Approved activities. */
  | 'Upcoming';

/**
 * bg / fg / dot per tone, sampled from the frames. `textFg` is the deeper
 * colour the chip-less `text` variant uses in the User Details tables.
 */
const TONE: Record<string, { bg: string; fg: string; dot: string; textFg: string }> = {
  positive: { bg: 'bg-ok-bg', fg: 'text-ok-fg', dot: 'bg-accent', textFg: 'text-action' },
  /** Dashboard's Recent Users table draws Active in the blue tint instead. */
  brand: { bg: 'bg-brand-tint', fg: 'text-brand', dot: 'bg-brand', textFg: 'text-brand' },
  warn: { bg: 'bg-warn-bg', fg: 'text-warn-fg', dot: 'bg-warn-fg', textFg: 'text-warn-fg' },
  danger: { bg: 'bg-[#ff5c5c1f]', fg: 'text-danger', dot: 'bg-danger', textFg: 'text-danger' },
  neutral: { bg: 'bg-head-bg', fg: 'text-muted', dot: 'bg-muted', textFg: 'text-body' },
};

function toneFor(status: AnyStatus): keyof typeof TONE {
  switch (status) {
    case 'Active':
    case 'Approved':
    case 'Completed':
    case 'Delivered':
    case 'Upcoming':
      return 'positive';
    case 'Pending':
    case 'Draft':
      return 'warn';
    case 'Suspended':
    case 'Blocked':
    case 'Rejected':
    case 'Failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function StatusBadge({
  status,
  variant = 'pill',
  uppercase = false,
  tone: toneOverride,
  className = '',
}: {
  status: AnyStatus;
  variant?: 'pill' | 'plain' | 'text';
  uppercase?: boolean;
  /** Forces a palette — used where a frame colours the same status differently. */
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const key = toneFor(status);
  const tone = TONE[toneOverride && key === 'positive' ? toneOverride : key];
  const label = uppercase ? status.toUpperCase() : status;

  if (variant === 'text') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${tone.textFg} ${className}`}>
        <span className={`size-1.5 rounded-full ${tone.dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-medium ${tone.bg} ${tone.fg} ${className}`}
    >
      {variant === 'pill' && <span className={`size-2 rounded-full ${tone.dot}`} />}
      {label}
    </span>
  );
}

/** The soft-mint chip used for category names and interests. */
export function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-tag-bg px-2 py-1 text-xs font-medium text-muted ${className}`}
    >
      {children}
    </span>
  );
}
