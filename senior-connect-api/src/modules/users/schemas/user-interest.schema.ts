import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type UserInterestDocument = HydratedDocument<UserInterest>;

@Schema({ collection: 'user_interests', ...baseSchemaOptions })
export class UserInterest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const UserInterestSchema = SchemaFactory.createForClass(UserInterest);
UserInterestSchema.index({ userId: 1, categoryId: 1 }, { unique: true });
