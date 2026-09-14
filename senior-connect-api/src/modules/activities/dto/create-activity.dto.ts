import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMilitaryTime,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Difficulty } from '../../../common/enums';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

/** Figma "Create Activities" — all labels preserved */
export class CreateActivityDto {
  /** "What are you doing?" — Enter your Activity name */
  @IsString()
  @MaxLength(150)
  activityName: string;

  /** "Category" — pick an existing category… */
  @ValidateIf((o) => !o.categoryName)
  @IsObjectId()
  categoryId?: string;

  /** …or "Add Category name" inline */
  @ValidateIf((o) => !o.categoryId)
  @IsString()
  @MaxLength(100)
  categoryName?: string;

  /** "Descriptions" — Enter your activity descriptions */
  @IsString()
  descriptions: string;

  /** "Maximum number of participants" */
  @IsInt()
  @Min(1)
  @Max(1000)
  maximumNumberOfParticipants: number;

  /** "Activity Photo" — URL returned by POST /uploads */
  @IsOptional()
  @IsString()
  activityPhoto?: string;

  /** "Activity Date" */
  @IsDateString()
  activityDate: string;

  /** "Activity Time" (HH:mm) */
  @IsMilitaryTime()
  activityTime: string;

  /** "Activity Duration" (e.g. "1 Hour") */
  @IsString()
  activityDuration: string;

  /** "Activity Equipment (if any)" */
  @IsOptional()
  @IsString()
  activityEquipment?: string;

  /** "Activity Location" */
  @IsString()
  activityLocation: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** "Participant Age Range" */
  @IsInt()
  @Min(0)
  minAge: number;

  @IsInt()
  @Max(120)
  maxAge: number;

  /** "Price (if applicable)" */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  /** "Difficulty" */
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  /** Save as Draft instead of submitting for approval */
  @IsOptional()
  @IsBoolean()
  saveAsDraft?: boolean;
}
