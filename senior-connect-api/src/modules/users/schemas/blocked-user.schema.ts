import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type BlockedUserDocument = HydratedDocument<BlockedUser>;

/** One person's personal block list — distinct from an account-level ban. */
@Schema({ collection: 'blocked_users', ...baseSchemaOptions })
export class BlockedUser {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  blockerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  blockedId: Types.ObjectId;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const BlockedUserSchema = SchemaFactory.createForClass(BlockedUser);
BlockedUserSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
