/**
 * RTK Query API slice for the Senior Connect backend (NestJS).
 *
 * Endpoints mirror senior-connect-api exactly — same routes, same
 * Figma-derived field names, same `{ success, message, data, meta? }` envelope.
 * Wire types live in ./types and are re-exported here so pages can keep
 * importing them from the slice.
 *
 * When VITE_USE_MOCKS is not "false" the slice talks to the in-memory backend
 * in src/mocks instead of the network — see mockBaseQuery.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../store';
import type { AuthUser } from '../authSlice';
import { logout, setAccessToken } from '../authSlice';
import { USE_MOCKS, mockBaseQuery } from '../../mocks/mockBaseQuery';
import type {
  ActivityCard,
  ActivityDetails,
  AdminCategoryRow,
  AdminCategoryStats,
  AdminUserDetails,
  AdminUserRow,
  ApiEnvelope,
  AppPreferences,
  Audience,
  CategoryDistributionRow,
  CategoryItem,
  CategoryStatus,
  ContactInfo,
  DashboardStatistics,
  MyProfile,
  NotificationRow,
  RefreshedTokens,
  RecentActivityRow,
  RecentUserRow,
  UploadResult,
  UserStatus,
} from './types';

export * from './types';

const liveBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Access tokens expire (JWT_ACCESS_EXPIRES_IN, 1d by default) while the refresh
 * token is good for thirty. On a 401 we spend the refresh token once and replay
 * the request that failed; if that fails too the session really is over and we
 * log out, which sends ProtectedRoute back to /login.
 *
 * `refreshPromise` makes it single-flight: a dashboard screen fires four queries
 * at once, and without it each one would burn its own refresh.
 */
let refreshPromise: Promise<string | null> | null = null;

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await liveBaseQuery(args, api, extraOptions);
  if (result.error?.status !== 401) return result;

  const state = api.getState() as RootState;
  const refreshToken = state.auth.refreshToken;
  const url = typeof args === 'string' ? args : args.url;
  // The login endpoints answer 401 for bad credentials — that is the answer, not
  // an expired session, and refreshing it would replace a useful error message.
  if (!refreshToken || url.startsWith('/auth/')) {
    api.dispatch(logout());
    return result;
  }

  refreshPromise ??= (async () => {
    const refreshed = await liveBaseQuery(
      { url: '/auth/refresh-token', method: 'POST', body: { refreshToken } },
      api,
      extraOptions,
    );
    const data = (refreshed.data as ApiEnvelope<RefreshedTokens> | undefined)?.data;
    return data?.accessToken ?? null;
  })().finally(() => {
    refreshPromise = null;
  });

  const accessToken = await refreshPromise;
  if (!accessToken) {
    api.dispatch(logout());
    return result;
  }

  api.dispatch(setAccessToken(accessToken));
  result = await liveBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) api.dispatch(logout());
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: USE_MOCKS ? mockBaseQuery : baseQueryWithReauth,
  tagTypes: ['Dashboard', 'Users', 'User', 'Activities', 'Activity', 'Categories', 'Notifications', 'Me', 'Contact'],
  endpoints: (builder) => ({
    // ---- Auth ----
    adminLogin: builder.mutation<
      ApiEnvelope<{ accessToken: string; refreshToken: string; user: AuthUser }>,
      { email: string; password: string; rememberMe?: boolean }
    >({
      query: (body) => ({ url: '/auth/admin/login', method: 'POST', body }),
    }),
    forgotPassword: builder.mutation<ApiEnvelope<{ email: string; otpSent: boolean }>, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    resetPassword: builder.mutation<
      ApiEnvelope<null>,
      { email: string; otpCode: string; newPassword: string; confirmPassword: string }
    >({
      query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
    }),

    // ---- Uploads ----
    uploadFile: builder.mutation<ApiEnvelope<UploadResult>, FormData>({
      query: (formData) => ({ url: '/uploads', method: 'POST', body: formData }),
    }),

    changePassword: builder.mutation<
      ApiEnvelope<null>,
      { currentPassword: string; newPassword: string; confirmPassword: string }
    >({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),

    // ---- My profile (works for the logged-in admin too, not role-restricted) ----
    getMyProfile: builder.query<ApiEnvelope<MyProfile>, void>({
      query: () => '/users/me',
      providesTags: ['Me'],
    }),
    updateMyProfile: builder.mutation<
      ApiEnvelope<MyProfile>,
      { firstName?: string; lastName?: string; dateOfBirth?: string }
    >({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    updateMyProfilePhoto: builder.mutation<ApiEnvelope<{ profilePhoto: string | null }>, { profilePhoto: string }>({
      query: (body) => ({ url: '/users/me/profile-photo', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    // Returns the whole updated user, not just the four preference fields.
    updateAppPreferences: builder.mutation<ApiEnvelope<MyProfile>, Partial<AppPreferences>>({
      query: (body) => ({ url: '/users/me/app-preferences', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),

    // ---- Support contact (the Contact Us details the mobile app shows) ----
    getContactInfo: builder.query<ApiEnvelope<ContactInfo>, void>({
      query: () => '/contact/admin/contact',
      providesTags: ['Contact'],
    }),
    updateContactInfo: builder.mutation<ApiEnvelope<ContactInfo>, { email?: string; phoneNumber?: string }>({
      query: (body) => ({ url: '/contact/admin/contact', method: 'PATCH', body }),
      invalidatesTags: ['Contact'],
    }),

    // ---- Dashboard ----
    getStatistics: builder.query<ApiEnvelope<DashboardStatistics>, void>({
      query: () => '/dashboard/statistics',
      providesTags: ['Dashboard'],
    }),
    getCategoryDistribution: builder.query<ApiEnvelope<CategoryDistributionRow[]>, void>({
      query: () => '/dashboard/category-distribution',
      providesTags: ['Dashboard'],
    }),
    getRecentUsers: builder.query<ApiEnvelope<RecentUserRow[]>, { limit?: number } | void>({
      query: (params) => ({ url: '/dashboard/recent-users', params: params ?? undefined }),
      providesTags: ['Dashboard'],
    }),
    getRecentActivities: builder.query<ApiEnvelope<RecentActivityRow[]>, { limit?: number } | void>({
      query: (params) => ({ url: '/dashboard/recent-activities', params: params ?? undefined }),
      providesTags: ['Dashboard'],
    }),

    // ---- Users ----
    getUsers: builder.query<
      ApiEnvelope<AdminUserRow[]>,
      { page?: number; limit?: number; search?: string; status?: string; tab?: string }
    >({
      query: (params) => ({ url: '/users/admin/users', params }),
      providesTags: ['Users'],
    }),
    getUserDetails: builder.query<ApiEnvelope<AdminUserDetails>, string>({
      query: (userId) => `/users/admin/users/${userId}`,
      providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),
    updateUserStatus: builder.mutation<
      ApiEnvelope<AdminUserDetails>,
      { userId: string; status: UserStatus }
    >({
      query: ({ userId, status }) => ({
        url: `/users/admin/users/${userId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_r, _e, { userId }) => ['Users', { type: 'User', id: userId }],
    }),

    // ---- Categories (mobile-shared, active only — used for filter dropdowns) ----
    getActiveCategories: builder.query<ApiEnvelope<CategoryItem[]>, void>({
      query: () => '/categories',
      providesTags: ['Categories'],
    }),

    // ---- Activities ----
    getActivities: builder.query<
      ApiEnvelope<ActivityCard[]>,
      { page?: number; limit?: number; status?: string; categoryId?: string; activityDate?: string; search?: string }
    >({
      query: (params) => ({ url: '/activities/admin/activities', params }),
      providesTags: ['Activities'],
    }),
    getActivityDetails: builder.query<ApiEnvelope<ActivityDetails>, string>({
      query: (id) => `/activities/admin/activities/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Activity', id }],
    }),
    updateActivityStatus: builder.mutation<
      ApiEnvelope<ActivityDetails>,
      { id: string; status: 'Approved' | 'Rejected'; rejectionReason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/activities/admin/activities/${id}/status`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { id }) => ['Activities', 'Dashboard', { type: 'Activity', id }],
    }),
    deleteActivity: builder.mutation<ApiEnvelope<null>, string>({
      query: (id) => ({ url: `/activities/admin/activities/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Activities', 'Dashboard'],
    }),

    // ---- Categories (admin) ----
    getCategories: builder.query<
      ApiEnvelope<{ stats: AdminCategoryStats; categories: AdminCategoryRow[] }>,
      { page?: number; limit?: number; search?: string; status?: string }
    >({
      query: (params) => ({ url: '/categories/admin/categories', params }),
      providesTags: ['Categories'],
    }),
    createCategory: builder.mutation<ApiEnvelope<CategoryItem>, { categoryName: string }>({
      query: (body) => ({ url: '/categories/admin/categories', method: 'POST', body }),
      invalidatesTags: ['Categories'],
    }),
    updateCategory: builder.mutation<
      ApiEnvelope<CategoryItem>,
      { id: string; categoryName?: string; status?: CategoryStatus }
    >({
      query: ({ id, ...body }) => ({ url: `/categories/admin/categories/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Categories'],
    }),
    deleteCategory: builder.mutation<ApiEnvelope<null>, string>({
      query: (id) => ({ url: `/categories/admin/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Categories'],
    }),

    // ---- Notifications ----
    getNotifications: builder.query<
      ApiEnvelope<NotificationRow[]>,
      { page?: number; limit?: number; audience?: string; status?: string }
    >({
      query: (params) => ({ url: '/notifications/admin/notifications', params }),
      providesTags: ['Notifications'],
    }),
    composeNotification: builder.mutation<
      ApiEnvelope<NotificationRow>,
      { notificationTitle: string; messageContent: string; audience: Audience }
    >({
      query: (body) => ({ url: '/notifications/admin/notifications', method: 'POST', body }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useAdminLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useUploadFileMutation,
  useChangePasswordMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useUpdateMyProfilePhotoMutation,
  useUpdateAppPreferencesMutation,
  useGetContactInfoQuery,
  useUpdateContactInfoMutation,
  useGetStatisticsQuery,
  useGetCategoryDistributionQuery,
  useGetRecentUsersQuery,
  useGetRecentActivitiesQuery,
  useGetUsersQuery,
  useGetUserDetailsQuery,
  useUpdateUserStatusMutation,
  useGetActiveCategoriesQuery,
  useGetActivitiesQuery,
  useGetActivityDetailsQuery,
  useUpdateActivityStatusMutation,
  useDeleteActivityMutation,
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetNotificationsQuery,
  useComposeNotificationMutation,
} = apiSlice;
