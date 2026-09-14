import { CategoryStatus } from '../../../common/enums';

export interface CategoryItem {
  id: string;
  categoryName: string;
  status: CategoryStatus;
}

export interface AdminCategoryRow extends CategoryItem {
  activityCount: number;
  /** Null unless a user proposed it — admin-added and seeded rows have no proposer. */
  proposedBy: { id: string; firstName: string; lastName: string } | null;
  createdAt: Date;
}

export interface AdminCategoryStats {
  totalCategories: number;
  activeNow: number;
  /** Badge for the review queue. */
  pendingReview: number;
}
