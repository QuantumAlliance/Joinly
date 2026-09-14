/**
 * Activities — `Dashboard figma design/Users-1.svg` (Pending),
 * `Users-5.svg` (Approved) and `Users-6.svg` (Rejected).
 *
 * A segmented status control and a category select above a three-up card grid.
 * Pending cards get Approve + reject; already-decided cards get a single
 * full-width Delete button. The footer sits on the page, outside any card.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronDown, MapPin, X } from 'lucide-react';
import {
  useDeleteActivityMutation,
  useGetActiveCategoriesQuery,
  useGetActivitiesQuery,
  useUpdateActivityStatusMutation,
} from '../app/api/apiSlice';
import type { ActivityCard as ActivityCardType, ActivityStatus } from '../app/api/types';
import ApiError from '../components/ApiError';
import Avatar from '../components/Avatar';
import Thumb from '../components/Thumb';
import { useTopbar } from '../layouts/topbar';
import { formatDateTime } from '../lib/format';

const TABS: Array<{ value: Extract<ActivityStatus, 'Pending' | 'Approved' | 'Rejected'>; label: string }> = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

const PAGE_SIZE = 6;

/** The status chip sits inline to the right of the card title. */
const CHIP: Record<string, string> = {
  Pending: 'bg-chip-pending-bg text-chip-pending-fg',
  Approved: 'bg-chip-active-bg text-chip-active-fg',
  Rejected: 'bg-chip-rejected-bg text-chip-rejected-fg',
};

/** "Approved" reads as ACTIVE on the card, as drawn in the frame. */
const chipLabel = (status: ActivityStatus) => (status === 'Approved' ? 'ACTIVE' : status.toUpperCase());

function ActivityCard({
  activity,
  onApprove,
  onReject,
  onDelete,
}: {
  activity: ActivityCardType;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const pending = activity.status === 'Pending';

  return (
    <article className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <div className="relative h-[195px] bg-track">
        <Link to={`/activities/${activity.id}`}>
          <Thumb src={activity.activityPhoto} alt={activity.activityName} className="size-full" />
        </Link>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 py-1.5 pr-3 pl-2.5 text-sm font-medium text-ok-fg">
          <MapPin size={14} />
          {activity.categoryName}
        </span>
      </div>

      <div className="space-y-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/activities/${activity.id}`}
            className="text-base leading-snug text-ink-strong hover:text-action"
          >
            {activity.activityName}
          </Link>
          <span
            className={`shrink-0 rounded px-2 py-1 text-[11px] font-semibold tracking-[0.03em] ${
              CHIP[activity.status] ?? 'bg-head-bg text-muted'
            }`}
          >
            {chipLabel(activity.status)}
          </span>
        </div>

        <p className="flex items-center gap-2 text-sm text-body">
          <Avatar
            src={activity.organizer.profilePhoto}
            firstName={activity.organizer.firstName}
            lastName={activity.organizer.lastName}
            size={24}
          />
          Organizer: {activity.organizer.firstName} {activity.organizer.lastName}
        </p>

        <p className="flex items-center gap-2 text-sm text-body">
          <CalendarDays size={16} className="text-muted" />
          {formatDateTime(activity.activityDate, activity.activityTime)}
        </p>

        {pending ? (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onApprove}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-field bg-action text-base font-medium text-white hover:bg-action-hover"
            >
              <CheckCircle2 size={18} />
              Approve
            </button>
            <button
              type="button"
              aria-label="Reject activity"
              onClick={onReject}
              className="grid size-12 shrink-0 place-items-center rounded-field bg-reject-bg text-reject-fg"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="h-12 w-full rounded-field bg-action text-base font-medium text-white hover:bg-action-hover"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

export default function Activities() {
  useTopbar({ title: 'Activities' });

  const [status, setStatus] = useState<ActivityStatus>('Pending');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  const { data: categories } = useGetActiveCategoriesQuery();
  const { data, isError, refetch } = useGetActivitiesQuery({
    page,
    limit: PAGE_SIZE,
    status,
    categoryId: categoryId || undefined,
  });
  const [updateActivityStatus] = useUpdateActivityStatusMutation();
  const [deleteActivity] = useDeleteActivityMutation();

  const activities = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex h-12 items-center rounded-field bg-track p-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`h-10 w-[110px] rounded-lg text-base transition-colors ${
                status === tab.value ? 'bg-card text-action shadow-card' : 'text-body'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="relative">
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="h-12 w-[166px] appearance-none rounded-field border border-line bg-card pr-10 pl-4 text-base text-body outline-none"
          >
            <option value="">All Categories</option>
            {(categories?.data ?? []).map((category) => (
              <option key={category.id} value={category.categoryName}>
                {category.categoryName}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
          />
        </label>
      </div>

      {isError ? (
        <ApiError what="activities" onRetry={() => refetch()} />
      ) : activities.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No {status.toLowerCase()} activities.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onApprove={() => updateActivityStatus({ id: activity.id, status: 'Approved' })}
              onReject={() => updateActivityStatus({ id: activity.id, status: 'Rejected' })}
              onDelete={() => deleteActivity(activity.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <p className="text-base text-body">
          Showing <span className="font-medium text-ink-strong">{activities.length}</span> of{' '}
          <span className="font-medium text-ink-strong">{meta?.total ?? 0}</span>{' '}
          {status.toLowerCase()} activities
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="h-11 rounded-field px-6 text-base text-muted disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="h-11 rounded-field bg-action px-7 text-base font-medium text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
