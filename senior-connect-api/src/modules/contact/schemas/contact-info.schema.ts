import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type ContactInfoDocument = HydratedDocument<ContactInfo>;

/**
 * "Contact Us" content — a single app-wide record. Mobile reads it; admin
 * edits it from the dashboard.
 */
@Schema({ collection: 'contact_info', ...baseSchemaOptions })
export class ContactInfo {
  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phoneNumber: string;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const ContactInfoSchema = SchemaFactory.createForClass(ContactInfo);
