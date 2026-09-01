/**
 * Notifications — `Dashboard figma design/Users-3.svg`.
 *
 * Compose card (title + message + send, no audience selector — the frame has
 * none, so everything goes out to Everyone) above the history table.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Download, ListFilter, Send } from 'lucide-react';
import { useComposeNotificationMutation, useGetNotificationsQuery } from '../app/api/apiSlice';
import ApiError from '../components/ApiError';
import Card from '../components/Card';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { useTopbar } from '../layouts/topbar';
import { formatDate } from '../lib/format';

const PAGE_SIZE = 5;
const FIELD =
  'w-full rounded-field border border-line bg-card px-4 text-base text-body outline-none placeholder:text-muted focus:border-brand';

export default function Notifications() {
  useTopbar({ title: 'Notifications', variant: 'plain' });

  const [notificationTitle, setNotificationTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);

  const { data, isError, refetch } = useGetNotificationsQuery({ page, limit: PAGE_SIZE });
  const [composeNotification, { isLoading }] = useComposeNotificationMutation();

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!notificationTitle.trim() || !messageContent.trim()) {
      setFeedback({ tone: 'error', text: 'Add a title and a message before sending.' });
      return;
    }
    try {
      // The frame has no audience control; everything is broadcast.
      await composeNotification({
        notificationTitle: notificationTitle.trim(),
        messageContent: messageContent.trim(),
        audience: 'Everyone',
      }).unwrap();
      setNotificationTitle('');
      setMessageContent('');
      setPage(1);
      setFeedback({ tone: 'ok', text: 'Notification sent.' });
    } catch {
      setFeedback({ tone: 'error', text: 'Could not send the notification.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-[0.08em] text-label uppercase">Communication Hub</p>
        <h2 className="mt-1 text-[35px] leading-tight font-bold text-ink">Notification Management</h2>
      </div>

      <Card>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ok-bg text-ok-fg">
            <Send size={18} />
          </span>
          <h3 className="text-xl font-bold text-ink-strong">Compose Notification</h3>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="notificationTitle" className="block text-sm font-medium text-ink-strong">
              Notification Title
            </label>
            <input
              id="notificationTitle"
              value={notificationTitle}
              onChange={(event) => setNotificationTitle(event.target.value)}
              placeholder="e.g. Community Garden Workshop"
              className={`${FIELD} mt-2 h-12`}
            />
          </div>

          <div>
            <label htmlFor="messageContent" className="block text-sm font-medium text-ink-strong">
              Message Content
            </label>
            <textarea
              id="messageContent"
              rows={4}
              value={messageContent}
              onChange={(event) => setMessageContent(event.target.value)}
              placeholder="Share details about the event or update..."
              className={`${FIELD} mt-2 resize-none py-3`}
            />
          </div>

          {feedback && (
            <p className={`text-sm ${feedback.tone === 'ok' ? 'text-action' : 'text-danger'}`}>
              {feedback.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="h-12 rounded-full bg-action px-7 text-base font-medium text-white hover:bg-action-hover disabled:opacity-60"
          >
            {isLoading ? 'Sending…' : 'Send Notification'}
          </button>
        </form>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-4 p-6">
          <h3 className="text-xl font-bold text-ink-strong">Notification History</h3>
          <div className="flex items-center gap-4 text-muted">
            <button type="button" aria-label="Filter history">
              <ListFilter size={20} />
            </button>
            <button type="button" aria-label="Export history">
              <Download size={20} />
            </button>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col />
          </colgroup>
          <thead className="bg-head-bg text-xs font-medium tracking-[0.04em] text-muted uppercase">
            <tr>
              <th className="py-4 pl-6 text-left font-medium">Subject</th>
              <th className="text-left font-medium">Audience</th>
              <th className="text-left font-medium">Sent Date</th>
              <th className="pr-6 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isError && (
              <tr>
                <td colSpan={5}>
                  <ApiError what="the notification history" onRetry={() => refetch()} />
                </td>
              </tr>
            )}
            {!isError && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted">
                  Nothing has been sent yet.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="py-4 pl-6">
                  <div className="text-base font-medium text-ink-strong">{row.notificationTitle}</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-muted">{row.messageContent}</div>
                </td>
                <td>
                  {/*
                    An Interests broadcast names the categories it targeted;
                    rendering the bare word "Interests" would tell the admin
                    nothing about who actually received it.
                  */}
                  {row.audience === 'Everyone' || row.audienceCategories.length === 0 ? (
                    <span className="inline-flex items-center rounded-full bg-ok-bg px-2.5 py-[3px] text-xs font-medium text-ok-fg">
                      {row.audience === 'Everyone' ? 'Everyone' : 'No matching interests'}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.audienceCategories.map((category) => (
                        <span
                          key={category.id}
                          className="inline-flex items-center rounded-full bg-ok-bg px-2.5 py-[3px] text-xs font-medium text-ok-fg"
                        >
                          {category.categoryName}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted">
                    {row.recipientCount} {row.recipientCount === 1 ? 'recipient' : 'recipients'}
                  </div>
                </td>
                <td className="text-base text-body">{formatDate(row.sentDate)}</td>
                <td className="pr-6">
                  <StatusBadge status={row.status} variant="text" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing {rows.length} of {meta?.total ?? 0} notifications
        </p>
        <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
      </div>
    </div>
  );
}
