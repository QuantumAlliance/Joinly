import { IsString, MinLength } from 'class-validator';

/** Figma "Change Password" — Current Password, Create New Password, Confirm Password */
export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters.' })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
