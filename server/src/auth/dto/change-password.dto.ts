import { IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/;

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @Matches(PASSWORD_POLICY, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  newPassword!: string;

  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}
