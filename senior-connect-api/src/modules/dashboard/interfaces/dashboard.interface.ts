import { ActivityStatus, UserStatus } from '../../../common/enums';

/** Figma stat cards: TOTAL USERS / TOTAL ACTIVITIES / TOTAL REGISTRATIONS / PENDING APPROVALS */
export interface DashboardStatistics {
  totalUsers: number;
  totalActivities: number;
  totalRegistrations: number;
  pendingApprovals: number;
}

export interface CategoryDistributionRow {
  categoryName: string;
  activityCount: number;
  percentage: number;
}

export interface RecentUserRow {
  id: string;
  firstName: string;
  lastName: string;
  /** Null for an account that registered from a phone number alone. */
  email: string | null;
  profilePhoto: string | null;
  dateJoined: Date;
  status: UserStatus;
}

export interface RecentActivityRow {
  id: string;
  activityName: string;
  activityPhoto: string | null;
  activityLocation: string;
  categoryName: string;
  activityDate: string;
  status: ActivityStatus;
}
