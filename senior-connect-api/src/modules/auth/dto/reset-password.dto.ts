import { IsString, Matches, MinLength } from 'class-validator';
import { HasExactlyOneIdentifier, IdentifierDto } from './identifier.dto';

/** Figma "Reset Password" — redeem the code and set a new password. */
export class ResetPasswordDto extends IdentifierDto {
  // Class-wide constraint; attached to `otpCode` for want of a property.
  @HasExactlyOneIdentifier()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otpCode must be a 6 digit code' })
  otpCode: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
