import { IsString } from 'class-validator';
import { HasExactlyOneIdentifier, IdentifierDto } from './identifier.dto';

/**
 * Figma "Welcome Back — Sign in to access your account".
 *
 * Takes either identifier: email + password, or phone + password. Phase 2 made
 * phone a first-class login credential, not just a profile field.
 */
export class LoginDto extends IdentifierDto {
  // The constraint is class-wide; it hangs off `password` only because a
  // decorator needs some property to attach to.
  @HasExactlyOneIdentifier()
  @IsString()
  password: string;
}
