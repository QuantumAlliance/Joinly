import { OtpChannel } from '../../common/enums';

/** Budget for one dimension of the limiter. */
export interface OtpRateBudget {
  /** Minimum gap between two consecutive requests for the same identifier. */
  cooldownSeconds: number;
  /** Rolling-hour cap for a single identifier. */
  perIdentifierPerHour: number;
  /** Hard daily cap for a single identifier. */
  perIdentifierPerDay: number;
  /** Rolling-hour cap for a single caller IP, across all identifiers. */
  perIpPerHour: number;
  /** Hard daily cap for a single caller IP. */
  perIpPerDay: number;
}

/** Read a positive integer from the environment, or fall back. */
const num = (key: string, fallback: number): number => {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/**
 * OTP request budgets, per channel.
 *
 * SMS is deliberately far tighter than email: every message is a real charge
 * on the Twilio account, and an unmetered `request-otp` endpoint is a way to
 * spend someone else's money. The per-IP caps are the half that matters — a
 * per-number cap alone still lets one host walk a block of numbers, one
 * message each, and trip nothing.
 *
 * Email is metered too. It is cheap rather than free, and the same endpoint
 * can be pointed at a third party's inbox. Its ceiling is set high enough that
 * the regression harness (~13 accounts from one host per full run) never
 * trips it.
 *
 * Every budget is overridable from `.env`. The defaults are the ones to ship
 * with; the overrides exist because the right SMS ceiling depends on the
 * Twilio plan behind it, and because the harness runs every flow from a single
 * host and would otherwise trip the per-IP cap on repeated runs.
 */
export const OTP_RATE_LIMITS: Record<OtpChannel, OtpRateBudget> = {
  [OtpChannel.Email]: {
    cooldownSeconds: num('OTP_EMAIL_COOLDOWN_SECONDS', 60),
    perIdentifierPerHour: num('OTP_EMAIL_MAX_PER_IDENTIFIER_HOUR', 5),
    perIdentifierPerDay: num('OTP_EMAIL_MAX_PER_IDENTIFIER_DAY', 15),
    perIpPerHour: num('OTP_EMAIL_MAX_PER_IP_HOUR', 100),
    perIpPerDay: num('OTP_EMAIL_MAX_PER_IP_DAY', 300),
  },
  [OtpChannel.Sms]: {
    cooldownSeconds: num('OTP_SMS_COOLDOWN_SECONDS', 60),
    perIdentifierPerHour: num('OTP_SMS_MAX_PER_IDENTIFIER_HOUR', 3),
    perIdentifierPerDay: num('OTP_SMS_MAX_PER_IDENTIFIER_DAY', 10),
    perIpPerHour: num('OTP_SMS_MAX_PER_IP_HOUR', 15),
    perIpPerDay: num('OTP_SMS_MAX_PER_IP_DAY', 40),
  },
};

export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
