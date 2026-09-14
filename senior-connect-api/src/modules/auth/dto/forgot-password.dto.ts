import { IsOptional } from 'class-validator';
import { HasExactlyOneIdentifier, IdentifierDto } from './identifier.dto';

/**
 * Figma "Forget password?" — Enter your email address to reset your password.
 *
 * Also accepts a phone number. An account that registered from a phone alone
 * has no email to send a reset code to, so restricting recovery to email would
 * leave those accounts permanently unrecoverable.
 */
export class ForgotPasswordDto extends IdentifierDto {
  // Class-wide constraint; `_identifier` exists only to carry it, and is
  // stripped by the global whitelisting ValidationPipe.
  @HasExactlyOneIdentifier()
  @IsOptional()
  _identifier?: never;
}
