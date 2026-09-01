/**
 * Display formatters.
 *
 * The frames use US-style short dates ("Oct 12, 2023") and 12-hour times
 * ("10:00 AM") everywhere — never ISO, and never with seconds.
 */

/** "2023-10-12" → "Oct 12, 2023". Passes unparseable input through unchanged. */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** "10:00" or "10:00:00" → "10:00 AM". */
export function formatTime(value?: string | null): string {
  if (!value) return '';
  const [hourPart, minutePart = '00'] = value.split(':');
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minutePart.padStart(2, '0')} ${suffix}`;
}

/** "Oct 24, 2023 • 10:00 AM", as drawn on the activity cards. */
export function formatDateTime(date?: string | null, time?: string | null): string {
  const parts = [formatDate(date), formatTime(time)].filter(Boolean);
  return parts.join(' • ');
}

/** 15 → "$15.00"; null/0 → "Free". */
export function formatPrice(value?: number | null): string {
  if (!value) return 'Free';
  return `$${value.toFixed(2)}`;
}
