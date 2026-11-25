import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

import { Payroll } from './entities/payroll.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Leave } from '../leaves/entities/leave.entity';
import { PayrollIncrementHistory } from './entities/payroll-increment-history.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payroll, Employee, Attendance, Leave, PayrollIncrementHistory]),
    NotificationsModule,
    SettingsModule,
  ],

  controllers: [PayrollController],

  providers: [PayrollService],

  exports: [PayrollService],
})
export class PayrollModule {}
