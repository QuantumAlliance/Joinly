import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CategoryStatus } from '../../../common/enums';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ collection: 'categories', ...baseSchemaOptions })
export class Category {
  @Prop({ required: true, unique: true, trim: true, index: true })
  categoryName: string;

  @Prop({ type: String, enum: CategoryStatus, default: CategoryStatus.Active, index: true })
  status: CategoryStatus;

  /**
   * Who proposed it, when it came from a user rather than an admin. Null for
   * the seeded Figma categories and anything an admin adds — the review queue
   * needs to know which rows have someone waiting on them.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  proposedBy: Types.ObjectId | null;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
