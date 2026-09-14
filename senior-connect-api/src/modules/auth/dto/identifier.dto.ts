import {
  IsEmail,
  IsOptional,
  IsString,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { resolvePhone } from '../../../common/utils/phone.util';

/**
 * The fields any "who are you" request may carry.
 *
 * Phase 2 made phone a login identifier rather than a profile field, so every
 * entry point takes either credential. The phone half accepts both the Figma
 * split (`phoneCountryCode` + `phoneNumber`) and a pre-joined `phoneE164`,
 * because the mobile client sends the split and anything server-to-server
 * sends the full number.
 */
export class IdentifierDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Dial code from the phone field's country selector, e.g. "+41". */
  @IsOptional()
  @IsString()
  phoneCountryCode?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  /** The number already in E.164 form, e.g. "+41791234567". */
  @IsOptional()
  @IsString()
  phoneE164?: string;
}

type IdentifierShape = {
  email?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  phoneE164?: string;
};

/** True when the object carries a phone that normalises to valid E.164. */
const hasPhone = (value: IdentifierShape): boolean => resolvePhone(value) !== null;

@ValidatorConstraint({ name: 'exactlyOneIdentifier', async: false })
class ExactlyOneIdentifierConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as IdentifierShape;
    return Boolean(dto.email) !== hasPhone(dto);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as IdentifierShape;
    if (dto.email && (dto.phoneNumber || dto.phoneE164)) {
      return 'Provide either email or a phone number, not both';
    }
    if (dto.phoneNumber || dto.phoneCountryCode || dto.phoneE164) {
      return 'phoneCountryCode and phoneNumber must form a valid international number';
    }
    return 'Provide either email or a phone number';
  }
}

/**
 * Exactly one identifier, and if it is a phone it must normalise.
 *
 * "Exactly one" rather than "at least one" on purpose: two identifiers in a
 * sign-in request is ambiguous about which account is meant, and silently
 * preferring one is how you get a login that ignores half its own input.
 */
export const HasExactlyOneIdentifier = () =>
  function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'exactlyOneIdentifier',
      target: object.constructor,
      propertyName,
      validator: new ExactlyOneIdentifierConstraint(),
    });
  };

@ValidatorConstraint({ name: 'atLeastOneIdentifier', async: false })
class AtLeastOneIdentifierConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as IdentifierShape;
    return Boolean(dto.email) || hasPhone(dto);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as IdentifierShape;
    return dto.phoneNumber || dto.phoneCountryCode || dto.phoneE164
      ? 'phoneCountryCode and phoneNumber must form a valid international number'
      : 'Provide an email address or a phone number';
  }
}

/** For registration, where supplying both identifiers up front is legitimate. */
export const HasAtLeastOneIdentifier = () =>
  function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'atLeastOneIdentifier',
      target: object.constructor,
      propertyName,
      validator: new AtLeastOneIdentifierConstraint(),
    });
  };
