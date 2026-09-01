/**
 * Admin shell — 255px sidebar + 68px topbar, both measured off the frames.
 *
 * Geometry, for reference when diffing against `Dashboard figma design/*.svg`:
 *   sidebar   256px wide incl. its 1px #E4E8E5 right rule (rule on x=255)
 *   nav rows  48px tall on a 52px pitch; active row is #E0F1FF with a 4px
 *             accent bar in the brand gradient
 *   divider   after Categories, 20px clear above and below
 *   topbar    68px tall, #F8FAF8, 1px #E4E8E5 bottom rule
 *   content   fluid, with a constant 32px gutter either side
 *
 * The frame is drawn at 1280, where the content column works out to exactly
 * the 960px it shows. Rather than freezing that 960 and centring it — which
 * opens a gap beside the sidebar that grows with the window (113px at 1440,
 * 233px at 1680) — the column stays fluid and keeps the 32px gutter. Grids
 * that would otherwise stretch use auto-fill so they gain columns instead of
 * fatter cards.
 */
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  User,
  Users,
  Waypoints,
} from 'lucide-react';
import { logout } from '../app/authSlice';
import type { RootState } from '../app/store';
import Avatar from '../components/Avatar';
import { DEFAULT_TOPBAR, TopbarContext, useTopbarConfig } from './topbar';
import type { TopbarConfig } from './topbar';

/** Above the rule. */
const PRIMARY_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/activities', label: 'Activities', icon: CalendarDays },
  { to: '/categories', label: 'Categories', icon: Waypoints },
];

/** Below the rule. Profile and Logout continue the same 52px pitch. */
const SECONDARY_NAV = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: User },
];

const NAV_ROW =
  'relative flex h-12 items-center gap-3 pl-5 text-base transition-colors';

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? `${NAV_ROW} bg-nav-bg font-medium text-brand before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-brand-gradient before:content-[""]`
      : `${NAV_ROW} text-nav-idle hover:bg-[#f8faf8] hover:text-ink`;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-line bg-sidebar">
      <div className="flex h-24 items-center px-6">
        <span className="text-brand-gradient text-2xl font-bold">Arooby</span>
      </div>

      <nav className="flex flex-col gap-1">
        {PRIMARY_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon size={19} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}

        <hr className="my-5 border-line" />

        {SECONDARY_NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClass}>
            <Icon size={19} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}

        <button type="button" onClick={onLogout} className={`${NAV_ROW} text-nav-idle hover:text-ink`}>
          <LogOut size={19} strokeWidth={1.75} />
          Logout
        </button>
      </nav>
    </aside>
  );
}

function Topbar() {
  const { title, variant = 'search', backTo, action } = useTopbarConfig();
  const navigate = useNavigate();
  const admin = useSelector((state: RootState) => state.auth.user);
  const adminName = `${admin?.firstName ?? ''} ${admin?.lastName ?? ''}`.trim() || 'Admin';

  return (
    <header className="sticky top-0 z-10 h-[68px] border-b border-line bg-topbar">
      <div className="flex h-full items-center gap-4 px-8">
        {backTo && (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => navigate(backTo)}
            className="text-muted"
          >
            <ArrowLeft size={22} />
          </button>
        )}

        <h1 className="text-brand-gradient text-2xl font-bold">{title}</h1>

        <div className="ml-auto flex items-center gap-4">
          {variant === 'search' && (
            <>
              <label className="relative block w-[250px]">
                <Search size={17} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  placeholder="Search data..."
                  aria-label="Search data"
                  className="h-12 w-full rounded-full bg-track pr-4 pl-11 text-base text-body outline-none placeholder:text-muted"
                />
              </label>
              <Link
                to="/notifications"
                aria-label="Notifications"
                className="rounded-full p-1.5 text-ink transition-colors hover:bg-track hover:text-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <Bell size={20} strokeWidth={1.75} />
              </Link>
            </>
          )}

          {variant === 'action' && action}

          <Link
            to="/profile"
            aria-label={`Your profile — ${adminName}`}
            title={adminName}
            className="rounded-full transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Avatar
              src={admin?.profilePhoto}
              firstName={admin?.firstName}
              lastName={admin?.lastName}
              size={38}
              ring
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [config, setConfig] = useState<TopbarConfig>(DEFAULT_TOPBAR);
  const topbar = useMemo(() => ({ config, setConfig }), [config]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <TopbarContext.Provider value={topbar}>
      <div className="min-h-screen bg-page">
        <Sidebar onLogout={handleLogout} />
        <div className="ml-64 flex min-h-screen flex-col">
          <Topbar />
          <main className="w-full flex-1 px-8 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TopbarContext.Provider>
  );
}
