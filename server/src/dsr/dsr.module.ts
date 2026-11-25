import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DsrController } from './dsr.controller';
import { DsrService } from './dsr.service';

import { Dsr } from './entities/dsr.entity';
import { Employee } from '../employees/entities/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dsr,
      Employee,
    ]),
      NotificationsModule,
  ],
  controllers: [
    DsrController,
  ],
  providers: [
    DsrService,
  ],
  exports: [
    DsrService,
  ],
})
export class DsrModule {}