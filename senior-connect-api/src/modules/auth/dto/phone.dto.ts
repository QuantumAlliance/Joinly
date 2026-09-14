import {
  IsOptional,
  IsString,
  Matches,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { resolvePhone } from '../../../common/utils/phone.util';

@ValidatorConstraint({ name: 'validPhone', async: false })
class ValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return resolvePhone(args.object as Record<string, string | undefined>) !== null;
  }

  defaultMessage(): string {
    return 'Provide a valid international phone number (phoneCountryCode + phoneNumber, or phoneE164)';
  }
}

/** Requires a phone that normalises to E.164, in either accepted shape. */
const IsResolvablePhone = () =>
  function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'validPhone',
      target: object.constructor,
      propertyName,
      validator: new ValidPhoneConstraint(),
    });
  };

/** `POST /auth/phone/request-otp` — send a code to a number. */
export class RequestPhoneOtpDto {
  // The constraint reads the whole object; it hangs off the first field only
  // because a decorator needs a property.
  @IsResolvablePhone()
  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  phoneE164?: string;
}

/** `POST /auth/phone/verify` — redeem that code. */
export class VerifyPhoneOtpDto extends RequestPhoneOtpDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otpCode must be a 6 digit code' })
  otpCode: string;
}
