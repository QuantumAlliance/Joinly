import { ArrayMinSize, IsArray } from 'class-validator';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

/** Onboarding step 2 of 3 — "Choose Interests" (Select at least 3 interests.) */
export class UpdateInterestsDto {
  @IsArray()
  @ArrayMinSize(3, { message: 'Select at least 3 interests.' })
  @IsObjectId({ each: true })
  categoryIds: string[];
}
