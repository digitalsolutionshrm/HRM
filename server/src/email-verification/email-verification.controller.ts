import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { EmailVerificationService } from './email-verification.service';

import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationOtpDto } from './dto/resend-verification-otp.dto';

@Controller('auth')
export class EmailVerificationController {
  constructor(
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /**
   * Send verification OTP
   *
   * POST /api/auth/send-verification-otp
   */
  @Post('send-verification-otp')
  async sendVerificationOtp(
    @Body() dto: ResendVerificationOtpDto,
  ) {
    return this.emailVerificationService.sendVerificationOtp(
      dto.email,
    );
  }

  /**
   * Resend verification OTP
   *
   * POST /api/auth/resend-verification-otp
   */
  @Post('resend-verification-otp')
  async resendVerificationOtp(
    @Body() dto: ResendVerificationOtpDto,
  ) {
    return this.emailVerificationService.resendVerificationOtp(
      dto.email,
    );
  }

  /**
   * Verify email using OTP
   *
   * POST /api/auth/verify-email
   */
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
  ) {
    return this.emailVerificationService.verifyEmail(
      dto.email,
      dto.otp,
    );
  }
}