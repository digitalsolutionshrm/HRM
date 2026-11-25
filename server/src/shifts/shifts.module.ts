import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { Shift } from './entities/shift.entity';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({ imports: [TypeOrmModule.forFeature([Shift, ShiftAssignment, Employee])], controllers: [ShiftsController], providers: [ShiftsService], exports: [ShiftsService, TypeOrmModule] })
export class ShiftsModule {}
