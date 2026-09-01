/**
 * In-memory stand-in for the NestJS backend.
 *
 * Swaps into the RTK Query slice in place of `fetchBaseQuery` when
 * `VITE_USE_MOCKS` is on, so the dashboard runs — and can be screenshot-diffed
 * against the Figma frames — with no API and no database. It speaks the same
 * routes and the same `{ success, message, data, meta? }` envelope, and
 * mutations persist for the lifetime of the tab.
 */
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type {
  ActivityCard,
  ActivityStatus,
  AdminCategoryRow,
  AdminUserRow,
  ApiEnvelope,
  Audience,
  CategoryStatus,
  NotificationRow,
  UserStatus,
} from '../app/api/types';
import * as seed from './data';

/** Mutable session store — cloned from the seed so mutations stick. */
const db = {
  users: [...seed.users],
  userDetails: { ...seed.userDetailsSeed },
  categories: [...seed.categories],
  activities: [...seed.activities],
  activityDetails: { ...seed.activityDetailsSeed },
  notifications: [...seed.notifications],
  statistics: { ...seed.statistics },
  me: { ...seed.me },
  contact: { ...seed.contactInfo },
};

const LATENCY_MS = 180;

const ok = <T>(data: T, message = 'Success', meta?: ApiEnvelope<T>['meta']): ApiEnvelope<T> => ({
  success: true,
  message,
  data,
  ...(meta ? { meta } : {}),
});

const fail = (status: number, message: string): { error: FetchBaseQueryError } => ({
  error: { status, data: { success: false, message, data: null } } as FetchBaseQueryError,
});

const paginate = <T>(rows: T[], page = 1, limit = 10) => {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return { slice: rows.slice(start, start + limit), meta: { page, limit, total, totalPages } };
};

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const nextId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

interface Request {
  url: string;
  method: string;
  body: Record<string, unknown>;
  params: Record<string, string>;
}

/** Every route the dashboard calls, in the order the slice declares them. */
function route(req: Request): unknown | { error: FetchBaseQueryError } {
  const { url, method, body, params } = req;

  // ---------------------------------------------------------------- auth
  if (url === '/auth/admin/login') {
    const email = String(body.email ?? '').toLowerCase();
    const password = String(body.password ?? '');
    if (email !== 'admin@contenthub.io' || password !== 'admin123') {
      return fail(401, 'Invalid email or password');
    }
    return ok(
      {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'admin-1',
          firstName: 'Amelia',
          lastName: 'Reed',
          email: 'admin@contenthub.io',
          role: 'Admin',
          profilePhoto: 'https://i.pravatar.cc/160?img=47',
        },
      },
      'Logged in',
    );
  }
  if (url === '/auth/forgot-password') {
    return ok({ email: String(body.email ?? ''), otpSent: true }, 'Verification code sent');
  }
  if (url === '/auth/reset-password') {
    if (body.newPassword !== body.confirmPassword) return fail(400, 'Passwords do not match');
    return ok(null, 'Password updated');
  }

  // ------------------------------------------------------------- uploads
  if (url === '/uploads') {
    return ok({
      fileName: 'mock-upload.jpg',
      originalName: 'mock-upload.jpg',
      mimeType: 'image/jpeg',
      size: 128_000,
      url: 'https://i.pravatar.cc/300?img=47',
    });
  }
  if (url === '/users/me/profile-photo') {
    db.me = { ...db.me, profilePhoto: String(body.profilePhoto ?? '') };
    return ok({ profilePhoto: db.me.profilePhoto }, 'Profile photo updated');
  }

  // --------------------------------------------------- my profile + prefs
  if (url === '/users/me' && method === 'GET') return ok(db.me);
  if (url === '/users/me' && method === 'PATCH') {
    db.me = {
      ...db.me,
      ...(body.firstName !== undefined ? { firstName: String(body.firstName) } : {}),
      ...(body.lastName !== undefined ? { lastName: String(body.lastName) } : {}),
      ...(body.dateOfBirth !== undefined ? { dateOfBirth: String(body.dateOfBirth) } : {}),
    };
    return ok(db.me, 'Profile updated');
  }
  if (url === '/users/me/app-preferences') {
    db.me = {
      ...db.me,
      ...(body.language !== undefined ? { language: String(body.language) } : {}),
      ...(body.dateFormat !== undefined ? { dateFormat: String(body.dateFormat) } : {}),
      ...(body.notificationSounds !== undefined
        ? { notificationSounds: Boolean(body.notificationSounds) }
        : {}),
      ...(body.allowNotifications !== undefined
        ? { allowNotifications: Boolean(body.allowNotifications) }
        : {}),
    };
    return ok(db.me, 'Preferences updated');
  }
  if (url === '/auth/change-password') {
    // The seeded admin's password, mirroring what `npm run seed` creates.
    if (String(body.currentPassword ?? '') !== 'admin123') {
      return fail(400, 'Current Password is incorrect');
    }
    return ok(null, 'Password changed successfully');
  }

  // ------------------------------------------------------ support contact
  if (url === '/contact/admin/contact' && method === 'GET') return ok(db.contact);
  if (url === '/contact/admin/contact' && method === 'PATCH') {
    db.contact = {
      ...db.contact,
      ...(body.email !== undefined ? { email: String(body.email) } : {}),
      ...(body.phoneNumber !== undefined ? { phoneNumber: String(body.phoneNumber) } : {}),
      updatedAt: new Date().toISOString(),
    };
    return ok(db.contact, 'Contact information updated');
  }

  // ----------------------------------------------------------- dashboard
  if (url === '/dashboard/statistics') return ok(db.statistics);
  if (url === '/dashboard/category-distribution') return ok(seed.categoryDistribution);
  if (url === '/dashboard/recent-users') {
    return ok(seed.recentUsers.slice(0, num(params.limit, 4)));
  }
  if (url === '/dashboard/recent-activities') {
    return ok(seed.recentActivities.slice(0, num(params.limit, 8)));
  }

  // --------------------------------------------------------------- users
  if (url === '/users/admin/users') {
    const search = (params.search ?? '').trim().toLowerCase();
    const tab = params.tab ?? '';
    let rows: AdminUserRow[] = db.users;
    if (search) {
      rows = rows.filter((u) =>
        [`${u.firstName} ${u.lastName}`, u.email, u.country ?? ''].some((f) =>
          f.toLowerCase().includes(search),
        ),
      );
    }
    if (params.status) rows = rows.filter((u) => u.status === params.status);
    if (tab === 'active') rows = rows.filter((u) => u.status === 'Active');
    if (tab === 'blocked') rows = rows.filter((u) => u.status === 'Blocked' || u.status === 'Suspended');
    const { slice, meta } = paginate(rows, num(params.page, 1), num(params.limit, 10));
    return ok(slice, 'Users fetched', meta);
  }

  const userDetailMatch = url.match(/^\/users\/admin\/users\/([^/]+)$/);
  if (userDetailMatch) {
    const id = userDetailMatch[1];
    const row = db.users.find((u) => u.id === id);
    if (!row) return fail(404, 'User not found');
    // The frame's detail content belongs to one user; reuse it for the rest so
    // every row opens onto a fully populated screen.
    return ok({
      ...db.userDetails,
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      country: row.country,
      status: row.status,
      profilePhoto: row.profilePhoto,
      activitiesJoined: row.activities,
      activityJoined: row.activities,
    });
  }

  const userStatusMatch = url.match(/^\/users\/admin\/users\/([^/]+)\/status$/);
  if (userStatusMatch) {
    const id = userStatusMatch[1];
    const row = db.users.find((u) => u.id === id);
    if (!row) return fail(404, 'User not found');
    row.status = body.status as UserStatus;
    if (db.userDetails.id === id) db.userDetails.status = row.status;
    return ok({ ...db.userDetails, id, status: row.status }, 'Status updated');
  }

  // ---------------------------------------------------------- categories
  if (url === '/categories') {
    return ok(
      db.categories
        .filter((c) => c.status === 'Active')
        .map(({ id, categoryName, status }) => ({ id, categoryName, status })),
    );
  }

  if (url === '/categories/admin/categories' && method === 'GET') {
    const search = (params.search ?? '').trim().toLowerCase();
    let rows: AdminCategoryRow[] = db.categories;
    if (search) rows = rows.filter((c) => c.categoryName.toLowerCase().includes(search));
    if (params.status) rows = rows.filter((c) => c.status === params.status);
    const { slice, meta } = paginate(rows, num(params.page, 1), num(params.limit, 5));
    return ok(
      {
        stats: {
          totalCategories: db.categories.length,
          activeNow: db.categories.filter((c) => c.status === 'Active').length,
        },
        categories: slice,
      },
      'Categories fetched',
      meta,
    );
  }
  if (url === '/categories/admin/categories' && method === 'POST') {
    const categoryName = String(body.categoryName ?? '').trim();
    if (!categoryName) return fail(400, 'Category name is required');
    const created: AdminCategoryRow = { id: nextId('c'), categoryName, activityCount: 0, status: 'Active' };
    db.categories = [created, ...db.categories];
    return ok(created, 'Category created');
  }

  const categoryMatch = url.match(/^\/categories\/admin\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const id = categoryMatch[1];
    const idx = db.categories.findIndex((c) => c.id === id);
    if (idx === -1) return fail(404, 'Category not found');
    if (method === 'DELETE') {
      db.categories = db.categories.filter((c) => c.id !== id);
      return ok(null, 'Category deleted');
    }
    const current = db.categories[idx];
    const updated: AdminCategoryRow = {
      ...current,
      categoryName: (body.categoryName as string | undefined) ?? current.categoryName,
      status: (body.status as CategoryStatus | undefined) ?? current.status,
    };
    db.categories[idx] = updated;
    return ok(updated, 'Category updated');
  }

  // ---------------------------------------------------------- activities
  if (url === '/activities/admin/activities') {
    let rows: ActivityCard[] = db.activities;
    if (params.status) rows = rows.filter((a) => a.status === params.status);
    if (params.categoryId) rows = rows.filter((a) => a.categoryName === params.categoryId);
    if (params.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter((a) => a.activityName.toLowerCase().includes(q));
    }
    const { slice, meta } = paginate(rows, num(params.page, 1), num(params.limit, 6));
    return ok(slice, 'Activities fetched', meta);
  }

  const activityDetailMatch = url.match(/^\/activities\/admin\/activities\/([^/]+)$/);
  if (activityDetailMatch && method === 'GET') {
    const id = activityDetailMatch[1];
    const card = db.activities.find((a) => a.id === id);
    return ok({
      ...db.activityDetails,
      id,
      ...(card ? { status: card.status, category: { id: 'c-6', categoryName: card.categoryName } } : {}),
    });
  }
  if (activityDetailMatch && method === 'DELETE') {
    db.activities = db.activities.filter((a) => a.id !== activityDetailMatch[1]);
    return ok(null, 'Activity deleted');
  }

  const activityStatusMatch = url.match(/^\/activities\/admin\/activities\/([^/]+)\/status$/);
  if (activityStatusMatch) {
    const id = activityStatusMatch[1];
    const card = db.activities.find((a) => a.id === id);
    if (!card) return fail(404, 'Activity not found');
    card.status = body.status as ActivityStatus;
    if (card.status !== 'Pending' && db.statistics.pendingApprovals > 0) db.statistics.pendingApprovals -= 1;
    return ok({ ...db.activityDetails, id, status: card.status }, 'Activity status updated');
  }

  // ------------------------------------------------------- notifications
  if (url === '/notifications/admin/notifications' && method === 'GET') {
    let rows: NotificationRow[] = db.notifications;
    if (params.audience) rows = rows.filter((n) => n.audience === params.audience);
    if (params.status) rows = rows.filter((n) => n.status === params.status);
    const { slice, meta } = paginate(rows, num(params.page, 1), num(params.limit, 5));
    return ok(slice, 'Notifications fetched', meta);
  }
  if (url === '/notifications/admin/notifications' && method === 'POST') {
    const notificationTitle = String(body.notificationTitle ?? '').trim();
    const messageContent = String(body.messageContent ?? '').trim();
    if (!notificationTitle || !messageContent) return fail(400, 'Title and message are required');
    const created: NotificationRow = {
      id: nextId('n'),
      notificationTitle,
      messageContent,
      audience: (body.audience as Audience | undefined) ?? 'Everyone',
      audienceCategories: [],
      recipientCount: 0,
      sentDate: new Date().toISOString().slice(0, 10),
      status: 'Delivered',
    };
    db.notifications = [created, ...db.notifications];
    return ok(created, 'Notification sent');
  }

  return fail(404, `No mock handler for ${method} ${url}`);
}

export const mockBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
) => {
  const raw: FetchArgs = typeof args === 'string' ? { url: args } : args;
  const req: Request = {
    url: raw.url,
    method: (raw.method ?? 'GET').toUpperCase(),
    body: (raw.body as Record<string, unknown> | undefined) ?? {},
    params: Object.fromEntries(
      Object.entries((raw.params as Record<string, unknown> | undefined) ?? {})
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ),
  };

  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

  const result = route(req);
  if (result && typeof result === 'object' && 'error' in result) {
    return result as { error: FetchBaseQueryError };
  }
  return { data: result };
};

/**
 * Mocks are strictly opt-in: set VITE_USE_MOCKS=true to run the dashboard with
 * no API and no database (Figma screenshot diffing). Everything else — plain
 * `npm run dev` included — talks to VITE_API_URL.
 *
 * This used to default to on in dev, which meant the dashboard silently ran
 * against fake data and every integration bug stayed invisible until deploy.
 */
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
