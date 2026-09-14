import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtpChannel } from '../../common/enums';
import { ONE_DAY_MS, ONE_HOUR_MS, OTP_RATE_LIMITS } from './auth.constants';
import { OtpRequestLog, OtpRequestLogDocument } from './schemas';

/**
 * Guards OTP issuance against abuse.
 *
 * Every SMS is a charge on the Twilio account, so an unmetered `request-otp`
 * is a way to spend the project's money; email OTPs are cheap but can still be
 * pointed at a third party's inbox. Both channels are metered, on budgets from
 * `OTP_RATE_LIMITS`.
 *
 * Four dimensions, because any one alone has a hole:
 *  - a cooldown, so a held-down button cannot fan out;
 *  - per-identifier hourly and daily caps, against pestering one victim;
 *  - per-IP hourly and daily caps, because a per-number cap alone still lets
 *    one host walk a block of numbers a message at a time and trip nothing.
 *
 * Counts come from `otp_request_logs`, never from `otps`: OTP rows are
 * consumed and TTL-reaped, so counting them would let an attacker refill their
 * own budget just by letting codes expire.
 */
@Injectable()
export class OtpRateLimiterService {
  constructor(
    @InjectModel(OtpRequestLog.name)
    private readonly logModel: Model<OtpRequestLogDocument>,
  ) {}

  /**
   * Throw 429 unless another code may be issued for `identifier` right now.
   * Call before generating a code, never after — the point is to not spend.
   */
  async assertWithinLimits(
    identifier: string,
    channel: OtpChannel,
    ip: string | null,
  ): Promise<void> {
    const budget = OTP_RATE_LIMITS[channel];
    const now = Date.now();
    const hourAgo = new Date(now - ONE_HOUR_MS);
    const dayAgo = new Date(now - ONE_DAY_MS);
    const cooldownAgo = new Date(now - budget.cooldownSeconds * 1000);

    const [sinceCooldown, identifierHour, identifierDay, ipHour, ipDay] = await Promise.all([
      this.logModel.countDocuments({ identifier, channel, createdAt: { $gt: cooldownAgo } }),
      this.logModel.countDocuments({ identifier, channel, createdAt: { $gt: hourAgo } }),
      this.logModel.countDocuments({ identifier, channel, createdAt: { $gt: dayAgo } }),
      ip ? this.logModel.countDocuments({ ip, channel, createdAt: { $gt: hourAgo } }) : 0,
      ip ? this.logModel.countDocuments({ ip, channel, createdAt: { $gt: dayAgo } }) : 0,
    ]);

    if (sinceCooldown > 0) {
      this.reject(
        `Please wait ${budget.cooldownSeconds} seconds before requesting a new code`,
        budget.cooldownSeconds,
      );
    }
    if (identifierHour >= budget.perIdentifierPerHour) {
      this.reject('Too many verification codes requested. Try again in an hour.', 3600);
    }
    if (identifierDay >= budget.perIdentifierPerDay) {
      this.reject('Daily verification code limit reached. Try again tomorrow.', 86400);
    }
    if (ipHour >= budget.perIpPerHour) {
      this.reject('Too many verification codes from this device. Try again in an hour.', 3600);
    }
    if (ipDay >= budget.perIpPerDay) {
      this.reject('Daily verification code limit reached for this device.', 86400);
    }
  }

  /**
   * Record that a code was issued. Written after a successful send so a
   * provider outage does not burn the user's budget.
   */
  async record(identifier: string, channel: OtpChannel, ip: string | null): Promise<void> {
    await this.logModel.create({ identifier, channel, ip });
  }

  /** 429 with a Retry-After, which is what a client needs to back off politely. */
  private reject(message: string, retryAfterSeconds: number): never {
    throw new HttpException(
      { message, retryAfter: retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
