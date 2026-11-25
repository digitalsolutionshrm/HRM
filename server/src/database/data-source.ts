import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getPostgresConnectionOptions } from './postgres-options';
import { User } from '../users/entities/user.entity';

import { Employee } from '../employees/entities/employee.entity';
import { EmployeePersonalDetails } from '../employees/entities/employee-personal-details.entity';
import { EmployeeAddress } from '../employees/entities/employee-address.entity';
import { EmployeeDocument } from '../employees/entities/employee-document.entity';

import { Department } from '../departments/entities/department.entity';
import { EmployeeRole } from '../roles/entities/employee-role.entity';

import { WorkSettings } from '../settings/entities/work-settings.entity';
import { Holiday } from '../settings/entities/holiday.entity';

export const AppDataSource = new DataSource({
  ...getPostgresConnectionOptions(),

   entities: [
    User,

    Employee,
    EmployeePersonalDetails,
    EmployeeAddress,
    EmployeeDocument,

    Department,
    EmployeeRole,

    WorkSettings,
    Holiday,
  ],

  synchronize: false,
});