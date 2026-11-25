import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Leave, LeaveDuration, LeaveStatus } from './entities/leave.entity';

import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';

import { Employee } from '../employees/entities/employee.entity';
import { UserRole } from '../auth/enums/user-role.enum';

import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(Leave)
    private readonly leavesRepository: Repository<Leave>,

    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,

    private readonly notificationService: NotificationService,
  ) {}

  // =========================================================
  // CREATE LEAVE
  // =========================================================

  async create(createLeaveDto: CreateLeaveDto, currentUser: any) {
    const { employeeId, leaveType, leaveDuration, startDate, reason } =
      createLeaveDto;

    let endDate = createLeaveDto.endDate;
    let startTime = createLeaveDto.startTime ?? null;

    let endTime = createLeaveDto.endTime ?? null;

    // =========================================================
    // FIND EMPLOYEE
    // =========================================================

    const employee = await this.employeesRepository.findOne({
      where: {
        id: employeeId,
      },
      relations: {
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // =========================================================
    // EMPLOYEE PERMISSION
    // =========================================================

    const role = currentUser?.role;

    if (role !== UserRole.ADMIN && role !== UserRole.HR) {
      const isOwnEmployee =
        Number(employee.user?.id) === Number(currentUser?.id);

      if (!isOwnEmployee) {
        throw new ForbiddenException('You can only create leave for yourself');
      }
    }

    // =========================================================
    // SHORT LEAVE VALIDATION
    // =========================================================

    if (leaveDuration === LeaveDuration.SHORT_LEAVE) {
      if (!startTime) {
        throw new BadRequestException('Start time is required for short leave');
      }

      if (!endTime) {
        throw new BadRequestException('End time is required for short leave');
      }

      // Short leave is only one day
      endDate = startDate;

      if (startTime >= endTime) {
        throw new BadRequestException('Start time must be before end time');
      }

      const startMinutes = this.timeToMinutes(startTime);

      const endMinutes = this.timeToMinutes(endTime);

      const durationMinutes = endMinutes - startMinutes;

      if (durationMinutes > 240) {
        throw new BadRequestException(
          'Short leave cannot be more than 4 hours',
        );
      }

      if (durationMinutes <= 0) {
        throw new BadRequestException(
          'Short leave duration must be greater than 0',
        );
      }
    }

    // =========================================================
    // FULL DAY VALIDATION
    // =========================================================

    if (leaveDuration === LeaveDuration.FULL_DAY) {
      if (!endDate) {
        throw new BadRequestException(
          'End date is required for full-day leave',
        );
      }

      if (new Date(startDate) > new Date(endDate)) {
        throw new BadRequestException('Start date cannot be after end date');
      }

      startTime = null;
      endTime = null;
    }

    // =========================================================
    // CHECK OVERLAPPING LEAVE
    // =========================================================

    const overlappingLeave = await this.leavesRepository
      .createQueryBuilder('leave')
      .where('leave.employeeId = :employeeId', {
        employeeId,
      })
      .andWhere('leave.status != :rejected', {
        rejected: LeaveStatus.REJECTED,
      })
      .andWhere('leave.status != :cancelled', {
        cancelled: LeaveStatus.CANCELLED,
      })
      .andWhere(
        `
          leave.startDate <= :endDate
          AND leave.endDate >= :startDate
          `,
        {
          startDate,
          endDate,
        },
      )
      .getOne();

    if (overlappingLeave) {
      throw new BadRequestException(
        'Employee already has a leave during these dates',
      );
    }

    // =========================================================
    // CREATE LEAVE
    // =========================================================

    const leave = this.leavesRepository.create({
      employeeId,
      employee,
      leaveType,
      leaveDuration,
      startDate,
      endDate: endDate!,
      startTime,
      endTime,
      reason,
      status: LeaveStatus.PENDING,
      rejectionReason: null,
    });

    const savedLeave = await this.leavesRepository.save(leave);

    // =========================================================
    // NOTIFY EMPLOYEE
    // =========================================================

    if (employee.user) {
      const employeeName =
        employee.user.name || `${employee.firstName} ${employee.lastName}`;
      const message = `Hello ${employeeName}, your leave request from ${savedLeave.startDate} to ${savedLeave.endDate} is pending approval.`;

      await this.notificationService.sendEmailAndInAppNotification({
        userId: employee.user.id,
        email: employee.user.email,
        title: 'Leave Request Submitted',
        message,
        type: NotificationType.LEAVE,
        relatedEntityType: 'leave',
        relatedEntityId: String(savedLeave.id),
        url: '/employee/leaves',
        dedupeKey: `leave-submitted:${savedLeave.id}:employee`,
      });
      await this.notificationService.notifyDepartmentApprovers(
        employee.user.id,
        'Leave Request Submitted',
        `submitted a ${savedLeave.leaveType.toLowerCase()} leave request from ${savedLeave.startDate} to ${savedLeave.endDate}.`,
        NotificationType.LEAVE,
        `leave-submitted:${savedLeave.id}`,
      );
    }

    return savedLeave;
  }

  // =========================================================
  // TIME → MINUTES
  // =========================================================

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);

    return hours * 60 + minutes;
  }

  // =========================================================
  // GET ALL LEAVES
  // =========================================================

  async findAll() {
    return this.leavesRepository.find({
      relations: {
        employee: {
          user: true,
        },
      },
      order: {
        id: 'DESC',
      },
    });
  }

  // =========================================================
  // GET LEAVE BY ID
  // =========================================================

  async findOne(id: number) {
    const leave = await this.leavesRepository.findOne({
      where: {
        id,
      },
      relations: {
        employee: {
          user: true,
        },
      },
    });

    if (!leave) {
      throw new NotFoundException(`Leave with ID ${id} not found`);
    }

    return leave;
  }

  // =========================================================
  // GET LEAVES BY EMPLOYEE
  // =========================================================

  async findByEmployee(employeeId: number) {
    const employee = await this.employeesRepository.findOne({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    return this.leavesRepository.find({
      where: {
        employeeId,
      },
      relations: {
        employee: {
          user: true,
        },
      },
      order: {
        startDate: 'DESC',
      },
    });
  }

  // =========================================================
  // UPDATE LEAVE
  // =========================================================

  async update(id: number, updateLeaveDto: UpdateLeaveDto, currentUser: any) {
    const leave = await this.findOne(id);

    const role = currentUser?.role;

    // =========================================================
    // ONLY ADMIN / HR CAN CHANGE STATUS
    // =========================================================

    if (
      updateLeaveDto.status &&
      role !== UserRole.ADMIN &&
      role !== UserRole.HR
    ) {
      throw new ForbiddenException('Only Admin or HR can change leave status');
    }

    // =========================================================
    // EMPLOYEE CAN ONLY UPDATE OWN LEAVE
    // =========================================================

    if (role !== UserRole.ADMIN && role !== UserRole.HR) {
      if (
        Number(currentUser?.employeeId) !== Number(leave.employeeId) &&
        Number(currentUser?.sub) !== Number(leave.employeeId)
      ) {
        throw new ForbiddenException('You can only update your own leave');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending leaves can be updated');
      }
    }

    // =========================================================
    // GET UPDATED VALUES
    // =========================================================

    const leaveDuration = updateLeaveDto.leaveDuration ?? leave.leaveDuration;

    const startDate = updateLeaveDto.startDate ?? leave.startDate;

    let endDate = updateLeaveDto.endDate ?? leave.endDate;

    let startTime = updateLeaveDto.startTime ?? leave.startTime;

    let endTime = updateLeaveDto.endTime ?? leave.endTime;

    // =========================================================
    // SHORT LEAVE
    // =========================================================

    if (leaveDuration === LeaveDuration.SHORT_LEAVE) {
      endDate = startDate;

      if (!startTime) {
        throw new BadRequestException('Start time is required for short leave');
      }

      if (!endTime) {
        throw new BadRequestException('End time is required for short leave');
      }

      if (startTime >= endTime) {
        throw new BadRequestException('Start time must be before end time');
      }

      const startMinutes = this.timeToMinutes(startTime);

      const endMinutes = this.timeToMinutes(endTime);

      const durationMinutes = endMinutes - startMinutes;

      if (durationMinutes > 240) {
        throw new BadRequestException(
          'Short leave cannot be more than 4 hours',
        );
      }

      if (durationMinutes <= 0) {
        throw new BadRequestException(
          'Short leave duration must be greater than 0',
        );
      }
    }

    // =========================================================
    // FULL DAY
    // =========================================================

    if (leaveDuration === LeaveDuration.FULL_DAY) {
      if (!endDate) {
        throw new BadRequestException(
          'End date is required for full-day leave',
        );
      }

      if (new Date(startDate) > new Date(endDate)) {
        throw new BadRequestException('Start date cannot be after end date');
      }

      startTime = null;
      endTime = null;
    }

    // =========================================================
    // CHECK OVERLAP
    // =========================================================

    if (
      updateLeaveDto.startDate ||
      updateLeaveDto.endDate ||
      updateLeaveDto.startTime ||
      updateLeaveDto.endTime ||
      updateLeaveDto.leaveDuration
    ) {
      const overlappingLeave = await this.leavesRepository
        .createQueryBuilder('leave')
        .where('leave.employeeId = :employeeId', {
          employeeId: leave.employeeId,
        })
        .andWhere('leave.id != :id', {
          id,
        })
        .andWhere('leave.status != :rejected', {
          rejected: LeaveStatus.REJECTED,
        })
        .andWhere('leave.status != :cancelled', {
          cancelled: LeaveStatus.CANCELLED,
        })
        .andWhere(
          `
            leave.startDate <= :endDate
            AND leave.endDate >= :startDate
            `,
          {
            startDate,
            endDate,
          },
        )
        .getOne();

      if (overlappingLeave) {
        throw new BadRequestException(
          'Employee already has a leave during these dates',
        );
      }
    }

    // =========================================================
    // STORE ORIGINAL STATUS
    // =========================================================

    const previousStatus = leave.status;

    // =========================================================
    // APPLY UPDATE
    // =========================================================

    leave.leaveType = updateLeaveDto.leaveType ?? leave.leaveType;

    leave.leaveDuration = leaveDuration;

    leave.startDate = startDate;

    leave.endDate = endDate;

    leave.startTime = startTime;

    leave.endTime = endTime;

    leave.reason = updateLeaveDto.reason ?? leave.reason;

    if (updateLeaveDto.status) {
      leave.status = updateLeaveDto.status;
    }

    if (updateLeaveDto.rejectionReason !== undefined) {
      leave.rejectionReason = updateLeaveDto.rejectionReason;
    }

    const savedLeave = await this.leavesRepository.save(leave);

    // =========================================================
    // STATUS NOTIFICATIONS
    // =========================================================

    if (previousStatus !== savedLeave.status) {
      if (savedLeave.status === LeaveStatus.APPROVED) {
        await this.sendLeaveApprovedNotification(savedLeave);
      }

      if (savedLeave.status === LeaveStatus.REJECTED) {
        await this.sendLeaveRejectedNotification(savedLeave);
      }
    }

    return savedLeave;
  }

  // =========================================================
  // DELETE LEAVE
  // =========================================================

  async remove(id: number, currentUser: any) {
    const leave = await this.findOne(id);

    const role = currentUser?.role;

    if (role !== UserRole.ADMIN && role !== UserRole.HR) {
      if (
        Number(currentUser?.employeeId) !== Number(leave.employeeId) &&
        Number(currentUser?.sub) !== Number(leave.employeeId)
      ) {
        throw new ForbiddenException('You can only delete your own leave');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending leaves can be deleted');
      }
    }

    await this.leavesRepository.remove(leave);

    return {
      message: 'Leave deleted successfully',
    };
  }

  // =========================================================
  // APPROVE LEAVE
  // =========================================================

  async approve(id: number) {
    const leave = await this.findOne(id);

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave is already ${leave.status}`);
    }

    leave.status = LeaveStatus.APPROVED;

    leave.rejectionReason = null;

    const savedLeave = await this.leavesRepository.save(leave);

    await this.sendLeaveApprovedNotification(savedLeave);

    return savedLeave;
  }

  // =========================================================
  // REJECT LEAVE
  // =========================================================

  async reject(id: number, rejectionReason: string) {
    const leave = await this.findOne(id);

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Leave is already ${leave.status}`);
    }

    if (!rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    leave.status = LeaveStatus.REJECTED;

    leave.rejectionReason = rejectionReason.trim();

    const savedLeave = await this.leavesRepository.save(leave);

    await this.sendLeaveRejectedNotification(savedLeave);

    return savedLeave;
  }

  // =========================================================
  // LEAVE APPROVED NOTIFICATION
  // =========================================================

  private async sendLeaveApprovedNotification(leave: Leave): Promise<void> {
    const employee = leave.employee;

    if (!employee?.user) {
      return;
    }

    const employeeName =
      employee.user.name || `${employee.firstName} ${employee.lastName}`;

    const message = [
      `Hello ${employeeName},`,
      '',
      'Your leave request has been approved.',
      '',
      `Leave Type: ${leave.leaveType}`,
      `Start Date: ${leave.startDate}`,
      `End Date: ${leave.endDate}`,
      '',
      'You can log in to the HRM system to view the details.',
    ].join('\n');

    await this.notificationService.sendEmailAndInAppNotification({
      userId: employee.user.id,

      email: employee.user.email,

      title: 'Leave Approved',

      message,

      type: NotificationType.LEAVE_APPROVED,
      relatedEntityType: 'leave',
      relatedEntityId: String(leave.id),
      dedupeKey: `leave-approved:${leave.id}`,
    });
  }

  // =========================================================
  // LEAVE REJECTED NOTIFICATION
  // =========================================================

  private async sendLeaveRejectedNotification(leave: Leave): Promise<void> {
    const employee = leave.employee;

    if (!employee?.user) {
      return;
    }

    const employeeName =
      employee.user.name || `${employee.firstName} ${employee.lastName}`;

    const message = [
      `Hello ${employeeName},`,
      '',
      'Your leave request has been rejected.',
      '',
      `Leave Type: ${leave.leaveType}`,
      `Start Date: ${leave.startDate}`,
      `End Date: ${leave.endDate}`,
      '',
      `Reason: ${leave.rejectionReason || 'No reason provided.'}`,
      '',
      'You can log in to the HRM system to view the details.',
    ].join('\n');

    await this.notificationService.sendEmailAndInAppNotification({
      userId: employee.user.id,

      email: employee.user.email,

      title: 'Leave Rejected',

      message,

      type: NotificationType.LEAVE_REJECTED,
      relatedEntityType: 'leave',
      relatedEntityId: String(leave.id),
      dedupeKey: `leave-rejected:${leave.id}`,
    });
  }
}
