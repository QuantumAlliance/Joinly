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
} from 'class-validator';
import { Difficulty } from '../../../common/enums';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  activityName?: string;

  @IsOptional()
  @IsObjectId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  descriptions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maximumNumberOfParticipants?: number;

  @IsOptional()
  @IsString()
  activityPhoto?: string;

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsMilitaryTime()
  activityTime?: string;

  @IsOptional()
  @IsString()
  activityDuration?: string;

  @IsOptional()
  @IsString()
  activityEquipment?: string;

  @IsOptional()
  @IsString()
  activityLocation?: string;

  // Bounded like create-activity: these are written to the GeoJSON mirror, and
  // the 2dsphere index rejects an out-of-range point on save.
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

  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Max(120)
  maxAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  /** Submit a Draft for approval */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
