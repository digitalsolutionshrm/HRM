import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

import { EmailVerificationOtp } from './entities/email-verification-otp.entity';
import { EmailVerificationController } from './email-verification.controller';
import { EmailVerificationService } from './email-verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      EmailVerificationOtp,
    ]),
    NotificationsModule,
  ],

  controllers: [
    EmailVerificationController,
  ],

  providers: [
    EmailVerificationService,
  ],

  exports: [
    EmailVerificationService,
  ],
})
export class EmailVerificationModule {}
