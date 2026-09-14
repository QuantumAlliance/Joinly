import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type UserNotificationDocument = HydratedDocument<UserNotification>;

/** Per-recipient delivery row — carries the read state for one user. */
@Schema({ collection: 'user_notifications', ...baseSchemaOptions })
export class UserNotification {
  @Prop({ type: Types.ObjectId, ref: 'Notification', required: true, index: true })
  notificationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);
UserNotificationSchema.index({ notificationId: 1, userId: 1 }, { unique: true });
// Powers the unread badge count.
UserNotificationSchema.index({ userId: 1, isRead: 1 });
