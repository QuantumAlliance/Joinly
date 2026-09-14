import { IsInt, IsOptional, Max, MaxLength, Min, MinLength, IsString } from 'class-validator';

/** Figma Discover — search box autocomplete. */
export class ActivitySuggestionsDto {
  /**
   * The partial term typed so far. Two characters minimum: a single letter
   * matches most of the collection and the list would be noise.
   */
  @IsString()
  @MinLength(2, { message: 'q must be at least 2 characters' })
  @MaxLength(80)
  q: string;

  /** Rows to return. The service clamps too, so the cap holds either way. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
