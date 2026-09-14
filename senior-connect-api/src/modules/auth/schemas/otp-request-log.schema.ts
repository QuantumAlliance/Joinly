import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { OtpChannel } from '../../../common/enums';
import { baseSchemaOptions } from '../../../common/schema.helpers';

export type OtpRequestLogDocument = HydratedDocument<OtpRequestLog>;

/**
 * One row per OTP *request*, used only to rate-limit the next one.
 *
 * Separate from `otps` on purpose. An OTP row is consumed, replaced and reaped
 * on its own five-minute TTL; a limiter has to count attempts over a rolling
 * day regardless of what happened to the codes themselves. Counting `otps`
 * would let an attacker reset their own budget simply by letting codes expire.
 *
 * SMS costs real money per message, so this ledger is not optional — see
 * `OTP_RATE_LIMITS`.
 */
@Schema({ collection: 'otp_request_logs', ...baseSchemaOptions })
export class OtpRequestLog {
  /** Email or E.164 number the code was requested for. */
  @Prop({ required: true, trim: true })
  identifier: string;

  @Prop({ type: String, enum: OtpChannel, required: true })
  channel: OtpChannel;

  /** Caller IP, so one host cannot walk a list of numbers. */
  @Prop({ type: String, default: null })
  ip: string | null;

  /** Supplied by `timestamps: true`; declared so TypeScript sees them. */
  createdAt: Date;

  updatedAt: Date;
}

export const OtpRequestLogSchema = SchemaFactory.createForClass(OtpRequestLog);
// The two windows the limiter counts over.
OtpRequestLogSchema.index({ identifier: 1, channel: 1, createdAt: -1 });
OtpRequestLogSchema.index({ ip: 1, channel: 1, createdAt: -1 });
// Nothing older than the widest window (a day) can affect a decision. Give it
// a margin so a request landing on the boundary still sees a full day.
OtpRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 26 });
