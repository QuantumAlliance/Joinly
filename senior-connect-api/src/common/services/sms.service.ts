import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '../enums';
import { maskPhone } from '../utils/phone.util';
import { OtpTransport } from './otp-transport.interface';

const BRAND_NAME = 'Joinly';
const TWILIO_API = 'https://api.twilio.com/2010-04-01';

/**
 * SMS OTP delivery via Twilio.
 *
 * Mirrors `MailService`: when the provider is not configured the code is
 * logged instead of sent, so the whole phone flow is testable with no Twilio
 * account and no spend. That fallback is what "can be built and tested against
 * a stubbed sender first" means in practice.
 *
 * Talks to Twilio's REST endpoint over `fetch` rather than pulling the SDK —
 * sending one message is a single form-encoded POST, and the SDK would add a
 * dependency for it.
 */
@Injectable()
export class SmsService implements OtpTransport {
  readonly channel = OtpChannel.Sms;

  private readonly logger = new Logger(SmsService.name);

  private env(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = process.env[key];
      if (value) return value;
    }
    return undefined;
  }

  /** True once every credential a live send needs is present. */
  get isConfigured(): boolean {
    return Boolean(
      this.env('TWILIO_ACCOUNT_SID') &&
        this.env('TWILIO_AUTH_TOKEN') &&
        this.env('TWILIO_FROM_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID'),
    );
  }

  async send(destination: string, otpCode: string, purpose: string): Promise<void> {
    const expiresIn = Number(process.env.OTP_EXPIRES_IN_MINUTES) || 5;
    const body =
      `${otpCode} is your ${BRAND_NAME} verification code. ` +
      `It expires in ${expiresIn} minutes. If you didn't request it, ignore this message.`;

    if (!this.isConfigured) {
      // Same shape as the mail service's dev fallback, so both channels are
      // greppable with one pattern.
      this.logger.log(`[DEV] OTP for ${maskPhone(destination)} (${purpose}): ${otpCode}`);
      return;
    }

    const accountSid = this.env('TWILIO_ACCOUNT_SID') as string;
    const authToken = this.env('TWILIO_AUTH_TOKEN') as string;
    const messagingServiceSid = this.env('TWILIO_MESSAGING_SERVICE_SID');
    const fromNumber = this.env('TWILIO_FROM_NUMBER');

    const form = new URLSearchParams({ To: destination, Body: body });
    // A Messaging Service handles sender pools and per-country compliance;
    // prefer it when both are set.
    if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid);
    else form.set('From', fromNumber as string);

    try {
      const response = await fetch(`${TWILIO_API}/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
      });

      if (!response.ok) {
        // Twilio puts the actionable reason in the JSON body, not the status.
        const detail = await response.text();
        throw new Error(`Twilio responded ${response.status}: ${detail.slice(0, 300)}`);
      }

      const sent = (await response.json()) as { sid?: string };
      this.logger.log(
        `OTP SMS sent to ${maskPhone(destination)} (${purpose}) — sid ${sent.sid ?? 'unknown'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send OTP SMS to ${maskPhone(destination)} (${purpose}): ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
