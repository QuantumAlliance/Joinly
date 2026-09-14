import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailService } from '../../common/services/mail.service';
import { OtpDeliveryService } from '../../common/services/otp-delivery.service';
import { SmsService } from '../../common/services/sms.service';
import { User, UserSchema } from '../users/schemas';
import { AuthController } from './auth.controller';
import { Otp, OtpRequestLog, OtpRequestLogSchema, OtpSchema } from './schemas';
import { AuthService } from './auth.service';
import { OtpRateLimiterService } from './otp-rate-limiter.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Otp.name, schema: OtpSchema },
      { name: OtpRequestLog.name, schema: OtpRequestLogSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpRateLimiterService,
    // Both transports are registered with OtpDeliveryService, which is the
    // only thing AuthService talks to. A third provider is added here.
    MailService,
    SmsService,
    OtpDeliveryService,
  ],
})
export class AuthModule {}
