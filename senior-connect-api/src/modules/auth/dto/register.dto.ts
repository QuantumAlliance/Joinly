import { Equals, IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';
import { HasAtLeastOneIdentifier, IdentifierDto } from './identifier.dto';

/**
 * Figma "Create Account" — Place all the information to create account.
 *
 * Registration can start from either identifier. Supplying both is allowed and
 * is the normal mobile path: the account is created with both, and each is
 * verified by its own OTP.
 */
export class RegisterDto extends IdentifierDto {
  // Class-wide constraint; attached to `firstName` because a decorator needs a
  // property to hang off.
  @HasAtLeastOneIdentifier()
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  password: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  language?: string;

  /** "By creating an account, I accept the Terms & Conditions & Privacy Policy." */
  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms & Conditions & Privacy Policy.' })
  acceptTerms: boolean;
}
