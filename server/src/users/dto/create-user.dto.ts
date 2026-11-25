import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
// import { UserRole } from '../../auth/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/,
    {
      message:
        'Password must contain uppercase, lowercase, number and special character',
    },
  )
  password!: string;

  // @IsOptional()
  // emailVerified?: boolean;

  // @IsOptional()
  // emailVerifiedAt?: Date | null;

  // @IsOptional()
  // @IsEnum(UserRole)
  // role?: UserRole;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}

