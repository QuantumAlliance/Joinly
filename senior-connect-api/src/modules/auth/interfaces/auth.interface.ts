import { OtpChannel } from '../../../common/enums';
import { UserProfile } from '../../users/interfaces/users.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserProfile;
}

/**
 * Acknowledgement that a code went out. Echoes back whichever identifier it
 * was sent to, so the client's OTP screen can label itself without having to
 * remember what it submitted.
 */
export interface OtpSentResponse {
  email: string | null;
  phoneE164: string | null;
  channel: OtpChannel;
  otpSent: boolean;
}

/** Registration: which of the two identifiers received a code. */
export interface RegisterResponse extends OtpSentResponse {
  /** Both are sent when registration supplied both identifiers. */
  channels: OtpChannel[];
}

/**
 * Result of redeeming a phone code. A phone verified against an account the
 * caller was not already signed in to is also a sign-in, so tokens come back;
 * linking a number to the account you are already using does not re-issue them.
 */
export interface PhoneVerifiedResponse {
  phoneE164: string;
  isPhoneVerified: true;
  linked: boolean;
  tokens: AuthTokens | null;
  user: UserProfile;
}
