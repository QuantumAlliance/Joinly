export const CATEGORIES_ROUTES = {
  ROOT: 'categories',
  LIST: '',
  /** Phase 4 — any authenticated user may propose a category. */
  SUGGEST: '',
  ADMIN_CATEGORIES: 'admin/categories',
  ADMIN_CATEGORY: 'admin/categories/:id',
  /** Phase 4 — approve / reject a proposal. */
  ADMIN_CATEGORY_STATUS: 'admin/categories/:id/status',
} as const;
