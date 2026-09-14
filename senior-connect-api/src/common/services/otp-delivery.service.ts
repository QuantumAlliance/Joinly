import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OtpChannel } from '../enums';
import { MailService } from './mail.service';
import { OtpTransport } from './otp-transport.interface';
import { SmsService } from './sms.service';

/**
 * Routes an OTP to whichever transport serves its channel.
 *
 * The point of the indirection is that `AuthService` issues codes without
 * knowing that email is nodemailer or that SMS is Twilio. A third identity
 * provider registers here and every call site keeps working — the reason the
 * phase brief asks for room for one rather than two hard-coded branches.
 */
@Injectable()
export class OtpDeliveryService {
  private readonly transports: Map<OtpChannel, OtpTransport>;

  constructor(
    private readonly mailService: MailService,
    private readonly smsService: SmsService,
  ) {
    this.transports = new Map(
      [mailService, smsService].map((transport) => [transport.channel, transport]),
    );
  }

  /** Deliver a code, or fail loudly if nothing serves the channel. */
  async send(
    channel: OtpChannel,
    destination: string,
    otpCode: string,
    purpose: string,
  ): Promise<void> {
    const transport = this.transports.get(channel);
    if (!transport) {
      throw new InternalServerErrorException(`No OTP transport registered for ${channel}`);
    }
    await transport.send(destination, otpCode, purpose);
  }
}
