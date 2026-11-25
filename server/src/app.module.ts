import { Inject, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { DepartmentsModule } from './departments/departments.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeavesModule } from './leaves/leaves.module';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { DsrModule } from './dsr/dsr.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PayrollModule } from './payroll/payroll.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { EmailVerificationModule } from './email-verification/email-verification.module';
import { SettingsModule } from './settings/settings.module';
import { resolve } from 'node:path';
import { getPostgresConnectionOptions } from './database/postgres-options';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NotificationImprovements20261022000000 } from './database/migrations/20261022000000-NotificationImprovements';
import { PayrollAttendanceLeaveFields20261027000000 } from './database/migrations/20261027000000-PayrollAttendanceLeaveFields';
import { PayrollIncrementHistory20261027000100 } from './database/migrations/20261027000100-PayrollIncrementHistory';
import { AnnouncementAuthorRole20261028000000 } from './database/migrations/20261028000000-AnnouncementAuthorRole';
import { DepartmentDirectoryFields20261028000000 } from './database/migrations/20261028000000-DepartmentDirectoryFields';
import { PayrollPayslipApproval20261028000100 } from './database/migrations/20261028000100-PayrollPayslipApproval';
import { AttendanceSettingsAndHusbandName20261103000000 } from './database/migrations/20261103000000-AttendanceSettingsAndHusbandName';
import { ShiftManagement20261103000100 } from './database/migrations/20261103000100-ShiftManagement';
import { ShiftsModule } from './shifts/shifts.module';
import { EmployeeRolesModule } from './roles/employee-roles.module';
import { EmployeeRoles20261116000000 } from './database/migrations/20261116000000-EmployeeRoles';
import { AttendanceOvertimeApproval20261118000000 } from './database/migrations/20261118000000-AttendanceOvertimeApproval';
import { EmployeeCoverImage20261118000100 } from './database/migrations/20261118000100-EmployeeCoverImage';
import { ProfileImageDatabaseStorage20261118000200 } from './database/migrations/20261118000200-ProfileImageDatabaseStorage';
import { AttendanceLateCategories20261118000300 } from './database/migrations/20261118000300-AttendanceLateCategories';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal : true,
      envFilePath: resolve(process.cwd(), '.env'), 
      // envFilePath: resolve(__dirname, '..', '.env'),
    }),

    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 5 * 1000,
          limit: 5,
        },
      ],
    }),

  TypeOrmModule.forRootAsync({
    imports : [ConfigModule],

    useFactory: () => ({
      ...getPostgresConnectionOptions(process.env),
      autoLoadEntities : true,
      synchronize:
        process.env.DB_SYNCHRONIZE === 'true' ||
        process.env.NODE_ENV !== 'production',
      // Keep every environment (including production) in sync with the schema
      // changes required by new features. Migrations are idempotent.
      migrations: [
        NotificationImprovements20261022000000,
        PayrollAttendanceLeaveFields20261027000000,
        PayrollIncrementHistory20261027000100,
        AnnouncementAuthorRole20261028000000,
        DepartmentDirectoryFields20261028000000,
        PayrollPayslipApproval20261028000100,
        AttendanceSettingsAndHusbandName20261103000000,
        ShiftManagement20261103000100,
        EmployeeRoles20261116000000,
        AttendanceOvertimeApproval20261118000000,
        EmployeeCoverImage20261118000100,
        ProfileImageDatabaseStorage20261118000200,
        AttendanceLateCategories20261118000300,
      ],
      migrationsRun: true,

          }),
    }),

  AuthModule,

  UsersModule,

  EmployeesModule,

  DepartmentsModule,

  AttendanceModule,

  LeavesModule,

  DsrModule,

  NotificationsModule,

  PayrollModule,

  EmailVerificationModule,

  SettingsModule,
  ShiftsModule,
  EmployeeRolesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
