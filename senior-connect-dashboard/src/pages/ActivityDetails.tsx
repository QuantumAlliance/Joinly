/**
 * Activity Details — `Dashboard figma design/Activities.svg`.
 *
 * A full-bleed hero tucked under the topbar carrying the category and review
 * chips over a large white title, then a 1fr/304px split: Description and the
 * 2×2 Activity Highlights grid on the left, Location (with map thumbnail) and
 * the organizer card on the right.
 */
import { useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Ticket, Users2 } from 'lucide-react';
import type { ComponentType } from 'react';
import { useGetActivityDetailsQuery } from '../app/api/apiSlice';
import Avatar from '../components/Avatar';
import Card from '../components/Card';
import Thumb from '../components/Thumb';
import { useTopbar } from '../layouts/topbar';
import { formatPrice } from '../lib/format';

/** "Pending" is shown as "Pending Review" on the hero chip. */
const heroStatus = (status: string) => (status === 'Pending' ? 'Pending Review' : status);

function Highlight({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  value: string;
  note?: string | null;
}) {
  return (
    <div className="flex gap-3 rounded-field bg-soft-bg p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ok-bg text-ok-fg">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-[0.06em] text-muted uppercase">{label}</div>
        <div className="mt-0.5 text-base font-medium text-ink-strong">{value}</div>
        {note && <div className="mt-0.5 text-xs text-accent">{note}</div>}
      </div>
    </div>
  );
}

export default function ActivityDetails() {
  const { activityId = '' } = useParams();
  const { data } = useGetActivityDetailsQuery(activityId, { skip: !activityId });

  useTopbar({ title: 'Activity Details', backTo: '/activities' });

  const activity = data?.data;
  if (!activity) return <p className="text-sm text-muted">Loading activity…</p>;

  const [venue, ...addressLines] = activity.activityLocation.split(', ');

  return (
    <div className="space-y-6">
      {/* Hero — breaks out of the content column to sit flush under the topbar. */}
      <div className="relative -mx-8 -mt-8 h-[505px] overflow-hidden bg-track">
        <Thumb src={activity.activityPhoto} alt={activity.activityName} className="size-full" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-action px-3 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-white uppercase">
              {activity.category.categoryName}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold tracking-[0.06em] text-ink uppercase">
              {heroStatus(activity.status)}
            </span>
          </div>
          <h2 className="text-[48px] leading-[1.05] font-bold text-white">{activity.activityName}</h2>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_304px] gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="border-b border-line pb-4 text-xl font-bold text-ink-strong">Description</h3>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-body">
              {activity.descriptions.split('\n\n').map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-ink-strong">Activity Highlights</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Highlight
                icon={Users2}
                label="Participants"
                value={`${activity.maximumNumberOfParticipants} Slots Total`}
                note={`${activity.joinedCount} spots already requested`}
              />
              <Highlight
                icon={CalendarDays}
                label="Age Range"
                value={activity.ageLimit || `${activity.minAge} – ${activity.maxAge} Years`}
                note={activity.ageRangeNote}
              />
              <Highlight
                icon={Ticket}
                label="Price"
                value={formatPrice(activity.price)}
                note={activity.priceNote ?? activity.activityEquipment}
              />
              <Highlight
                icon={Clock}
                label="Duration"
                value={activity.activityDuration}
                note={activity.durationNote}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-xl font-bold text-ink-strong">Location</h3>
            {activity.mapImage && (
              <Thumb
                src={activity.mapImage}
                className="mt-4 h-[124px] w-full rounded-field border border-line"
              />
            )}
            <div className="mt-4 flex gap-2">
              <MapPin size={18} className="mt-0.5 shrink-0 text-action" />
              <div className="text-sm">
                <div className="font-medium text-ink-strong">{venue}</div>
                {addressLines.length > 0 && (
                  <div className="mt-0.5 text-muted">{addressLines.join(', ')}</div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-xl font-bold text-ink-strong">Organized by</h3>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                src={activity.organizer.profilePhoto}
                firstName={activity.organizer.firstName}
                lastName={activity.organizer.lastName}
                size={52}
              />
              <div className="min-w-0">
                <div className="text-lg font-medium text-ink-strong">
                  {activity.organizer.firstName} {activity.organizer.lastName}
                </div>
                <div className="truncate text-xs text-muted">{activity.organizer.email}</div>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 h-12 w-full rounded-field border border-action text-base font-medium text-action hover:bg-soft-bg"
            >
              View Organizer Profile
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
