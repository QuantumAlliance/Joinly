import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from '../../../common/enums';
import { baseSchemaOptions, GeoPoint, GeoPointSchema } from '../../../common/schema.helpers';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', ...baseSchemaOptions })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  /**
   * Nullable since Phase 2: registration can start from a phone number alone,
   * so an account may have no email yet. Uniqueness is enforced by the partial
   * index below rather than `unique: true` — a plain unique index treats every
   * `null` as a colliding value and would allow exactly one phone-only account
   * to exist.
   */
  @Prop({ type: String, default: null, lowercase: true, trim: true })
  email: string | null;

  /** Never returned: every query must opt in with .select('+password'). */
  @Prop({ required: true, select: false })
  password: string;

  /** Dial code chosen in the phone field's country selector, e.g. "+41". */
  @Prop({ type: String, default: null })
  phoneCountryCode: string | null;

  @Prop({ type: String, default: null })
  phoneNumber: string | null;

  /**
   * The canonical E.164 form of `phoneCountryCode` + `phoneNumber`, and the
   * only phone field that is a login identifier. The Figma split stays as the
   * display surface; neither half is unique on its own, so the normalised
   * number is what carries the index and what OTPs are keyed on.
   */
  @Prop({ type: String, default: null, trim: true })
  phoneE164: string | null;

  @Prop({ default: false })
  isPhoneVerified: boolean;

  /** Stored as an ISO date string ("1951-04-08"), as the API surface expects. */
  @Prop({ type: String, default: null })
  dateOfBirth: string | null;

  @Prop({ default: 'English (United States)' })
  language: string;

  @Prop({ type: String, default: null })
  profilePhoto: string | null;

  @Prop({ type: String, default: null })
  country: string | null;

  @Prop({ type: String, default: null })
  region: string | null;

  @Prop({ type: String, default: null })
  city: string | null;

  @Prop({ type: Number, default: null })
  latitude: number | null;

  @Prop({ type: Number, default: null })
  longitude: number | null;

  /**
   * GeoJSON mirror of latitude/longitude, kept in sync by the users service so
   * $geoNear can use a 2dsphere index instead of scanning every document.
   */
  @Prop({ type: GeoPointSchema, default: undefined })
  location?: GeoPoint;

  @Prop({ type: String, enum: UserRole, default: UserRole.User })
  role: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.Pending })
  status: UserStatus;

  @Prop({ default: 'MM/DD/YYYY' })
  dateFormat: string;

  @Prop({ default: true })
  notificationSounds: boolean;

  @Prop({ default: true })
  allowNotifications: boolean;

  @Prop({ default: false })
  isEmailVerified: boolean;

  /**
   * When the user accepted the Terms & Conditions and Privacy Policy. Recorded
   * because "they ticked a box" is not evidence unless the moment is stored.
   */
  @Prop({ type: Date, default: null })
  acceptedTermsAt: Date | null;

  @Prop({ type: String, default: null, select: false })
  refreshToken: string | null;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ location: '2dsphere' });

/**
 * Both login identifiers are unique *among the accounts that have one*.
 *
 * `partialFilterExpression` rather than `sparse`: sparse only skips documents
 * where the field is absent, and Mongoose writes an explicit `null` for these
 * defaults. Filtering on `$type: 'string'` is what actually lets many accounts
 * sit at `email: null` (phone-only) or `phoneE164: null` (email-only) while
 * still rejecting a second account claiming a value already taken.
 *
 * These replace the old plain `unique: true` on `email`. A database created
 * before Phase 2 still carries that index and must have it dropped —
 * `npm run db:sync-indexes`.
 */
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
UserSchema.index(
  { phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: 'string' } } },
);
