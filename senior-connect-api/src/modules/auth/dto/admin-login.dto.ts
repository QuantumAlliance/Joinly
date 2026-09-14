import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Figma "Admin Login" — Email Address, Password, Remember Me.
 *
 * Deliberately not an `IdentifierDto`: the dashboard signs in by email only.
 * Phone is a mobile login identifier, and admin access should not be reachable
 * through the SMS flow.
 */
export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
