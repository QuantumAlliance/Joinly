import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * "Add Category" (admin) and "Add Category name" (the mobile Create Activity
 * wizard). Same body; the status the row is created with is decided by which
 * endpoint was called, not by anything the caller sends.
 */
export class CreateCategoryDto {
  @IsString()
  @MinLength(2, { message: 'categoryName must be at least 2 characters' })
  @MaxLength(100)
  categoryName: string;
}
