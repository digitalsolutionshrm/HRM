import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';

const MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER];

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) { }


  @Post('face-check-in')
  faceCheckIn(
    @Body() body: { employeeId: number; descriptor: number[] },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    // Employees can only submit a face descriptor for their own linked profile.
    if (!MANAGEMENT_ROLES.includes(currentUser.role)) {
      return this.attendanceService.checkInWithFaceForUser(currentUser.id, body?.descriptor);
    }
    return this.attendanceService.checkInWithFace(Number(body?.employeeId), body?.descriptor);
  }

  // QR scanners send the opaque token encoded in an employee QR code.
  @Post('qr-check-in')
  qrCheckIn(
    @Body('qrToken') qrToken: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.checkInWithQr(qrToken, currentUser.id);
  }

  @Post('employee/:id')
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  createForEmployee(
    @Param('id', ParseIntPipe) employeeId: number,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.create(employeeId, createAttendanceDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  findAll() {
    return this.attendanceService.findAll();
  }

  @Get('employee/:id')
  async findByEmployee(
    @Param('id', ParseIntPipe) employeeId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.ensureCanAccessEmployee(employeeId, currentUser);
    return this.attendanceService.findByEmployee(employeeId);
  }

  @Get('date/:date')
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  findByDate(@Param('date') date: string) {
    return this.attendanceService.findByDate(date);
  }

  @Get('overtime-requests')
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  findPendingOvertimeRequests(
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.findPendingOvertimeRequests(currentUser);
  }

  @Post(':id/overtime-request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.EMPLOYEE)
  requestOvertime(
    @Param('id', ParseIntPipe) attendanceId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.requestOvertime(
      attendanceId,
      currentUser.id,
    );
  }

  @Post('overtime-requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  approveOvertime(
    @Param('id', ParseIntPipe) attendanceId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.approveOvertime(
      attendanceId,
      currentUser,
    );
  }

  @Post('overtime-requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(...MANAGEMENT_ROLES)
  rejectOvertime(
    @Param('id', ParseIntPipe) attendanceId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.rejectOvertime(
      attendanceId,
      currentUser,
    );
  }

  @Get('monthly-report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  monthlyReport(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.attendanceService.getMonthlyReport(
      Number(month),
      Number(year),
      shiftId ? Number(shiftId) : undefined,
    );
  }

  @Post('check-in/:employeeId')
  checkIn() {
    throw new ForbiddenException('Direct check-in is disabled. Use verified face scan or QR attendance.');
  }

  @Post('check-out/:employeeId')
  checkOut(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.ensureCanAccessEmployee(employeeId, currentUser);
    return this.attendanceService.checkOut(employeeId);
  }

  @Post('break-start/:employeeId')
  startBreak(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.ensureCanAccessEmployee(employeeId, currentUser);
    return this.attendanceService.startBreak(employeeId);
  }

  @Post('break-end/:employeeId')
  endBreak(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    this.ensureCanAccessEmployee(employeeId, currentUser);
    return this.attendanceService.endBreak(employeeId);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const attendance = await this.attendanceService.findOne(id);
    this.ensureCanAccessEmployee(attendance.employeeId, currentUser);
    return attendance;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(id, updateAttendanceDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attendanceService.remove(id);
  }

  private ensureCanAccessEmployee(
    employeeId: number,
    currentUser: AuthenticatedUser,
  ) {
    const canManageAll = MANAGEMENT_ROLES.includes(currentUser.role);
    if (!canManageAll && employeeId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own attendance');
    }
  }
}
