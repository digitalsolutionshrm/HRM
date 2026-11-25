import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';

import { Leave } from './entities/leave.entity';
import { Employee } from '../employees/entities/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leave,
      Employee,
    ]),
      NotificationsModule,
  ],

  controllers: [
    LeavesController,
  ],

  providers: [
    LeavesService,
  ],

  exports: [
    LeavesService,
  ],
})
export class LeavesModule {}