import { IsEnum, IsOptional } from 'class-validator';
import { OtpType } from '../../../common/enums';
import { HasExactlyOneIdentifier, IdentifierDto } from './identifier.dto';

/** "Didn't get the code?" — resend to whichever identifier is in play. */
export class ResendOtpDto extends IdentifierDto {
  // Class-wide constraint; `type` is simply the property it attaches to.
  @HasExactlyOneIdentifier()
  @IsOptional()
  @IsEnum(OtpType)
  type?: OtpType;
}
