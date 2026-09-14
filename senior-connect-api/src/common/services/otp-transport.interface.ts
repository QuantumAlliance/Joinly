import { OtpChannel } from '../enums';

/**
 * One way of getting a code in front of a user.
 *
 * `AuthService` never names a transport: it asks `OtpDeliveryService` for a
 * channel and gets whichever provider is registered for it. Adding a third
 * provider is a class implementing this interface plus one line in the
 * delivery service's registry.
 */
export interface OtpTransport {
  /** The channel this transport serves. Its key in the registry. */
  readonly channel: OtpChannel;

  /**
   * Deliver `otpCode` to `destination` (an email address or an E.164 number).
   * `purpose` is the human-readable reason, shown to the user.
   *
   * Throws when a configured provider rejects the send, so the caller can fail
   * the request rather than leave the user waiting for a code that is not
   * coming. Providers that are *not* configured must fall back to logging the
   * code for local development instead of throwing.
   */
  send(destination: string, otpCode: string, purpose: string): Promise<void>;
}
