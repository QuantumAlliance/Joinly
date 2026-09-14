import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OtpChannel, OtpType } from '../../../common/enums';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type OtpDocument = HydratedDocument<Otp>;

@Schema({ collection: 'otps', ...baseSchemaOptions })
export class Otp {
  /**
   * Whichever identifier the code was issued against — a lowercased email or
   * an E.164 phone number. Phase 2 made phone a first-class login identifier,
   * so keying on `email` alone stopped being possible.
   *
   * Not lowercased by the schema: that is right for an email and meaningless
   * for a number. Callers normalise before they get here (`normalizeEmail` /
   * `resolvePhone`), which is also what makes the lookup in `consumeOtp` hit.
   */
  @Prop({ required: true, trim: true, index: true })
  identifier: string;

  /** Which transport carried it. Kept so delivery can be audited per channel. */
  @Prop({ type: String, enum: OtpChannel, required: true })
  channel: OtpChannel;

  @Prop({ required: true })
  otpCode: string;

  @Prop({ type: String, enum: OtpType, required: true })
  type: OtpType;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isUsed: boolean;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
// Mongo reaps expired codes on its own; the service still checks expiresAt so
// behaviour does not depend on the reaper's timing.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Serves both the claim in consumeOtp and the cooldown lookup in issueOtp.
OtpSchema.index({ identifier: 1, type: 1, isUsed: 1, createdAt: -1 });
