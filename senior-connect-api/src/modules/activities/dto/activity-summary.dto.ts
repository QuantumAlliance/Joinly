import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/**
 * Figma Home hero banner — "12 activities happening near you today".
 *
 * Coordinates are optional: without them the user's saved location is used,
 * and with neither the count is national rather than local (`radiusKm: null`).
 *
 * Every bound here exists because the values reach `$centerSphere` unaltered.
 * An out-of-range coordinate or a negative radius makes Mongo throw, which
 * surfaces as a 500 carrying a raw driver message.
 */
export class ActivitySummaryDto {
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

  /** Radius in km. Defaults to `DEFAULT_NEARBY_RADIUS_KM`. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDistance?: number;
}
