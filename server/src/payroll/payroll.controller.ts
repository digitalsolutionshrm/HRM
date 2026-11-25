import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { PayrollService } from './payroll.service';

import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { UpdatePayrollBonusDto } from './dto/update-payroll-bonus.dto';
import { CreatePayrollIncrementDto } from './dto/create-payroll-increment.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * Create payroll (manual values, or calculated from monthly employee salary when basicSalary is omitted)
   *
   * POST /api/payroll
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  create(@Body() createPayrollDto: CreatePayrollDto) {
    return this.payrollService.create(createPayrollDto);
  }

  /**
   * Generate payroll for all employees of a month
   *
   * POST /api/payroll/process   { "month": 9, "year": 2026 }
   */
  @Post('process')
  @Roles(UserRole.ADMIN, UserRole.HR)
  processAll(@Body() processPayrollDto: ProcessPayrollDto) {
    return this.payrollService.processAll(processPayrollDto);
  }

  /**
   * Get all payroll
   *
   * GET /api/payroll
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  findAll() {
    return this.payrollService.findAll();
  }

  /**
   * Get payroll (payslips) of the logged in user
   *
   * GET /api/payroll/my
   */
  @Get('my')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  findMine(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payrollService.findMine(currentUser.id);
  }

  /**
   * Get payroll by employee
   *
   * GET /api/payroll/employee/3
   */
  @Get('employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findByEmployee(
    @Param('employeeId', ParseIntPipe)
    employeeId: number,
  ) {
    return this.payrollService.findByEmployee(employeeId);
  }

  /**
   * Get payroll by month
   *
   * GET /api/payroll/month/2026/9
   */
  @Get('month/:year/:month')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findByMonth(
    @Param('year', ParseIntPipe)
    year: number,

    @Param('month', ParseIntPipe)
    month: number,
  ) {
    return this.payrollService.findByMonth(year, month);
  }

  /** Add or replace a bonus for one employee and payroll month. */
  @Patch(':id/bonus')
  @Roles(UserRole.ADMIN, UserRole.HR)
  updateBonus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePayrollBonusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.updateBonus(id, dto.bonus, currentUser);
  }

  /** Employees available for increment updates by HR/Admin. */
  @Get('increment-employees')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findIncrementEmployees(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payrollService.findIncrementEmployees(currentUser);
  }

  /** Create an increment and update the employee's current monthly salary. */
  @Post('increments')
  @Roles(UserRole.ADMIN, UserRole.HR)
  createIncrement(
    @Body() dto: CreatePayrollIncrementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.createIncrement(dto, currentUser);
  }

  /** All increment events visible to this user. */
  @Get('increments')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findIncrementHistory(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payrollService.findIncrementHistory(currentUser);
  }

  /** Full increment history for one employee. */
  @Get('increments/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findEmployeeIncrementHistory(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.findEmployeeIncrementHistory(employeeId, currentUser);
  }

  /**
   * Get one payroll
   *
   * GET /api/payroll/1
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.payrollService.findOne(id);
  }

  /**
   * Update payroll (send recalculate: true to rebuild from attendance / leaves)
   *
   * PATCH /api/payroll/1
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body() updatePayrollDto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  /**
   * Change status (PENDING / PROCESSED / PAID)
   *
   * PATCH /api/payroll/1/status   { "status": "PROCESSED" }
   */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.HR)
  updateStatus(
    @Param('id', ParseIntPipe)
    id: number,

    @Body() updatePayrollStatusDto: UpdatePayrollStatusDto,
  ) {
    return this.payrollService.updateStatus(
      id,
      updatePayrollStatusDto.status,
    );
  }

  @Patch(':id/approval')
  @Roles(UserRole.ADMIN, UserRole.HR)
  approvePayslip(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.approvePayslip(id, currentUser);
  }

  /**
   * Process payroll
   *
   * PATCH /api/payroll/1/process
   */
  @Patch(':id/process')
  @Roles(UserRole.ADMIN, UserRole.HR)
  process(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.payrollService.process(id);
  }

  /**
   * Mark payroll as paid
   *
   * PATCH /api/payroll/1/pay
   */
  @Patch(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.HR)
  markAsPaid(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.payrollService.markAsPaid(id);
  }

  /**
   * Delete payroll
   *
   * DELETE /api/payroll/1
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  remove(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.payrollService.remove(id);
  }
}
