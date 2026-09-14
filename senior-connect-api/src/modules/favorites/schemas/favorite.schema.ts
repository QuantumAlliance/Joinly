import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ collection: 'favorites', ...baseSchemaOptions })
export class Favorite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Activity', required: true, index: true })
  activityId: Types.ObjectId;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);
FavoriteSchema.index({ userId: 1, activityId: 1 }, { unique: true });
