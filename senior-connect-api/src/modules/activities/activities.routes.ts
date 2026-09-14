export const ACTIVITIES_ROUTES = {
  ROOT: 'activities',
  LIST: '',
  FEATURED: 'featured',
  /** Phase 3 — Home hero count and search autocomplete. */
  SUMMARY: 'summary',
  SUGGESTIONS: 'suggestions',
  MY_ACTIVITIES: 'my-activities',
  JOINED_ACTIVITIES: 'joined-activities',
  DETAILS: ':id',
  ADMIN_ACTIVITIES: 'admin/activities',
  ADMIN_ACTIVITY: 'admin/activities/:id',
  ADMIN_ACTIVITY_STATUS: 'admin/activities/:id/status',
} as const;
