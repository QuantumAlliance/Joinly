import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IsObjectId } from '../../../common/validators/is-object-id.validator';

/** The three Home tab feeds, on top of the default chronological order. */
export type DiscoverSort = 'nearby' | 'popular' | 'recent';

/** Figma "Discover" + "Apply Filter" sheet */
export class DiscoverActivitiesDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  /** "Search activities near you…" */
  @IsOptional()
  @IsString()
  search?: string;

  /** "Choose activity categories" */
  @IsOptional()
  @IsObjectId()
  categoryId?: string;

  /** "Activity date & time" */
  @IsOptional()
  @IsDateString()
  activityDate?: string;

  /** "Participate age range" */
  @IsOptional()
  @IsInt()
  minAge?: number;

  @IsOptional()
  @IsInt()
  maxAge?: number;

  /**
   * "Activity distances" (km) — requires latitude/longitude.
   *
   * Bounded because the value is handed straight to `$centerSphere` /
   * `$maxDistance`: a negative radius makes Mongo throw, which surfaced as a
   * 500 carrying a raw driver message.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDistance?: number;

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

  /** "Map view | List view" */
  @IsOptional()
  @IsIn(['map', 'list'])
  view?: 'map' | 'list';

  /**
   * Home tab feeds.
   *
   * `nearby` needs `latitude`/`longitude` and is a 400 without them — there is
   * no sensible origin to measure from otherwise. Omitted, the list keeps its
   * chronological order (soonest first), which is what the Discover screen
   * shows.
   */
  @IsOptional()
  @IsIn(['nearby', 'popular', 'recent'])
  sort?: DiscoverSort;
}
