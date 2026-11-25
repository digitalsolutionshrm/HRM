import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean

  @IsOptional()
  @IsBoolean()
  emailVerifiedAt?: Date | null

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}