import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { NotificationAudience } from '../../../common/enums';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

type ComposeShape = {
  audience?: NotificationAudience;
  audienceCategoryIds?: string[];
};

@ValidatorConstraint({ name: 'audienceMatchesTargets', async: false })
class AudienceMatchesTargetsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ComposeShape;
    const targeted = (dto.audienceCategoryIds ?? []).length > 0;
    return dto.audience === NotificationAudience.Interests ? targeted : !targeted;
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as ComposeShape;
    return dto.audience === NotificationAudience.Interests
      ? 'audience "Interests" requires at least one audienceCategoryId'
      : 'audienceCategoryIds is only valid with audience "Interests"';
  }
}

/**
 * The two halves have to agree.
 *
 * Ignoring stray ids on an `Everyone` broadcast would look like targeting that
 * silently did nothing, and an `Interests` broadcast with no categories would
 * resolve to no one — a send that reports success and reaches nobody. Both are
 * refused rather than guessed at.
 */
const AudienceMatchesTargets = () =>
  function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'audienceMatchesTargets',
      target: object.constructor,
      propertyName,
      validator: new AudienceMatchesTargetsConstraint(),
    });
  };

/** Figma "Compose Notification" — Notification Title, Message Content, audience */
export class ComposeNotificationDto {
  @IsString()
  @MaxLength(200)
  notificationTitle: string;

  @IsString()
  messageContent: string;

  /** Defaults to `Everyone`, which is what the Figma compose card sends. */
  @AudienceMatchesTargets()
  @IsOptional()
  @IsEnum(NotificationAudience)
  audience?: NotificationAudience;

  /** Required with `Interests`, forbidden otherwise. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObjectId({ each: true })
  audienceCategoryIds?: string[];
}
