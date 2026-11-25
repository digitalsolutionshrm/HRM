import {
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

export class ResendVerificationOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
