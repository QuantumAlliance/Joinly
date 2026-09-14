import { UserRole, UserStatus } from '../../../common/enums';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  /** Null for an account that registered from a phone number alone. */
  email: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  /** Canonical E.164 form of the pair above; the phone login identifier. */
  phoneE164: string | null;
  dateOfBirth: string | null;
  language: string;
  profilePhoto: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  role: UserRole;
  status: UserStatus;
  dateFormat: string;
  notificationSounds: boolean;
  allowNotifications: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  memberSince: Date;
}

export interface MyProfileResponse extends UserProfile {
  activityJoined: number;
  activityCreated: number;
  connections: number;
  interests: { id: string; categoryName: string }[];
}

/**
 * One step of the Figma profile completeness ring.
 *
 * `key` is the stable identifier a client keys its deep-link off; `label` is
 * the wording from the frame, so the ring needs no copy of its own.
 */
export interface CompletenessStep {
  key: 'name' | 'interests' | 'location' | 'profilePhoto';
  label: string;
  done: boolean;
}

export interface ProfileCompleteness {
  /** 0–100, rounded. Every step weighs the same. */
  percentage: number;
  completed: number;
  total: number;
  steps: CompletenessStep[];
}

export interface AdminUserRow {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
  email: string | null;
  country: string | null;
  activities: number;
  status: UserStatus;
  dateJoined: Date;
}

export interface AdminUserDetails extends MyProfileResponse {
  phoneNumber: string | null;
  activitiesJoined: number;
  activitiesCreated: number;
  joinedActivities: unknown[];
  createdActivities: unknown[];
}

export interface BlockedUserRow {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
}
