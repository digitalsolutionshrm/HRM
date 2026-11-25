import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeesController } from './employees.controller';
import { ProfileMediaController } from './profile-media.controller';
import { EmployeesService } from './employees.service';

import { Employee } from './entities/employee.entity';
import { EmployeePersonalDetails } from './entities/employee-personal-details.entity';
import { EmployeeAddress } from './entities/employee-address.entity';
import { EmployeeDocument } from './entities/employee-document.entity';

import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { EmployeeRole } from '../roles/entities/employee-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeePersonalDetails,
      EmployeeAddress,
      EmployeeDocument,
      User,
      Department,
      EmployeeRole,
      AuthSession,
    ]),
    NotificationsModule,
  ],

  controllers: [
    EmployeesController,
    ProfileMediaController,
  ],

  providers: [
    EmployeesService,
  ],

  exports: [
    EmployeesService,
  ],
})
export class EmployeesModule {}
