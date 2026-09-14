import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationAudience, NotificationStatus } from '../../../common/enums';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ collection: 'notifications', ...baseSchemaOptions })
export class Notification {
  /** Figma: "Notification Title" */
  @Prop({ required: true })
  notificationTitle: string;

  /** Figma: "Message Content" */
  @Prop({ required: true })
  messageContent: string;

  /** Figma: "AUDIENCE" — Everyone, or the interest segment below. */
  @Prop({ type: String, enum: NotificationAudience, default: NotificationAudience.Everyone })
  audience: NotificationAudience;

  /**
   * The categories an `Interests` broadcast targets. Empty for `Everyone`.
   *
   * Stored as ids rather than names so a renamed category keeps its history
   * accurate; the admin list resolves them to names for the Audience column.
   */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  audienceCategoryIds: Types.ObjectId[];

  /**
   * How many people it actually reached, recorded at send time.
   *
   * Segments make this worth keeping: "Delivered" alone cannot distinguish a
   * broadcast that reached six hundred people from one whose segment resolved
   * to nobody, and both are otherwise indistinguishable in the history table.
   */
  @Prop({ type: Number, default: 0 })
  recipientCount: number;

  /** Figma: "STATUS" — Delivered | Failed */
  @Prop({ type: String, enum: NotificationStatus, default: NotificationStatus.Delivered })
  status: NotificationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  sentBy: Types.ObjectId | null;

  /** Figma: "SENT DATE" */
  @Prop({ type: Date, default: Date.now })
  sentDate: Date;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ sentDate: -1 });
