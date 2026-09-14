/**
 * Wire types shared by the RTK Query slice, the mock backend and the pages.
 *
 * Field names are the camelCase form of the Figma labels — see CLAUDE.md.
 * A few fields marked "Figma-only" have no column in the NestJS API yet; the
 * mock backend supplies them and the pages degrade gracefully without them.
 */
import type { AuthUser } from '../authSlice';

export type UserStatus = 'Pending' | 'Active' | 'Inactive' | 'Suspended' | 'Blocked';
export type ActivityStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Completed';
export type CategoryStatus = 'Active' | 'Disabled' | 'Pending';
export type NotificationStatus = 'Delivered' | 'Failed';
/**
 * Seniors/Volunteers were retired in backend Phase 7: nothing on the user
 * document distinguished them, so neither could resolve to a recipient list.
 * Interests are the only segment the data can answer.
 */
export type Audience = 'Everyone' | 'Interests';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/** Figma-only: the "Type" column on the dashboard's Recent Users table. */
export type MembershipType = 'Senior Member' | 'Volunteer' | 'Sponsor';

export type { AuthUser };

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

/** What POST /auth/refresh-token hands back when the access token has expired. */
export interface RefreshedTokens {
  accessToken: string;
  refreshToken?: string;
}

/** The signed-in admin's own record — GET /users/me. */
export interface MyProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  profilePhoto: string | null;
  role: string;
  status: UserStatus;
  language: string;
  dateFormat: string;
  notificationSounds: boolean;
  allowNotifications: boolean;
  memberSince: string;
}

/** The four fields PATCH /users/me/app-preferences accepts. */
export interface AppPreferences {
  language: string;
  dateFormat: string;
  notificationSounds: boolean;
  allowNotifications: boolean;
}

/** Support details the mobile app shows on its Contact Us screen. */
export interface ContactInfo {
  id: string;
  email: string;
  phoneNumber: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface CategoryItem {
  id: string;
  categoryName: string;
  status: CategoryStatus;
}

export interface AdminCategoryRow extends CategoryItem {
  activityCount: number;
}

export interface AdminCategoryStats {
  totalCategories: number;
  activeNow: number;
}

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
  email: string;
  country: string | null;
  activities: number;
  status: UserStatus;
  dateJoined: string;
}

export interface UserInterest {
  id: string;
  categoryName: string;
}

export interface UserActivityHistoryRow {
  id: string;
  activityName: string;
  categoryName: string;
  activityDate: string;
  status: ActivityStatus;
}

export interface AdminUserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  language: string;
  profilePhoto: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  role: string;
  status: UserStatus;
  dateFormat: string;
  notificationSounds: boolean;
  allowNotifications: boolean;
  isEmailVerified: boolean;
  memberSince: string;
  activityJoined: number;
  activityCreated: number;
  connections: number;
  interests: UserInterest[];
  /** Figma-only — "participating in N neighborhood clusters". */
  neighborhoodClusters?: number;
  activitiesJoined: number;
  activitiesCreated: number;
  joinedActivities: UserActivityHistoryRow[];
  createdActivities: UserActivityHistoryRow[];
}

export interface ActivityOrganizerBrief {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
}

export interface ActivityCard {
  id: string;
  activityName: string;
  activityPhoto: string | null;
  categoryName: string;
  activityDate: string;
  activityTime: string;
  activityLocation: string;
  latitude: number | null;
  longitude: number | null;
  participants: string;
  joinedCount: number;
  maximumNumberOfParticipants: number;
  distanceKm: number | null;
  status: ActivityStatus;
  organizer: ActivityOrganizerBrief;
}

export interface ActivityDetails {
  id: string;
  activityName: string;
  activityPhoto: string | null;
  category: { id: string; categoryName: string };
  activityDate: string;
  activityTime: string;
  activityLocation: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  participants: string;
  joinedCount: number;
  maximumNumberOfParticipants: number;
  participantAvatars: (string | null)[];
  descriptions: string;
  difficulty: Difficulty;
  activityEquipment: string | null;
  activityDuration: string;
  organizer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto: string | null;
  };
  minAge: number;
  maxAge: number;
  ageLimit: string;
  price: number | null;
  status: ActivityStatus;
  rejectionReason: string | null;
  isJoined: boolean;
  isFavorite: boolean;
  createdAt: string;
  /** Figma-only captions under each Activity Highlights tile. */
  ageRangeNote?: string;
  priceNote?: string;
  durationNote?: string;
  /** Figma-only — static map thumbnail in the Location card. */
  mapImage?: string | null;
}

/** A category an Interests broadcast targeted, resolved to its name. */
export interface AudienceCategory {
  id: string;
  categoryName: string;
}

export interface NotificationRow {
  id: string;
  notificationTitle: string;
  messageContent: string;
  audience: Audience;
  /** Empty for Everyone; the targeted categories for Interests. */
  audienceCategories: AudienceCategory[];
  /** How many people the broadcast reached, recorded at send time. */
  recipientCount: number;
  sentDate: string;
  status: NotificationStatus;
}

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
  email: string;
  profilePhoto: string | null;
  dateJoined: string;
  status: UserStatus;
  /** Figma-only — the "Type" column. Falls back to "Senior Member". */
  type?: MembershipType;
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

export interface UploadResult {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}
