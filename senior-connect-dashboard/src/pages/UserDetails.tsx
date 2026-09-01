/**
 * User Details — `Dashboard figma design/Users-8.svg`.
 *
 * Identity card + two stat tiles down the left, Account Status and Interests
 * down the right, then a tabbed activity history whose statuses are plain
 * coloured labels rather than pills.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Ban, BadgeCheck, ArrowRight, HandHeart, MapPin, MoreVertical, Pencil } from 'lucide-react';
import { useGetUserDetailsQuery, useUpdateUserStatusMutation } from '../app/api/apiSlice';
import type { ActivityStatus } from '../app/api/types';
import Card from '../components/Card';
import Thumb from '../components/Thumb';
import StatusBadge, { Tag } from '../components/StatusBadge';
import type { AnyStatus } from '../components/StatusBadge';
import { useTopbar } from '../layouts/topbar';
import { formatDate } from '../lib/format';

/** The history table shows Approved activities as "Upcoming". */
const historyStatus = (status: ActivityStatus): AnyStatus => (status === 'Approved' ? 'Upcoming' : status);

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof HandHeart;
}) {
  return (
    <Card className="relative h-[130px] overflow-hidden">
      {/* Oversized watermark bleeding off the top-right corner, as drawn. */}
      <Icon
        size={86}
        strokeWidth={1.25}
        className="pointer-events-none absolute -top-2 -right-2 text-line"
        aria-hidden
      />
      <div className="relative flex h-full flex-col justify-center gap-2">
        <span className="text-xs font-medium tracking-[0.06em] text-muted uppercase">{label}</span>
        <span className="text-[38px] leading-none font-bold text-action">{value}</span>
      </div>
    </Card>
  );
}

export default function UserDetails() {
  const { userId = '' } = useParams();
  const [tab, setTab] = useState<'joined' | 'created'>('joined');
  const { data } = useGetUserDetailsQuery(userId, { skip: !userId });
  const [updateUserStatus] = useUpdateUserStatusMutation();

  useTopbar({ title: 'User Details', backTo: '/users' });

  const user = data?.data;
  if (!user) return <p className="text-sm text-muted">Loading user…</p>;

  const blocked = user.status === 'Blocked' || user.status === 'Suspended';
  const rows = tab === 'joined' ? user.joinedActivities : user.createdActivities;
  const place = [user.city, user.region].filter(Boolean).join(', ') || user.country || '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_304px] gap-6">
        {/* Identity */}
        <Card className="flex gap-6">
          <div className="relative shrink-0">
            <Thumb
              src={user.profilePhoto}
              alt={`${user.firstName} ${user.lastName}`}
              className="size-[156px] rounded-[20px] border-2 border-accent"
            />
            <BadgeCheck
              size={34}
              className="absolute -right-2 -bottom-2 rounded-full bg-action fill-action text-white"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[28px] leading-tight font-bold text-ink">
                  {user.firstName} {user.lastName}
                </h2>
                <p className="mt-1.5 flex items-center gap-1.5 text-base text-muted">
                  <MapPin size={16} />
                  {place}
                </p>
              </div>
              <button
                type="button"
                aria-label={blocked ? 'Unblock user' : 'Block user'}
                onClick={() => updateUserStatus({ userId: user.id, status: blocked ? 'Active' : 'Blocked' })}
                className="grid size-10 shrink-0 place-items-center rounded-full bg-head-bg text-ink"
              >
                <Ban size={18} />
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
              {[
                ['Email Address', user.email],
                ['Member Since', formatDate(user.memberSince)],
                ['Phone', user.phoneNumber ?? 'Not provided'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">{label}</dt>
                  <dd className="mt-1 text-sm break-words text-body">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>

        {/* Account status */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-ink-strong">Account Status</h2>
            <StatusBadge status={user.status} variant="plain" uppercase />
          </div>
          <p className="text-sm text-muted">
            {blocked
              ? 'This account is currently restricted from joining activities.'
              : `Currently active and participating in ${user.neighborhoodClusters ?? 0} neighborhood clusters.`}
          </p>
          <label className="flex h-14 items-center justify-between rounded-field bg-head-bg px-4">
            <span className="text-base text-ink-strong">Block user</span>
            <input
              type="checkbox"
              checked={blocked}
              onChange={(event) =>
                updateUserStatus({ userId: user.id, status: event.target.checked ? 'Blocked' : 'Active' })
              }
              className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-field transition-colors checked:bg-action"
              style={{
                backgroundImage:
                  'radial-gradient(circle at var(--knob, 12px) 50%, #fff 0 9px, transparent 9px)',
                ['--knob' as string]: blocked ? '32px' : '12px',
              }}
            />
          </label>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <StatTile label="Activities Joined" value={user.activitiesJoined} icon={HandHeart} />
        <StatTile label="Activities Created" value={user.activitiesCreated} icon={Pencil} />

        <Card className="space-y-4">
          <h2 className="text-xl font-bold text-ink-strong">Interests</h2>
          {user.interests.length ? (
            <ul className="flex flex-wrap gap-2">
              {user.interests.map((interest) => (
                <li
                  key={interest.id}
                  className="rounded-md border border-ok-bg bg-interest-bg px-2.5 py-1.5 text-sm text-action"
                >
                  {interest.categoryName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No interests selected yet.</p>
          )}
        </Card>
      </div>

      {/* Activity history */}
      <Card padded={false}>
        <div className="flex gap-8 border-b border-line px-6">
          {(
            [
              ['joined', 'Joined Activities'],
              ['created', 'Created Activities'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 py-4 text-sm transition-colors ${
                tab === key ? 'border-action font-medium text-action' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="text-xs font-medium tracking-[0.04em] text-muted uppercase">
              <th className="py-4 pl-6 text-left font-medium">Activity Name</th>
              <th className="text-left font-medium">Category</th>
              <th className="text-left font-medium">Date</th>
              <th className="text-left font-medium">Status</th>
              <th className="pr-6 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="h-[60px] border-t border-line">
                <td className="pl-6 text-base font-medium text-ink-strong">{row.activityName}</td>
                <td>
                  <Tag>{row.categoryName}</Tag>
                </td>
                <td className="text-base text-muted">{formatDate(row.activityDate)}</td>
                <td>
                  <StatusBadge status={historyStatus(row.status)} variant="text" />
                </td>
                <td className="pr-6 text-right">
                  <button type="button" aria-label="Row actions" className="text-muted">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-line py-4 text-center">
          <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-action">
            View All History
            <ArrowRight size={16} />
          </button>
        </div>
      </Card>
    </div>
  );
}
