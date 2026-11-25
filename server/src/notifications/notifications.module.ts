import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Notification } from './entities/notification.entity';
import { Employee } from '../employees/entities/employee.entity';
import { User } from '../users/entities/user.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { NotificationController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import { NotificationGateway } from './notifications.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    TypeOrmModule.forFeature([Notification, Employee, User, AuthSession]),
  ],

  controllers: [NotificationController],

  providers: [NotificationService, NotificationGateway],

  exports: [NotificationService],
})
export class NotificationsModule {}
