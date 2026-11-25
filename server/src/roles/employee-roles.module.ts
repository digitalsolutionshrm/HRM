import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Employee } from '../employees/entities/employee.entity';
import { EmployeeRolesController } from './employee-roles.controller';
import { EmployeeRolesService } from './employee-roles.service';
import { EmployeeRole } from './entities/employee-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeRole, Employee])],
  controllers: [EmployeeRolesController],
  providers: [EmployeeRolesService],
  exports: [EmployeeRolesService],
})
export class EmployeeRolesModule {}
