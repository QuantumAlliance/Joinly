import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { OtpType } from '../../../common/enums';
import { HasExactlyOneIdentifier, IdentifierDto } from './identifier.dto';

/** Figma "OTP verification" — We've sent a verification code to your email. */
export class VerifyOtpDto extends IdentifierDto {
  // Class-wide constraint; attached to `otpCode` for want of a property.
  @HasExactlyOneIdentifier()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otpCode must be a 6 digit code' })
  otpCode: string;

  /**
   * Defaults to the verification type matching the identifier supplied —
   * `VerifyEmail` for an email, `VerifyPhone` for a number.
   */
  @IsOptional()
  @IsEnum(OtpType)
  type?: OtpType;
}
