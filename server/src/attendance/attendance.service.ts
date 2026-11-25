import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { createDecipheriv } from 'node:crypto';

import {
  Attendance,
  AttendanceStatus,
  OvertimeApprovalStatus,
} from './entities/attendance.entity';

import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

import { User } from '../users/entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';
import {
  Leave,
  LeaveDuration,
  LeaveStatus,
} from '../leaves/entities/leave.entity';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { SettingsService } from '../settings/settings.service';
import { ShiftAssignment } from '../shifts/entities/shift-assignment.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { resolveArrivalStatus } from './attendance-rules';

const STANDARD_SHIFT_HOURS = 8;
const OVERTIME_CUTOFF_HOURS = 9;
const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

@Injectable()
export class AttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceService.name);
  private autoCheckOutTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,

    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,

    @InjectRepository(ShiftAssignment)
    private readonly shiftAssignmentsRepository: Repository<ShiftAssignment>,

    @InjectRepository(Shift)
    private readonly shiftsRepository: Repository<Shift>,

    private readonly notificationService: NotificationService,
    private readonly settingsService: SettingsService,
  ) {}

  onModuleInit(): void {
    void this.runAutoCheckOutSweep();
    this.autoCheckOutTimer = setInterval(
      () => void this.runAutoCheckOutSweep(),
      60_000,
    );
    this.autoCheckOutTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.autoCheckOutTimer) {
      clearInterval(this.autoCheckOutTimer);
    }
  }

  private async runAutoCheckOutSweep(): Promise<void> {
    try {
      const openAttendances = await this.attendanceRepository
        .createQueryBuilder('attendance')
        .where('attendance.checkIn IS NOT NULL')
        .andWhere('attendance.checkOut IS NULL')
        .andWhere('attendance.overtimeApprovalStatus != :approved', {
          approved: OvertimeApprovalStatus.APPROVED,
        })
        .getMany();

      for (const attendance of openAttendances) {
        await this.autoCheckOutIfOverdue(attendance.id);
      }
    } catch (error) {
      this.logger.error(
        'Could not automatically check out overdue attendance records.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async autoCheckOutIfOverdue(
    attendanceId: number,
  ): Promise<Attendance | null> {
    const savedAttendance = await this.attendanceRepository.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(Attendance);
        const attendance = await repository.findOne({
          where: { id: attendanceId },
          lock: { mode: 'pessimistic_write' },
        });

        if (
          !attendance?.checkIn ||
          attendance.checkOut ||
          attendance.overtimeApprovalStatus ===
            OvertimeApprovalStatus.APPROVED ||
          this.netWorkedMilliseconds(attendance, new Date()) <
            OVERTIME_CUTOFF_HOURS * HOUR_IN_MILLISECONDS
        ) {
          return null;
        }

        const now = new Date();
        const checkOutAt =
          attendance.breakStart && !attendance.breakEnd
            ? now
            : new Date(
                attendance.checkIn.getTime() +
                  OVERTIME_CUTOFF_HOURS * HOUR_IN_MILLISECONDS +
                  Number(attendance.breakMinutes || 0) * 60_000,
              );

        await this.applyCheckOut(attendance, checkOutAt, true);
        return repository.save(attendance);
      },
    );

    if (savedAttendance) {
      await this.notifyAttendance(
        savedAttendance.employeeId,
        'Automatic Attendance Check-out',
        'automatically checked out after reaching the 9-hour work limit without overtime approval',
      );
    }

    return savedAttendance;
  }

  private netWorkedMilliseconds(attendance: Attendance, now: Date): number {
    if (!attendance.checkIn) return 0;

    let breakMilliseconds = Number(attendance.breakMinutes || 0) * 60_000;
    if (attendance.breakStart && !attendance.breakEnd) {
      breakMilliseconds += Math.max(
        0,
        now.getTime() - attendance.breakStart.getTime(),
      );
    }

    return Math.max(
      0,
      now.getTime() - attendance.checkIn.getTime() - breakMilliseconds,
    );
  }

  private setCheckOutFields(
    attendance: Attendance,
    checkOutAt: Date,
    endActiveBreak: boolean,
  ): void {
    if (attendance.breakStart && !attendance.breakEnd) {
      if (!endActiveBreak) {
        throw new BadRequestException(
          'End your break before checking out',
        );
      }
      attendance.breakEnd = checkOutAt;
      attendance.breakMinutes =
        Number(attendance.breakMinutes || 0) +
        Math.max(
          0,
          Math.floor(
            (checkOutAt.getTime() - attendance.breakStart.getTime()) / 60_000,
          ),
        );
    }

    attendance.checkOut = checkOutAt;
    attendance.workingHours = this.calculateWorkingHours(
      attendance.checkIn?.toISOString(),
      checkOutAt.toISOString(),
      attendance.breakMinutes,
    );
  }

  private biometricKey(): Buffer {
    const value = process.env.BIOMETRIC_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value))
      throw new BadRequestException(
        'Server biometric encryption is not configured.',
      );
    return Buffer.from(value, 'hex');
  }

  private decryptFaceDescriptor(value: string): number[] {
    try {
      const [ivHex, tagHex, dataHex] = value.split(':');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.biometricKey(),
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const raw = Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
      const descriptor = JSON.parse(raw);
      if (
        !Array.isArray(descriptor) ||
        descriptor.length !== 128 ||
        descriptor.some((n) => !Number.isFinite(n))
      )
        throw new Error('invalid');
      return descriptor;
    } catch {
      throw new BadRequestException(
        'Stored face template is invalid or cannot be decrypted.',
      );
    }
  }

  async checkInWithFaceForUser(userId: number, liveDescriptor: number[]) {
    const profile = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile)
      throw new NotFoundException('Your employee profile was not found.');
    return this.checkInWithFace(profile.id, liveDescriptor);
  }

  async checkInWithFace(employeeId: number, liveDescriptor: number[]) {
    if (!Number.isInteger(employeeId) || employeeId < 1)
      throw new BadRequestException('A valid employee ID is required.');
    if (
      !Array.isArray(liveDescriptor) ||
      liveDescriptor.length !== 128 ||
      liveDescriptor.some((n) => !Number.isFinite(n) || n < -10 || n > 10)
    ) {
      throw new BadRequestException(
        'A valid live face descriptor is required.',
      );
    }
    const profile = await this.employeesRepository
      .createQueryBuilder('employee')
      .addSelect('employee.faceDescriptorEncrypted')
      .leftJoinAndSelect('employee.user', 'user')
      .where('employee.id = :employeeId', { employeeId })
      .andWhere('employee.status = :active', { active: true })
      .getOne();
    if (!profile?.user?.id)
      throw new NotFoundException('Active employee not found.');
    if (!profile.faceDescriptorEncrypted || !profile.faceConsentAt)
      throw new BadRequestException(
        'Face enrollment is not complete for this employee.',
      );
    const enrolled = this.decryptFaceDescriptor(
      profile.faceDescriptorEncrypted,
    );
    const distance = Math.sqrt(
      enrolled.reduce(
        (sum, value, index) => sum + (value - liveDescriptor[index]) ** 2,
        0,
      ),
    );
    // Conservative default; calibrate with real-world validation before production use.
    if (distance > 0.48)
      throw new BadRequestException(
        'Face did not match. Use QR or manual attendance instead.',
      );
    const attendance = await this.checkIn(profile.user.id);
    return {
      message: 'Attendance marked after face match.',
      method: 'FACE',
      matchDistance: Number(distance.toFixed(4)),
      employee: {
        id: profile.id,
        employeeCode: profile.employeeCode,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
      attendance,
    };
  }

  // QR attendance: the QR contains an unguessable random token, not an employee ID.
  async checkInWithQr(qrToken: string, currentUserId: number) {
    if (!qrToken || typeof qrToken !== 'string') {
      throw new BadRequestException('A valid attendance QR token is required');
    }

    const employeeProfile = await this.employeesRepository
      .createQueryBuilder('employee')
      .addSelect('employee.attendanceQrToken')
      .leftJoinAndSelect('employee.user', 'user')
      .where('employee.attendanceQrToken = :qrToken', { qrToken })
      .andWhere('employee.status = :active', { active: true })
      .getOne();

    if (!employeeProfile?.user?.id) {
      throw new NotFoundException('QR code is invalid or employee is inactive');
    }

    if (employeeProfile.user.id !== currentUserId) {
      throw new ForbiddenException(
        'This QR belongs to another employee. Log in with the account assigned to this QR code.',
      );
    }

    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        employeeId: employeeProfile.user.id,
        date: this.getToday(),
      },
    });

    if (existingAttendance?.checkIn) {
      return {
        message: 'Employee has already checked in today',
        alreadyCheckedIn: true,
        method: 'QR',
        employee: {
          id: employeeProfile.id,
          employeeCode: employeeProfile.employeeCode,
          firstName: employeeProfile.firstName,
          lastName: employeeProfile.lastName,
        },
        attendance: existingAttendance,
      };
    }

    const attendance = await this.checkIn(employeeProfile.user.id);
    return {
      message: 'Attendance marked successfully using QR code',
      method: 'QR',
      employee: {
        id: employeeProfile.id,
        employeeCode: employeeProfile.employeeCode,
        firstName: employeeProfile.firstName,
        lastName: employeeProfile.lastName,
      },
      attendance,
    };
  }

  // CREATE ATTENDANCE

  async create(employeeId: number, createAttendanceDto: CreateAttendanceDto) {
    const { date, status, checkIn, checkOut, remarks } = createAttendanceDto;

    const employee = await this.usersRepository.findOne({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        employeeId,
        date,
      },
    });

    if (existingAttendance) {
      throw new BadRequestException(
        'Attendance already exists for this employee on this date',
      );
    }

    const workingHours = this.calculateWorkingHours(checkIn, checkOut);
    const profile = await this.employeesRepository.findOne({ where: { user: { id: employeeId } } });
    const assignment = profile ? await this.assignmentForDate(profile.id, date) : null;

    const attendance = this.attendanceRepository.create({
      employeeId,
      employee,
      date,
      status: status || AttendanceStatus.PRESENT,
      checkIn: checkIn ? new Date(checkIn) : null,
      checkOut: checkOut ? new Date(checkOut) : null,
      workingHours,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      remarks: remarks || null,
      shift: assignment?.shift ?? null,
      shiftId: assignment?.shiftId ?? null,
      shiftNameSnapshot: assignment?.shift.name ?? null,
      shiftStartSnapshot: assignment?.shift.startTime ?? null,
      shiftEndSnapshot: assignment?.shift.endTime ?? null,
      shiftWorkHoursSnapshot: assignment?.shift.standardWorkHours ?? null,
    });

    const saved = await this.attendanceRepository.save(attendance);
    await this.notifyAttendanceException(saved);
    return saved;
  }

  // GET ALL ATTENDANCE

  async findAll() {
    return this.attendanceRepository.find({
      relations: {
        employee: true,
      },
      order: {
        date: 'DESC',
        id: 'DESC',
      },
    });
  }

  // GET ATTENDANCE BY ID

  async findOne(id: number) {
    const attendance = await this.attendanceRepository.findOne({
      where: {
        id,
      },
      relations: {
        employee: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    return attendance;
  }

  // GET ATTENDANCE BY EMPLOYEE

  async findByEmployee(employeeId: number) {
    const employee = await this.usersRepository.findOne({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.attendanceRepository.find({
      where: {
        employeeId,
      },
      relations: {
        employee: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  // GET ATTENDANCE BY DATE

  async findByDate(date: string) {
    return this.attendanceRepository.find({
      where: {
        date,
      },
      relations: {
        employee: true,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // UPDATE ATTENDANCE

  async update(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    const attendance = await this.attendanceRepository.findOne({
      where: {
        id,
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    Object.assign(attendance, updateAttendanceDto);

    if (updateAttendanceDto.checkIn !== undefined) {
      attendance.checkIn = updateAttendanceDto.checkIn
        ? new Date(updateAttendanceDto.checkIn)
        : null;
    }

    if (updateAttendanceDto.checkOut !== undefined) {
      attendance.checkOut = updateAttendanceDto.checkOut
        ? new Date(updateAttendanceDto.checkOut)
        : null;
    }

    attendance.workingHours = this.calculateWorkingHours(
      attendance.checkIn ? attendance.checkIn.toISOString() : undefined,

      attendance.checkOut ? attendance.checkOut.toISOString() : undefined,
      attendance.breakMinutes,
    );

    const saved = await this.attendanceRepository.save(attendance);
    await this.notifyAttendanceException(saved);
    return saved;
  }

  private async notifyAttendanceException(
    attendance: Attendance,
  ): Promise<void> {
    if (
      ![
        AttendanceStatus.ABSENT,
        AttendanceStatus.LATE,
        AttendanceStatus.SHORT_LEAVE,
        AttendanceStatus.HALF_DAY,
      ].includes(attendance.status)
    )
      return;
    const title = `Attendance marked ${attendance.status.toLowerCase().replace('_', ' ')}`;
    const key = `attendance:${attendance.id}:${attendance.status}`;
    await Promise.all([
      this.notificationService.createInAppNotification({
        userId: attendance.employeeId,
        title,
        message: `Your attendance for ${attendance.date} was marked ${attendance.status.toLowerCase().replace('_', ' ')}.`,
        type: NotificationType.ATTENDANCE,
        relatedEntityType: 'attendance',
        relatedEntityId: String(attendance.id),
        url: '/employee/attendance',
        dedupeKey: `${key}:employee`,
      }),
      this.notificationService.notifyDepartmentApprovers(
        attendance.employeeId,
        'Attendance exception',
        `had attendance marked ${attendance.status.toLowerCase().replace('_', ' ')} on ${attendance.date}.`,
        NotificationType.ATTENDANCE,
        key,
      ),
    ]);
  }

  // DELETE ATTENDANCE

  async remove(id: number) {
    const attendance = await this.attendanceRepository.findOne({
      where: {
        id,
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    await this.attendanceRepository.remove(attendance);

    return {
      message: 'Attendance deleted successfully',
    };
  }

  // CHECK IN

  async checkIn(employeeId: number) {
    const today = this.getToday();

    const employee = await this.usersRepository.findOne({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.autoCheckOutOverdueForEmployee(employeeId);

    if (await this.findOpenAttendance(employeeId)) {
      throw new BadRequestException('You have an open attendance session. Check out before starting another shift.');
    }

    let attendance = await this.attendanceRepository.findOne({
      where: {
        employeeId,
        date: today,
      },
    });

    if (attendance?.checkIn) {
      throw new BadRequestException('Employee has already checked in today');
    }

    const checkInAt = new Date();
    const profile = await this.employeesRepository.findOne({ where: { user: { id: employeeId } } });
    const assignment = profile ? await this.assignmentForDate(profile.id, today) : null;
    if (!assignment && await this.shiftsRepository.count()) {
      throw new ForbiddenException('No shift is assigned to you for today. Please contact HR before checking in.');
    }
    const status = await this.resolveCheckInStatus(checkInAt, assignment?.shift);

    if (!attendance) {
      attendance = this.attendanceRepository.create({
        employeeId,
        employee,
        date: today,
        status,
        checkIn: checkInAt,
        checkOut: null,
        workingHours: null,
        breakStart: null,
        breakEnd: null,
        breakMinutes: 0,
        overtimeApprovalStatus: OvertimeApprovalStatus.NONE,
        overtimeRequestedAt: null,
        overtimeReviewedAt: null,
        overtimeReviewedByUserId: null,
        remarks: null,
        shift: assignment?.shift ?? null,
        shiftId: assignment?.shiftId ?? null,
        shiftNameSnapshot: assignment?.shift.name ?? null,
        shiftStartSnapshot: assignment?.shift.startTime ?? null,
        shiftEndSnapshot: assignment?.shift.endTime ?? null,
        shiftWorkHoursSnapshot: assignment?.shift.standardWorkHours ?? null,
      });
    } else {
      attendance.checkIn = checkInAt;
      attendance.checkOut = null;
      attendance.breakStart = null;
      attendance.breakEnd = null;
      attendance.breakMinutes = 0;
      attendance.workingHours = null;
      attendance.overtimeApprovalStatus = OvertimeApprovalStatus.NONE;
      attendance.overtimeRequestedAt = null;
      attendance.overtimeReviewedAt = null;
      attendance.overtimeReviewedByUserId = null;
      attendance.shift = assignment?.shift ?? null;
      attendance.shiftId = assignment?.shiftId ?? null;
      attendance.shiftNameSnapshot = assignment?.shift.name ?? null;
      attendance.shiftStartSnapshot = assignment?.shift.startTime ?? null;
      attendance.shiftEndSnapshot = assignment?.shift.endTime ?? null;
      attendance.shiftWorkHoursSnapshot = assignment?.shift.standardWorkHours ?? null;
      // Keep an explicit ON_LEAVE/HALF_DAY state if one was already recorded.
      if (
        attendance.status !== AttendanceStatus.ON_LEAVE &&
        attendance.status !== AttendanceStatus.HALF_DAY
      ) {
        attendance.status = status;
      }
    }

    const savedAttendance = await this.attendanceRepository.save(attendance);
    await this.notifyAttendance(
      employeeId,
      'Attendance Check-in',
      'checked in',
    );
    return savedAttendance;
  }

  // CHECK OUT

  async checkOut(employeeId: number) {
    await this.autoCheckOutOverdueForEmployee(employeeId);
    const today = this.getToday();

    const attendance = await this.findOpenAttendance(employeeId) ?? await this.attendanceRepository.findOne({ where: { employeeId, date: today } });

    if (!attendance) {
      throw new BadRequestException('Employee has not checked in today');
    }

    if (!attendance.checkIn) {
      throw new BadRequestException('Employee has not checked in today');
    }

    if (attendance.checkOut) {
      throw new BadRequestException('Employee has already checked out today');
    }

    await this.applyCheckOut(attendance, new Date(), false);

    const savedAttendance = await this.attendanceRepository.save(attendance);
    await this.notifyAttendance(
      employeeId,
      'Attendance Check-out',
      'checked out',
    );
    return savedAttendance;
  }

  private async applyCheckOut(
    attendance: Attendance,
    checkOutAt: Date,
    endActiveBreak: boolean,
  ): Promise<void> {
    this.setCheckOutFields(attendance, checkOutAt, endActiveBreak);

    const assignedShift =
      attendance.shiftId && attendance.shiftWorkHoursSnapshot == null
        ? await this.shiftsRepository.findOne({
            where: { id: attendance.shiftId },
          })
        : null;
    const settings =
      attendance.shiftWorkHoursSnapshot != null || assignedShift
        ? null
        : await this.settingsService.getWorkSettings();
    const standardHours =
      Number(
        attendance.shiftWorkHoursSnapshot ??
          assignedShift?.standardWorkHours ??
          settings!.standardWorkHours,
      ) || STANDARD_SHIFT_HOURS;

    if (
      (attendance.status === AttendanceStatus.PRESENT ||
        attendance.status === AttendanceStatus.LATE ||
        attendance.status === AttendanceStatus.SHORT_LEAVE) &&
      attendance.workingHours !== null &&
      attendance.workingHours < standardHours / 2
    ) {
      attendance.status = AttendanceStatus.HALF_DAY;
    }
  }

  private async autoCheckOutOverdueForEmployee(
    employeeId: number,
  ): Promise<void> {
    await this.autoCheckOutIfOverdueForEmployee(employeeId);
  }

  private async autoCheckOutIfOverdueForEmployee(
    employeeId: number,
  ): Promise<void> {
    const attendance = await this.attendanceRepository
      .createQueryBuilder('attendance')
      .where('attendance.employeeId = :employeeId', { employeeId })
      .andWhere('attendance.checkIn IS NOT NULL')
      .andWhere('attendance.checkOut IS NULL')
      .getOne();

    if (attendance) {
      await this.autoCheckOutIfOverdue(attendance.id);
    }
  }

  async requestOvertime(
    attendanceId: number,
    employeeUserId: number,
  ): Promise<Attendance> {
    await this.autoCheckOutIfOverdue(attendanceId);

    return this.attendanceRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Attendance);
      const attendance = await repository.findOne({
        where: { id: attendanceId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!attendance) throw new NotFoundException('Attendance not found');
      if (attendance.employeeId !== employeeUserId) {
        throw new ForbiddenException(
          'You can request overtime only for your own attendance.',
        );
      }
      if (!attendance.checkIn || attendance.checkOut) {
        throw new BadRequestException('There is no active attendance to extend.');
      }
      if (
        attendance.overtimeApprovalStatus !== OvertimeApprovalStatus.NONE
      ) {
        throw new BadRequestException(
          'An overtime request has already been submitted for this attendance.',
        );
      }

      const now = new Date();
      const workedMilliseconds = this.netWorkedMilliseconds(attendance, now);
      if (workedMilliseconds < STANDARD_SHIFT_HOURS * HOUR_IN_MILLISECONDS) {
        throw new BadRequestException(
          'You can request overtime after completing 8 net working hours.',
        );
      }
      if (workedMilliseconds >= OVERTIME_CUTOFF_HOURS * HOUR_IN_MILLISECONDS) {
        throw new BadRequestException(
          'The 9-hour work limit has been reached. Attendance was checked out automatically.',
        );
      }

      attendance.overtimeApprovalStatus = OvertimeApprovalStatus.PENDING;
      attendance.overtimeRequestedAt = now;
      return repository.save(attendance);
    });
  }

  async findPendingOvertimeRequests(
    reviewer: { id: number; role: UserRole },
  ): Promise<Attendance[]> {
    if (
      reviewer.role !== UserRole.ADMIN &&
      reviewer.role !== UserRole.HR &&
      reviewer.role !== UserRole.MANAGER
    ) {
      throw new ForbiddenException(
        'Only Admin, HR, or Managers can review overtime requests.',
      );
    }

    let teamUserIds: number[] | null = null;
    if (reviewer.role === UserRole.MANAGER) {
      const team = await this.employeesRepository
        .createQueryBuilder('employee')
        .innerJoinAndSelect('employee.user', 'employeeUser')
        .innerJoin('employee.manager', 'manager')
        .innerJoin('manager.user', 'managerUser')
        .where('managerUser.id = :managerUserId', {
          managerUserId: reviewer.id,
        })
        .getMany();
      teamUserIds = team
        .map((employee) => employee.user?.id)
        .filter((id): id is number => typeof id === 'number');

      if (teamUserIds.length === 0) return [];
    }

    const query = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.employee', 'employeeUser')
      .where('attendance.overtimeApprovalStatus = :status', {
        status: OvertimeApprovalStatus.PENDING,
      })
      .andWhere('attendance.checkOut IS NULL')
      .orderBy('attendance.overtimeRequestedAt', 'ASC');

    if (teamUserIds) {
      query.andWhere('attendance.employeeId IN (:...employeeUserIds)', {
        employeeUserIds: teamUserIds,
      });
    }

    return query.getMany();
  }

  async approveOvertime(
    attendanceId: number,
    reviewer: { id: number; role: UserRole },
  ): Promise<Attendance> {
    await this.autoCheckOutIfOverdue(attendanceId);

    const result = await this.attendanceRepository.manager.transaction(
      async (manager) => {
        const repository = manager.getRepository(Attendance);
        const attendance = await repository.findOne({
          where: { id: attendanceId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!attendance) throw new NotFoundException('Attendance not found');
        await this.ensureCanReviewOvertime(attendance, reviewer);
        if (attendance.checkOut) {
          throw new BadRequestException(
            'This attendance has already been checked out.',
          );
        }
        if (
          attendance.overtimeApprovalStatus !== OvertimeApprovalStatus.PENDING
        ) {
          throw new BadRequestException('This overtime request is not pending.');
        }

        const now = new Date();
        if (
          this.netWorkedMilliseconds(attendance, now) >=
          OVERTIME_CUTOFF_HOURS * HOUR_IN_MILLISECONDS
        ) {
          const checkOutAt =
            attendance.breakStart && !attendance.breakEnd
              ? now
              : new Date(
                  attendance.checkIn!.getTime() +
                    OVERTIME_CUTOFF_HOURS * HOUR_IN_MILLISECONDS +
                    Number(attendance.breakMinutes || 0) * 60_000,
                );
          await this.applyCheckOut(attendance, checkOutAt, true);
          const saved = await repository.save(attendance);
          return { attendance: saved, expired: true };
        }

        attendance.overtimeApprovalStatus = OvertimeApprovalStatus.APPROVED;
        attendance.overtimeReviewedAt = now;
        attendance.overtimeReviewedByUserId = reviewer.id;
        const saved = await repository.save(attendance);
        return { attendance: saved, expired: false };
      },
    );

    if (result.expired) {
      await this.notifyAttendance(
        result.attendance.employeeId,
        'Automatic Attendance Check-out',
        'automatically checked out after reaching the 9-hour work limit without overtime approval',
      );
      throw new BadRequestException(
        'The 9-hour work limit was reached before approval. Attendance was checked out automatically.',
      );
    }

    return result.attendance;
  }

  async rejectOvertime(
    attendanceId: number,
    reviewer: { id: number; role: UserRole },
  ): Promise<Attendance> {
    await this.autoCheckOutIfOverdue(attendanceId);

    const savedAttendance =
      await this.attendanceRepository.manager.transaction(async (manager) => {
        const repository = manager.getRepository(Attendance);
        const attendance = await repository.findOne({
          where: { id: attendanceId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!attendance) throw new NotFoundException('Attendance not found');
        await this.ensureCanReviewOvertime(attendance, reviewer);
        if (attendance.checkOut) {
          throw new BadRequestException(
            'This attendance has already been checked out.',
          );
        }
        if (
          attendance.overtimeApprovalStatus !== OvertimeApprovalStatus.PENDING
        ) {
          throw new BadRequestException('This overtime request is not pending.');
        }

        const now = new Date();
        attendance.overtimeApprovalStatus = OvertimeApprovalStatus.REJECTED;
        attendance.overtimeReviewedAt = now;
        attendance.overtimeReviewedByUserId = reviewer.id;
        return repository.save(attendance);
      });

    await this.notifyAttendance(
      savedAttendance.employeeId,
      'Overtime Request Declined',
      'overtime request was declined; attendance will automatically end at the 9-hour limit',
    );
    return savedAttendance;
  }

  private async ensureCanReviewOvertime(
    attendance: Attendance,
    reviewer: { id: number; role: UserRole },
  ): Promise<void> {
    if (
      reviewer.role === UserRole.ADMIN ||
      reviewer.role === UserRole.HR
    ) {
      return;
    }

    if (reviewer.role !== UserRole.MANAGER) {
      throw new ForbiddenException(
        'Only Admin, HR, or Managers can review overtime requests.',
      );
    }

    const teamMember = await this.employeesRepository
      .createQueryBuilder('employee')
      .innerJoin('employee.user', 'employeeUser')
      .innerJoin('employee.manager', 'manager')
      .innerJoin('manager.user', 'managerUser')
      .where('employeeUser.id = :employeeUserId', {
        employeeUserId: attendance.employeeId,
      })
      .andWhere('managerUser.id = :managerUserId', {
        managerUserId: reviewer.id,
      })
      .getOne();

    if (!teamMember) {
      throw new ForbiddenException(
        'Managers can review overtime requests only for their own team.',
      );
    }
  }

  private async notifyAttendance(
    employeeUserId: number,
    title: string,
    action: string,
  ): Promise<void> {
    await this.notificationService.notifyDepartmentApprovers(
      employeeUserId,
      title,
      `${action}.`,
      NotificationType.ATTENDANCE,
    );
  }

  // START A BREAK

  async startBreak(employeeId: number) {
    const attendance = await this.findTodayAttendance(employeeId);

    if (!attendance?.checkIn) {
      throw new BadRequestException('Check in before starting a break');
    }
    if (attendance.checkOut) {
      throw new BadRequestException('You have already checked out today');
    }
    if (attendance.breakStart && !attendance.breakEnd) {
      throw new BadRequestException('Your break is already in progress');
    }
    if (attendance.breakEnd) {
      throw new BadRequestException('Only one break can be recorded per day');
    }

    attendance.breakStart = new Date();
    return this.attendanceRepository.save(attendance);
  }

  // END A BREAK

  async endBreak(employeeId: number) {
    const attendance = await this.findTodayAttendance(employeeId);

    if (!attendance?.breakStart) {
      throw new BadRequestException('Start a break before ending it');
    }
    if (attendance.breakEnd) {
      throw new BadRequestException('Your break has already ended');
    }
    if (attendance.checkOut) {
      throw new BadRequestException('You have already checked out today');
    }

    attendance.breakEnd = new Date();
    attendance.breakMinutes = Math.max(
      0,
      Math.floor(
        (attendance.breakEnd.getTime() - attendance.breakStart.getTime()) /
          60_000,
      ),
    );

    return this.attendanceRepository.save(attendance);
  }

  private async findTodayAttendance(employeeId: number) {
    await this.autoCheckOutOverdueForEmployee(employeeId);
    const open = await this.findOpenAttendance(employeeId);
    if (open) return open;
    return this.attendanceRepository.findOne({
      where: { employeeId, date: this.getToday() },
    });
  }

  private async findOpenAttendance(employeeId: number) {
    return this.attendanceRepository.createQueryBuilder('attendance')
      .where('attendance.employeeId = :employeeId', { employeeId })
      .andWhere('attendance.checkIn IS NOT NULL')
      .andWhere('attendance.checkOut IS NULL')
      .orderBy('attendance.date', 'DESC').addOrderBy('attendance.id', 'DESC').getOne();
  }

  private async assignmentForDate(employeeProfileId: number, date: string) {
    const rows = await this.shiftAssignmentsRepository.find({ where: { employeeId: employeeProfileId }, relations: { shift: true }, order: { effectiveFrom: 'DESC' } });
    const weekday = new Date(`${date.slice(0, 10)}T12:00:00`).getDay();
    return rows.find(row => row.effectiveFrom <= date.slice(0, 10) && (!row.effectiveTo || row.effectiveTo >= date.slice(0, 10)) && row.weekdays.includes(weekday) && row.shift?.active) ?? null;
  }
  // CALCULATE WORKING HOURS

  private calculateWorkingHours(
    checkIn?: string,
    checkOut?: string,
    breakMinutes = 0,
  ): number | null {
    if (!checkIn || !checkOut) {
      return null;
    }

    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();

    if (end <= start) {
      return 0;
    }

    const netMilliseconds = end - start - breakMinutes * 60_000;
    const hours = Math.max(0, netMilliseconds) / (1000 * 60 * 60);

    return Number(hours.toFixed(2));
  }

  private async resolveCheckInStatus(checkInAt: Date, shift?: { startTime: string; graceMinutes: number } | null): Promise<AttendanceStatus> {
    const settings = shift ? null : await this.settingsService.getWorkSettings();
    return resolveArrivalStatus(
      checkInAt,
      String(shift?.startTime ?? settings!.officeStartTime),
      Number(shift?.graceMinutes ?? settings!.graceMinutes) || 0,
    );
  }

  /**
   * Month-wise attendance matrix for HR/Admin Excel export.
   * Combines attendance records, approved leaves, weekly offs and holidays.
   */
  async getMonthlyReport(month: number, year: number, shiftId?: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('A valid year is required');
    }
    if (shiftId !== undefined && (!Number.isInteger(shiftId) || shiftId < 1 || !(await this.shiftsRepository.findOne({ where: { id: shiftId } })))) {
      throw new BadRequestException('A valid shiftId is required');
    }

    const pad = (value: number) => String(value).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${pad(month)}-01`;
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    // Dates after today have no attendance yet; do not count them as absent.
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const settings = await this.settingsService.getWorkSettings();
    const weeklyOffDays = (settings.weeklyOffDays ?? [0]).map(Number);
    const holidayMap = await this.settingsService.getHolidayMap(startDate, endDate);

    const [attendanceRecords, leaves, employees, shiftAssignments] = await Promise.all([
      this.attendanceRepository.find({ where: { date: Between(startDate, endDate), ...(shiftId ? { shiftId } : {}) } }),
      this.leaveRepository.find({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate),
        },
      }),
      this.employeesRepository.find({
        where: { status: true },
        relations: { user: true, department: true },
        order: { firstName: 'ASC', lastName: 'ASC' },
      }),
      shiftId ? this.shiftAssignmentsRepository.find({ where: { shiftId }, relations: { shift: true } }) : Promise.resolve([]),
    ]);

    const scheduled = (profileId: number, date: string) => shiftAssignments.some(a => a.employeeId === profileId && a.effectiveFrom <= date && (!a.effectiveTo || a.effectiveTo >= date) && a.weekdays.includes(new Date(`${date}T12:00:00`).getDay()));

    // employeeId -> (date -> record); a single employee has one row per day.
    const attendanceByUser = new Map<number, Map<string, Attendance>>();
    for (const record of attendanceRecords) {
      const bucket =
        attendanceByUser.get(record.employeeId) ?? new Map<string, Attendance>();
      bucket.set(record.date.slice(0, 10), record);
      attendanceByUser.set(record.employeeId, bucket);
    }

    const leavesByEmployee = new Map<number, Leave[]>();
    for (const leave of leaves) {
      const list = leavesByEmployee.get(leave.employeeId) ?? [];
      list.push(leave);
      leavesByEmployee.set(leave.employeeId, list);
    }

    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const dayNumber = index + 1;
      const date = `${year}-${pad(month)}-${pad(dayNumber)}`;
      const weekday = new Date(year, month - 1, dayNumber).getDay();
      return {
        date,
        day: dayNumber,
        weekday,
        future: date > todayKey,
        weekOff: weeklyOffDays.includes(weekday),
        holiday: holidayMap.get(date) ?? null,
      };
    });

    const coversDate = (leave: Leave, date: string): boolean => {
      if (leave.leaveDuration === LeaveDuration.FULL_DAY) {
        return leave.startDate <= date && leave.endDate >= date;
      }
      if (leave.leaveDuration === LeaveDuration.HALF_DAY) {
        return leave.startDate === date;
      }
      return false;
    };

    const employeesReport = employees
      .filter((employee) => employee.user?.id)
      .filter((employee) => !shiftId || shiftAssignments.some(a => a.employeeId === employee.id && a.effectiveFrom <= endDate && (!a.effectiveTo || a.effectiveTo >= startDate)))
      .map((employee) => {
        const userId = employee.user!.id;
        const recordsByDate = attendanceByUser.get(userId);
        const employeeLeaves = leavesByEmployee.get(employee.id) ?? [];
        const cells: Record<string, string> = {};
        const summary = {
          present: 0,
          late: 0,
          shortLeave: 0,
          halfDay: 0,
          absent: 0,
          leave: 0,
          holiday: 0,
          weekOff: 0,
          workingDays: 0,
        };

        for (const day of days) {
          let code: string;
          if (day.future) {
            code = '';
          } else if (shiftId && !scheduled(employee.id, day.date)) {
            code = '';
          } else if (day.holiday) {
            code = 'H';
            summary.holiday += 1;
          } else if (!shiftId && day.weekOff) {
            code = 'W';
            summary.weekOff += 1;
          } else {
            summary.workingDays += 1;
            const onLeave = employeeLeaves.some((leave) => coversDate(leave, day.date));
            const daily = recordsByDate?.get(day.date);
            if (daily?.status === AttendanceStatus.PRESENT) {
              code = 'P';
              summary.present += 1;
            } else if (daily?.status === AttendanceStatus.LATE) {
              code = 'L';
              summary.late += 1;
              summary.present += 1;
            } else if (daily?.status === AttendanceStatus.SHORT_LEAVE) {
              code = 'SL';
              summary.shortLeave += 1;
              summary.present += 1;
            } else if (daily?.status === AttendanceStatus.HALF_DAY) {
              code = 'HD';
              summary.halfDay += 1;
            } else if (daily?.status === AttendanceStatus.ON_LEAVE || onLeave) {
              code = 'LV';
              summary.leave += 1;
            } else {
              code = 'A';
              summary.absent += 1;
            }
          }
          cells[day.date] = code;
        }

        return {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: `${employee.firstName} ${employee.lastName}`.trim(),
          department: employee.department?.name ?? null,
          cells,
          summary,
        };
      });

    return {
      month,
      year,
      shiftId: shiftId ?? null,
      shift: shiftId ? await this.shiftsRepository.findOne({ where: { id: shiftId } }) : null,
      daysInMonth,
      weeklyOffDays,
      days,
      holidays: Array.from(holidayMap.entries()).map(([date, name]) => ({ date, name })),
      employees: employeesReport,
    };
  }

  // TODAY

  private getToday(): string {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const getPart = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  }
}
