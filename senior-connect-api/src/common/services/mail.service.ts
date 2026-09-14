import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { OtpChannel } from '../enums';
import { OtpTransport } from './otp-transport.interface';

const BRAND_NAME = 'Joinly';
const LOGO_CID = 'joinly-logo';

@Injectable()
export class MailService implements OtpTransport {
  readonly channel = OtpChannel.Email;

  private readonly logger = new Logger(MailService.name);

  /** `OtpTransport` entry point; email delivery is `sendOtpEmail`. */
  send(destination: string, otpCode: string, purpose: string): Promise<void> {
    return this.sendOtpEmail(destination, otpCode, purpose);
  }

  /** Read an env var, accepting either the primary key or any legacy aliases. */
  private env(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = process.env[key];
      if (value) return value;
    }
    return undefined;
  }

  private get fromAddress(): string {
    // e.g. backenddev0001@gmail.com — falls back to the SMTP login.
    return (
      this.env('EMAIL_FROM', 'SMTP_FROM_EMAIL') ||
      this.env('SMTP_USERNAME', 'SMTP_USER') ||
      'no-reply@joinly.io'
    );
  }

  private get from(): string {
    // Display name is always the company name: "Joinly <address>".
    return `${BRAND_NAME} <${this.fromAddress}>`;
  }

  /** Locate the Joinly logo so it can be attached inline (CID). */
  private resolveLogoPath(): string | undefined {
    const candidates = [
      path.join(process.cwd(), 'assets', 'joinly-logo.png'),
      path.join(__dirname, '..', '..', '..', 'assets', 'joinly-logo.png'),
    ];
    return candidates.find((p) => fs.existsSync(p));
  }

  async sendOtpEmail(email: string, otpCode: string, purpose: string): Promise<void> {
    const expiresIn = Number(process.env.OTP_EXPIRES_IN_MINUTES) || 5;
    const subject = `Your ${BRAND_NAME} verification code`;
    const text =
      `${BRAND_NAME}\n\n` +
      `Your verification code is ${otpCode}.\n` +
      `This code expires in ${expiresIn} minutes.\n\n` +
      `If you didn't request this, you can safely ignore this email.\n`;
    const html = this.buildOtpHtml(otpCode, purpose, expiresIn);

    const host = this.env('SMTP_HOST');
    if (!host) {
      this.logger.log(`[DEV] OTP for ${email} (${purpose}): ${otpCode}`);
      return;
    }

    const port = Number(this.env('SMTP_PORT')) || 587;
    const user = this.env('SMTP_USERNAME', 'SMTP_USER');
    const pass = this.env('SMTP_PASSWORD', 'SMTP_PASS');

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });

    const logoPath = this.resolveLogoPath();
    const attachments = logoPath
      ? [{ filename: 'joinly-logo.png', path: logoPath, cid: LOGO_CID }]
      : [];
    if (!logoPath) {
      this.logger.warn('Joinly logo not found — sending OTP email without the logo image.');
    }

    try {
      const info = await transporter.sendMail({
        from: this.from,
        to: email,
        subject,
        text,
        html,
        attachments,
      });
      this.logger.log(`OTP email sent to ${email} (${purpose}) — messageId ${info.messageId}`);
    } catch (err) {
      // Surface the real reason (bad credentials, blocked login, etc.) instead of failing silently.
      this.logger.error(
        `Failed to send OTP email to ${email} (${purpose}): ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /** Clean, Apple-style transactional layout: generous white space, system font, minimal color. */
  private buildOtpHtml(otpCode: string, purpose: string, expiresIn: number): string {
    const font =
      "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";
    return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:56px 24px;">
          <table role="presentation" width="392" cellpadding="0" cellspacing="0" style="max-width:392px;width:100%;">
            <tr>
              <td align="center" style="padding-bottom:40px;">
                <img src="cid:${LOGO_CID}" alt="${BRAND_NAME}" height="30" style="height:30px;width:auto;display:block;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td align="center">
                <h1 style="margin:0;font-family:${font};font-size:26px;line-height:1.25;font-weight:600;color:#1d1d1f;letter-spacing:-0.02em;">${purpose}</h1>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:14px 0 36px 0;">
                <p style="margin:0;font-family:${font};font-size:17px;line-height:1.5;font-weight:400;color:#6e6e73;">
                  Enter this code to continue. It expires in ${expiresIn}&nbsp;minutes.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:40px;">
                <div style="font-family:${font};font-size:44px;line-height:1;font-weight:600;letter-spacing:0.24em;color:#1d1d1f;padding-left:0.24em;">${otpCode}</div>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #d2d2d7;padding-top:28px;">
                <p style="margin:0 0 6px 0;font-family:${font};font-size:13px;line-height:1.5;font-weight:400;color:#86868b;">
                  If you didn't request this code, you can safely ignore this email — no changes will be made to your account.
                </p>
                <p style="margin:0;font-family:${font};font-size:13px;line-height:1.5;font-weight:400;color:#86868b;">
                  &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
