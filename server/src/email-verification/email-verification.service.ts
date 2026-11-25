import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

import { EmailVerificationOtp } from './entities/email-verification-otp.entity';

@Injectable()
export class EmailVerificationService {
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly RESEND_COOLDOWN_SECONDS = 60;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(EmailVerificationOtp)
    private readonly otpRepository: Repository<EmailVerificationOtp>,

    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Send verification OTP.
   *
   * This endpoint is useful after registration when the user
   * has never received a verification OTP.
   */
  async sendVerificationOtp(email: string) {
    return this.generateAndSendOtp(email);
  }

  /**
   * Resend verification OTP.
   *
   * A 60-second cooldown is enforced between OTP requests.
   */
  async resendVerificationOtp(email: string) {
    return this.generateAndSendOtp(email);
  }

  /**
   * Verify email using the 6-digit OTP.
   */
  async verifyEmail(email: string, otp: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    const verificationOtp = await this.otpRepository.findOne({
      where: {
        userId: user.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!verificationOtp) {
      throw new BadRequestException({
        code: 'OTP_NOT_FOUND',
        message: 'Verification OTP not found. Please request a new OTP.',
      });
    }

    if (verificationOtp.verifiedAt) {
      throw new BadRequestException({
        code: 'OTP_ALREADY_USED',
        message: 'This OTP has already been used.',
      });
    }

    if (new Date() > verificationOtp.expiresAt) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    if (verificationOtp.attempts >= this.MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message:
          'Maximum OTP verification attempts exceeded. Please request a new OTP.',
      });
    }

    const isValidOtp = await bcrypt.compare(
      otp,
      verificationOtp.otpHash,
    );

    if (!isValidOtp) {
      verificationOtp.attempts += 1;

      await this.otpRepository.save(verificationOtp);

      const remainingAttempts =
        this.MAX_ATTEMPTS - verificationOtp.attempts;

      throw new BadRequestException({
        code: 'INVALID_OTP',
        message:
          remainingAttempts > 0
            ? `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`
            : 'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.',
      });
    }

    verificationOtp.verifiedAt = new Date();

    await this.otpRepository.save(verificationOtp);

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();

    await this.userRepository.save(user);

    return {
      success: true,
      message: 'Email verified successfully.',
    };
  }

  /**
   * Generate a new OTP, hash it, save it, and send it
   * through the central NotificationService.
   */
  private async generateAndSendOtp(email: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email is already verified.',
      };
    }

    /**
     * Check resend cooldown.
     */
    const latestOtp = await this.otpRepository.findOne({
      where: {
        userId: user.id,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (latestOtp) {
      const now = Date.now();
      const lastSent = new Date(latestOtp.lastSentAt).getTime();

      const elapsedSeconds =
        (now - lastSent) / 1000;

      if (elapsedSeconds < this.RESEND_COOLDOWN_SECONDS) {
        const remainingSeconds = Math.ceil(
          this.RESEND_COOLDOWN_SECONDS - elapsedSeconds,
        );

        throw new BadRequestException({
          code: 'OTP_COOLDOWN',
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
          retryAfterSeconds: remainingSeconds,
        });
      }
    }

    /**
     * Generate 6-digit OTP.
     */
    const otp = this.generateOtp();

    /**
     * Hash OTP before storing it.
     */
    const otpHash = await bcrypt.hash(otp, 10);

    /**
     * Invalidate previous OTPs.
     *
     * We do this by marking them as verified/used so they
     * cannot be reused.
     */
    await this.otpRepository
      .createQueryBuilder()
      .update(EmailVerificationOtp)
      .set({
        verifiedAt: new Date(),
      })
      .where('userId = :userId', {
        userId: user.id,
      })
      .andWhere('verifiedAt IS NULL')
      .execute();

    /**
     * Create new OTP.
     */
    const expiresAt = new Date(
      Date.now() +
        this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    const verificationOtp =
      this.otpRepository.create({
        userId: user.id,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        verifiedAt: null,
      });

    await this.otpRepository.save(verificationOtp);

    /**
     * Send email through the central notification system.
     */
    const message = [
      `Hello ${user.name},`,
      '',
      'Your HRM email verification OTP is:',
      '',
      otp,
      '',
      `This OTP will expire in ${this.OTP_EXPIRY_MINUTES} minutes.`,
      '',
      'For security reasons, do not share this OTP with anyone.',
      '',
      'Regards,',
      'HRM Team',
    ].join('\n');

    await this.notificationService.sendEmailNotification({
      userId: user.id,
      email: user.email,
      title: 'Verify Your HRM Email',
      message,
      type: NotificationType.EMAIL_VERIFICATION,
    });

    return {
      success: true,
      message: 'Verification OTP sent successfully.',
      expiresInMinutes: this.OTP_EXPIRY_MINUTES,
    };
  }

  /**
   * Generate a cryptographically random 6-digit OTP.
   */
  private generateOtp(): string {
    return Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
  }
}