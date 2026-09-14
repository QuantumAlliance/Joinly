import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ActivityStatus, Difficulty } from '../../../common/enums';
import { baseSchemaOptions, GeoPoint, GeoPointSchema } from '../../../common/schema.helpers';

export type ActivityDocument = HydratedDocument<Activity>;

@Schema({ collection: 'activities', ...baseSchemaOptions })
export class Activity {
  @Prop({ required: true, trim: true })
  activityName: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  descriptions: string;

  @Prop({ type: Number, required: true })
  maximumNumberOfParticipants: number;

  /**
   * Denormalised count of Joined participants. Maintained with atomic $inc so
   * the capacity check on join is a single conditional update rather than a
   * read-then-write race.
   */
  @Prop({ type: Number, default: 0 })
  joinedCount: number;

  @Prop({ type: String, default: null })
  activityPhoto: string | null;

  /** ISO date string ("2023-10-24"). */
  @Prop({ required: true })
  activityDate: string;

  /** 24h time string ("10:00"). */
  @Prop({ required: true })
  activityTime: string;

  @Prop({ required: true })
  activityDuration: string;

  @Prop({ type: String, default: null })
  activityEquipment: string | null;

  @Prop({ required: true })
  activityLocation: string;

  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  @Prop({ type: GeoPointSchema, default: undefined })
  location?: GeoPoint;

  @Prop({ type: Number, required: true })
  minAge: number;

  @Prop({ type: Number, required: true })
  maxAge: number;

  @Prop({ type: Number, default: null })
  price: number | null;

  @Prop({ type: String, enum: Difficulty, default: Difficulty.Beginner })
  difficulty: Difficulty;

  @Prop({ type: String, enum: ActivityStatus, default: ActivityStatus.Pending, index: true })
  status: ActivityStatus;

  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  organizerId: Types.ObjectId;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.index({ location: '2dsphere' });
// Discover sorts by date within a status; popular sorts by joinedCount.
ActivitySchema.index({ status: 1, activityDate: 1 });
ActivitySchema.index({ status: 1, joinedCount: -1 });
ActivitySchema.index({ activityName: 'text' });
