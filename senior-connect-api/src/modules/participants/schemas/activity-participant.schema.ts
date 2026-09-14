import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ParticipantStatus } from '../../../common/enums';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type ActivityParticipantDocument = HydratedDocument<ActivityParticipant>;

@Schema({ collection: 'activity_participants', ...baseSchemaOptions })
export class ActivityParticipant {
  @Prop({ type: Types.ObjectId, ref: 'Activity', required: true, index: true })
  activityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ParticipantStatus, default: ParticipantStatus.Joined })
  status: ParticipantStatus;

  @Prop({ type: Date, default: Date.now })
  joinedAt: Date;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const ActivityParticipantSchema = SchemaFactory.createForClass(ActivityParticipant);
// One membership row per user per activity — replaces the composite unique key.
ActivityParticipantSchema.index({ activityId: 1, userId: 1 }, { unique: true });
