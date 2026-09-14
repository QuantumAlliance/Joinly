import { NotificationAudience, NotificationStatus } from '../../../common/enums';

/** A category a broadcast targeted, resolved for the Audience column. */
export interface AudienceCategory {
  id: string;
  categoryName: string;
}

export interface NotificationRow {
  id: string;
  notificationTitle: string;
  messageContent: string;
  audience: NotificationAudience;
  /** Empty for `Everyone`; the targeted categories for `Interests`. */
  audienceCategories: AudienceCategory[];
  /** How many people the broadcast reached, recorded at send time. */
  recipientCount: number;
  sentDate: Date;
  status: NotificationStatus;
}

export interface MyNotificationRow extends NotificationRow {
  isRead: boolean;
  readAt: Date | null;
}

/** The bell badge. */
export interface UnreadCount {
  unreadCount: number;
}
