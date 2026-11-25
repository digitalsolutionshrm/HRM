import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

import { Attendance } from './entities/attendance.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Leave } from '../leaves/entities/leave.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { Shift } from '../shifts/entities/shift.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      User,
      Employee,
      Leave,
      ShiftAssignment,
      Shift,
    ]),
    NotificationsModule,
    SettingsModule,
    ShiftsModule,
  ],

  controllers: [
    AttendanceController,
  ],

  providers: [
    AttendanceService,
  ],

  exports: [
    AttendanceService,
  ],
})
export class AttendanceModule {}
