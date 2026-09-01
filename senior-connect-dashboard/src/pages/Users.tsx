/**
 * Users — `Dashboard figma design/Users.svg` and `Users-7.svg`.
 *
 * 447×48 search field beside a mint Filter button, then a 960px table card:
 * 90px header, 80px rows with 46px ringed avatars, and a footer carrying the
 * row count and the `‹ 1 2 3 … 58 ›` pager.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, ListFilter, Search, ShieldBan, ShieldCheck, X } from 'lucide-react';
import { useGetUsersQuery, useUpdateUserStatusMutation } from '../app/api/apiSlice';
import type { AdminUserRow } from '../app/api/types';
import ApiError from '../components/ApiError';
import Avatar from '../components/Avatar';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { useTopbar } from '../layouts/topbar';

const PAGE_SIZE = 10;

/** The three options drawn in `Frame 2147230321.svg`. */
const FILTERS = [
  { value: '', label: 'All Users' },
  { value: 'active', label: 'Active Users' },
  { value: 'blocked', label: 'Blocked Users' },
] as const;

const TH = 'px-0 pb-4 text-left align-top text-xs font-medium tracking-[0.04em] text-muted uppercase';

function FilterMenu({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-12 w-[104px] items-center justify-center gap-2 rounded-field bg-ok-bg text-base font-medium text-ok-fg"
      >
        <ListFilter size={18} />
        Filter
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-[200px] overflow-hidden rounded-field border border-line bg-card shadow-card"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="menuitemradio"
              aria-checked={value === filter.value}
              onClick={() => {
                onChange(filter.value);
                setOpen(false);
              }}
              className={`block w-full border-b border-line px-4 py-3 text-center text-sm last:border-0 hover:bg-head-bg ${
                value === filter.value ? 'font-medium text-action' : 'text-body'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RowActions({ user, onStatus }: { user: AdminUserRow; onStatus: (status: AdminUserRow['status']) => void }) {
  const blocked = user.status === 'Blocked' || user.status === 'Suspended';

  return (
    <div className="flex items-center justify-end gap-4">
      {user.status === 'Pending' ? (
        <>
          <button type="button" aria-label="Approve user" onClick={() => onStatus('Active')} className="text-accent">
            <Check size={18} />
          </button>
          <button type="button" aria-label="Reject user" onClick={() => onStatus('Blocked')} className="text-danger">
            <X size={18} />
          </button>
        </>
      ) : (
        <button
          type="button"
          aria-label={blocked ? 'Unblock user' : 'Block user'}
          onClick={() => onStatus(blocked ? 'Active' : 'Blocked')}
          className={blocked ? 'text-accent' : 'text-danger'}
        >
          {blocked ? <ShieldCheck size={18} /> : <ShieldBan size={18} />}
        </button>
      )}
      <Link to={`/users/${user.id}`} aria-label={`View ${user.firstName} ${user.lastName}`} className="text-accent">
        <Eye size={18} />
      </Link>
    </div>
  );
}

export default function UsersPage() {
  useTopbar({ title: 'Users' });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('');
  const [updateUserStatus] = useUpdateUserStatusMutation();

  const { data, isError, refetch } = useGetUsersQuery({ page, limit: PAGE_SIZE, search: search || undefined, tab: tab || undefined });
  const users = data?.data ?? [];
  const meta = data?.meta;

  const resetTo = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const from = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="relative block w-[447px]">
          <Search size={18} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => resetTo(() => setSearch(event.target.value))}
            placeholder="Search by name, email or country..."
            aria-label="Search users"
            className="h-12 w-full rounded-field border border-field bg-card pr-4 pl-11 text-base text-body outline-none placeholder:text-muted focus:border-brand"
          />
        </label>
        <div className="ml-auto">
          <FilterMenu value={tab} onChange={(next) => resetTo(() => setTab(next))} />
        </div>
      </div>

      <section className="overflow-hidden rounded-card border border-field/30 bg-card shadow-card">
        <table className="w-full table-fixed border-collapse">
          {/* Column widths taken off the Users frame. Inline styles rather than
              utility classes so `table-fixed` reliably honours them. */}
          <colgroup>
            <col style={{ width: 166 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 134 }} />
            <col style={{ width: 141 }} />
            <col style={{ width: 159 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={`${TH} pt-11 pl-6`}>
                User
                <br />
                Profile
              </th>
              <th className={`${TH} pt-11`}>Email Address</th>
              <th className={`${TH} pt-11`}>Country</th>
              <th className={`${TH} pt-11`}>Activities</th>
              <th className={`${TH} pt-11`}>Status</th>
              <th className={`${TH} pt-11 pr-6 text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isError && (
              <tr>
                <td colSpan={6}>
                  <ApiError what="users" onRetry={() => refetch()} />
                </td>
              </tr>
            )}
            {!isError && users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-muted">
                  No users match this view.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="h-20 border-t border-line">
                <td className="pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.profilePhoto}
                      firstName={user.firstName}
                      lastName={user.lastName}
                      size={46}
                      ring
                    />
                    <span className="text-base text-body">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </td>
                <td className="text-base text-body">{user.email}</td>
                <td className="text-base text-body">{user.country ?? '—'}</td>
                <td className="text-base font-medium text-action">{user.activities}</td>
                <td>
                  <StatusBadge status={user.status} />
                </td>
                <td className="pr-6">
                  <RowActions
                    user={user}
                    onStatus={(status) => updateUserStatus({ userId: user.id, status })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-line px-6 py-3.5">
          <p className="text-sm text-muted">
            Showing {from} to {to} of {meta?.total ?? 0} users
          </p>
          <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
        </div>
      </section>
    </div>
  );
}
