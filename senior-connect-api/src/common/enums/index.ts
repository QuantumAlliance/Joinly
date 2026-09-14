export enum UserRole {
  User = 'User',
  Admin = 'Admin',
}

export enum UserStatus {
  Pending = 'Pending',
  Active = 'Active',
  Inactive = 'Inactive',
  Suspended = 'Suspended',
  Blocked = 'Blocked',
}

export enum ActivityStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
  Completed = 'Completed',
}

export enum CategoryStatus {
  Active = 'Active',
  Disabled = 'Disabled',
  /**
   * Proposed by a user and awaiting admin review.
   *
   * Non-blocking: the activity that introduced the category publishes
   * immediately and still renders it. Approval only decides whether the
   * category joins the public chips for everyone else.
   */
  Pending = 'Pending',
}

export enum Difficulty {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export enum OtpType {
  VerifyEmail = 'VerifyEmail',
  ResetPassword = 'ResetPassword',
  VerifyPhone = 'VerifyPhone',
  PhoneLogin = 'PhoneLogin',
}

/**
 * How an OTP reaches the user. The value also selects the transport in
 * `OtpDeliveryService`, so adding a channel (WhatsApp, an authenticator app)
 * is a new member plus one registered transport — not a rewrite of the auth
 * service. Google sign-in slots in the same way once it lands.
 */
export enum OtpChannel {
  Email = 'Email',
  Sms = 'Sms',
}

export enum ParticipantStatus {
  Joined = 'Joined',
  /** The participant left of their own accord. They may join again. */
  Cancelled = 'Cancelled',
  /**
   * Ejected by the organizer. Distinct from `Cancelled` because it is the
   * organizer's decision, not the participant's — and unlike `Cancelled` it
   * bars re-joining, which is the only thing that makes removal stick.
   */
  Removed = 'Removed',
}

/**
 * Who a broadcast is aimed at.
 *
 * `Seniors` and `Volunteers` were removed in Phase 7. Nothing on the user
 * document distinguished a senior from a volunteer, so neither value could ever
 * be resolved into a recipient list — every broadcast went to everyone whatever
 * the column said. Interests are the only segment the data can actually answer.
 */
export enum NotificationAudience {
  Everyone = 'Everyone',
  /** Users whose chosen interests include any of `audienceCategoryIds`. */
  Interests = 'Interests',
}

export enum NotificationStatus {
  Delivered = 'Delivered',
  Failed = 'Failed',
}

export enum ActivityTab {
  All = 'All',
  Upcoming = 'Upcoming',
  Past = 'Past',
}
