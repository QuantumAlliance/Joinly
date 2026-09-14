import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ActivityStatus } from '../../../common/enums';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

/** Admin activities list — tabs Pending | Approved | Rejected */
export class AdminListActivitiesDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @IsOptional()
  @IsObjectId()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  activityDate?: string;
}
