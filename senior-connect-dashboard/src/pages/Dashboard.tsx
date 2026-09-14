/**
 * Dashboard — `Dashboard figma design/Dashboard.svg`
 * (+ Dashboard-1.svg for the long Recent Activities table).
 *
 * Layout as drawn in the 1280px frame: three 304×146 stat cards, then a
 * 304 / 632 split holding the donut and Recent Users at a matched 466px, then
 * the full-width Recent Activities table.
 */
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarX2, Check, ChevronRight, Eye, Users2, X } from 'lucide-react';
import type { ComponentType } from 'react';
import {
  useGetCategoryDistributionQuery,
  useGetRecentActivitiesQuery,
  useGetRecentUsersQuery,
  useGetStatisticsQuery,
  useUpdateActivityStatusMutation,
} from '../app/api/apiSlice';
import type { CategoryDistributionRow } from '../app/api/types';
import Avatar from '../components/Avatar';
import ApiError from '../components/ApiError';
import Card from '../components/Card';
import StatusBadge, { Tag } from '../components/StatusBadge';
import Thumb from '../components/Thumb';
import { useTopbar } from '../layouts/topbar';
import { formatDate } from '../lib/format';

/** Legend swatch colours, in the frame's order: brand blue, deep green, near-black. */
const SLICE_COLORS = ['#1e86fd', '#3f6840', '#1a1a1a'];

/** Recent Users initials circles alternate mint / pale blue down the column. */
const AVATAR_TINTS = ['bg-[#d9e6da]', 'bg-brand-tint'];

// ------------------------------------------------------------------ pieces

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
  badge,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone?: 'brand' | 'alert';
  badge?: string;
}) {
  return (
    <Card className="flex h-[146px] flex-col justify-between p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="max-w-[120px] text-xs font-medium tracking-[0.06em] text-muted uppercase">
          {label}
        </span>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            tone === 'alert' ? 'bg-warn-bg text-warn-fg' : 'bg-brand-tint text-brand'
          }`}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[38px] leading-none font-bold text-ink-strong">{value}</span>
        {badge && (
          <span className="rounded-full bg-danger-solid px-2.5 py-1 text-[10px] font-bold tracking-[0.04em] text-white uppercase">
            {badge}
          </span>
        )}
      </div>
    </Card>
  );
}

/**
 * Donut for the category split.
 *
 * Geometry is taken from the frame: a #ECEEEC track ring at r=90 with the
 * coloured arcs drawn *inside* it at r=78, which is what gives the chart its
 * halo. The frame itself only draws the leading share; this renders every
 * slice so the ring agrees with the legend beneath it.
 */
function Donut({ slices }: { slices: CategoryDistributionRow[] }) {
  const TRACK_RADIUS = 90;
  const ARC_RADIUS = 78;
  const CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
  const lead = slices[0];
  let offset = 0;

  return (
    <div className="relative grid size-[192px] place-items-center">
      <svg viewBox="0 0 192 192" className="size-full -rotate-90">
        <circle
          cx="96"
          cy="96"
          r={TRACK_RADIUS}
          fill="none"
          stroke="var(--color-track)"
          strokeWidth="12"
        />
        {slices.map((slice, i) => {
          const length = (slice.percentage / 100) * CIRCUMFERENCE;
          const element = (
            <circle
              key={slice.categoryName}
              cx="96"
              cy="96"
              r={ARC_RADIUS}
              fill="none"
              stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
              strokeWidth="12"
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return element;
        })}
      </svg>
      {lead && (
        <div className="absolute text-center">
          <div className="text-[26px] leading-tight font-bold text-brand">{lead.percentage}%</div>
          <div className="text-sm text-muted">{lead.categoryName.split(' ')[0]}</div>
        </div>
      )}
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
  viewAllTo,
}: {
  title: string;
  subtitle: string;
  viewAllTo?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-tint px-4 text-sm font-medium text-brand"
        >
          View All
          <ChevronRight size={15} />
        </Link>
      )}
    </div>
  );
}

const TH = 'pb-3 text-left text-sm font-normal text-muted';

// ------------------------------------------------------------------- page

export default function Dashboard() {
  useTopbar({ title: 'Dashboard' });

  const { data: stats, isError: statsError, refetch: refetchStats } = useGetStatisticsQuery();
  const { data: distribution } = useGetCategoryDistributionQuery();
  const { data: recentUsers } = useGetRecentUsersQuery({ limit: 4 });
  const { data: recentActivities } = useGetRecentActivitiesQuery({ limit: 8 });
  const [updateActivityStatus] = useUpdateActivityStatusMutation();

  const slices = distribution?.data ?? [];

  return (
    <div className="space-y-6">
      {statsError && <ApiError what="the dashboard" onRetry={() => refetchStats()} />}

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          label="Total Users"
          value={(stats?.data.totalUsers ?? 0).toLocaleString()}
          icon={Users2}
        />
        <StatCard
          label="Total Activities"
          value={(stats?.data.totalActivities ?? 0).toLocaleString()}
          icon={CalendarDays}
        />
        <StatCard
          label="Pending Approvals"
          value={(stats?.data.pendingApprovals ?? 0).toLocaleString()}
          icon={CalendarX2}
          tone="alert"
          // Only shout when something actually needs the admin: the badge used to
          // show "Action required" beside a count of zero.
          badge={(stats?.data.pendingApprovals ?? 0) > 0 ? 'Action required' : undefined}
        />
      </div>

      {/* Donut + Recent Users, matched heights */}
      <div className="grid grid-cols-[304px_1fr] gap-6">
        <Card className="flex h-[466px] flex-col">
          <h2 className="text-xl font-bold text-ink-strong">Category Distribution</h2>
          <p className="mt-1 text-sm text-muted">Activity breakdown across the community.</p>

          <div className="flex flex-1 items-center justify-center">
            <Donut slices={slices} />
          </div>

          <ul className="space-y-3">
            {slices.map((slice, i) => (
              <li key={slice.categoryName} className="flex items-center gap-2.5 text-sm">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className="text-body">{slice.categoryName}</span>
                <span className="ml-auto font-bold text-ink-strong">{slice.percentage}%</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex h-[466px] flex-col">
          <SectionHead
            title="Recent Users"
            subtitle="New members who joined in the last 24 hours."
            viewAllTo="/users"
          />

          <table className="mt-5 w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                <th className={TH}>User</th>
                <th className={TH}>Type</th>
                <th className={TH}>Date Joined</th>
                <th className={`${TH} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(recentUsers?.data ?? []).map((user, i) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        firstName={user.firstName}
                        lastName={user.lastName}
                        size={36}
                        tintClass={AVATAR_TINTS[i % AVATAR_TINTS.length]}
                      />
                      <div className="leading-tight">
                        <div className="text-base text-ink-strong">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-muted">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-base text-ink-strong">{user.type ?? 'Senior Member'}</td>
                  <td className="text-base text-muted">{formatDate(user.dateJoined)}</td>
                  <td className="text-right">
                    {/* Blue on the dashboard; the Users table uses the green pill. */}
                    <StatusBadge status={user.status} variant="plain" tone="brand" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card>
        <SectionHead
          title="Recent Activities"
          subtitle="Latest events scheduled across the network."
          viewAllTo="/activities"
        />

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b border-line">
              <th className={TH}>Activity Name</th>
              <th className={TH}>Location</th>
              <th className={TH}>Category</th>
              <th className={TH}>Action</th>
            </tr>
          </thead>
          <tbody>
            {(recentActivities?.data ?? []).map((activity) => (
              <tr key={activity.id} className="border-b border-line last:border-0">
                <td className="py-4">
                  <div className="flex items-center gap-4">
                    <Thumb
                      src={activity.activityPhoto}
                      className="size-11 shrink-0 rounded-lg"
                    />
                    <span className="text-base text-ink-strong">{activity.activityName}</span>
                  </div>
                </td>
                <td className="text-base text-muted">{activity.activityLocation}</td>
                <td>
                  <Tag>{activity.categoryName}</Tag>
                </td>
                <td>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      aria-label={`Approve ${activity.activityName}`}
                      onClick={() => updateActivityStatus({ id: activity.id, status: 'Approved' })}
                      className="text-accent"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Reject ${activity.activityName}`}
                      onClick={() => updateActivityStatus({ id: activity.id, status: 'Rejected' })}
                      className="text-danger"
                    >
                      <X size={18} />
                    </button>
                    <Link
                      to={`/activities/${activity.id}`}
                      aria-label={`View ${activity.activityName}`}
                      className="text-accent"
                    >
                      <Eye size={18} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
