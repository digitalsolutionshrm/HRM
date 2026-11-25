import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Dsr, DsrStatus } from './entities/dsr.entity';

import { CreateDsrDto } from './dto/create-dsr.dto';
import { UpdateDsrDto } from './dto/update-dsr.dto';

import { Employee } from '../employees/entities/employee.entity';

import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { UserRole } from '../auth/enums/user-role.enum';

@Injectable()
export class DsrService {
  constructor(
    @InjectRepository(Dsr)
    private readonly dsrRepository: Repository<Dsr>,

    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,

    private readonly notificationService: NotificationService,
  ) {}

  // =========================================================
  // CREATE DSR
  // =========================================================

  async create(userId: number, createDsrDto: CreateDsrDto) {
    const employee = await this.employeeRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: {
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }

    const date = this.normalizeDate(createDsrDto.date);
    if (date !== this.getTodayDate()) {
      throw new BadRequestException('Employees can create DSRs only for today');
    }

    const status = createDsrDto.status || DsrStatus.DRAFT;

    if (status !== DsrStatus.DRAFT && status !== DsrStatus.SUBMITTED) {
      throw new BadRequestException(
        'A new DSR can only be a draft or submitted report',
      );
    }

    const savedDsr = await this.dsrRepository.manager.transaction(
      async (manager) => {
        const lockedEmployee = await manager.getRepository(Employee).findOne({
          where: { id: employee.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedEmployee) {
          throw new NotFoundException(
            'Employee profile not found for this user',
          );
        }

        await this.ensureDailyHoursLimit(
          manager,
          employee.id,
          date,
          createDsrDto.hoursWorked,
        );

        const dsrRepository = manager.getRepository(Dsr);
        const dsr = dsrRepository.create({
          employee: lockedEmployee,
          date,
          title: createDsrDto.title,
          description: createDsrDto.description,
          tasksCompleted: createDsrDto.tasksCompleted,
          tasksStatus: createDsrDto.tasksStatus,
          hoursWorked: createDsrDto.hoursWorked,
          status,
        });

        return dsrRepository.save(dsr);
      },
    );

    // -------------------------------------------------------
    // Notify when DSR is submitted
    // -------------------------------------------------------

    if (status === DsrStatus.SUBMITTED) {
      await this.sendDsrSubmittedNotification(savedDsr, employee);
    }

    return savedDsr;
  }

  // =========================================================
  // GET ALL DSRs
  // =========================================================

  async findAll() {
    return this.dsrRepository.find({
      relations: {
        employee: true,
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  // =========================================================
  // GET SINGLE DSR
  // =========================================================

  async findOne(id: number) {
    const dsr = await this.dsrRepository.findOne({
      where: {
        id,
      },
      relations: {
        employee: true,
      },
    });

    if (!dsr) {
      throw new NotFoundException('DSR not found');
    }

    return dsr;
  }

  // =========================================================
  // GET DSRs BY EMPLOYEE
  // =========================================================

  async findByEmployee(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.dsrRepository.find({
      where: {
        employee: {
          id: employeeId,
        },
      },
      relations: {
        employee: true,
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  // =========================================================
  // GET DSRs BY LOGGED-IN USER
  // =========================================================

  async findByUser(userId: number) {
    const employee = await this.employeeRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found for this user');
    }

    return this.dsrRepository.find({
      where: {
        employee: {
          id: employee.id,
        },
      },
      relations: {
        employee: true,
      },
      order: {
        date: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  // =========================================================
  // UPDATE DSR
  // =========================================================

  async update(
    id: number,
    updateDsrDto: UpdateDsrDto,
    actingUser: { id: number; role: UserRole },
  ) {
    const existing = await this.dsrRepository.findOne({
      where: {
        id,
      },
      relations: { employee: true },
    });

    if (!existing) {
      throw new NotFoundException('DSR not found');
    }

    const updateResult = await this.dsrRepository.manager.transaction(
      async (manager) => {
        const lockedEmployee = await manager.getRepository(Employee).findOne({
          where: { id: existing.employee.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedEmployee) {
          throw new NotFoundException('Employee not found');
        }

        const dsrRepository = manager.getRepository(Dsr);
        const dsr = await dsrRepository.findOne({
          where: { id },
          relations: { employee: { user: true } },
        });

        if (!dsr) {
          throw new NotFoundException('DSR not found');
        }

        const currentDate = this.normalizeDate(dsr.date);
        const today = this.getTodayDate();

        if (actingUser.role === UserRole.EMPLOYEE) {
          if (dsr.employee.user.id !== actingUser.id) {
            throw new ForbiddenException(
              'Employees can update only their own DSRs',
            );
          }

          const isToday = currentDate === today;
          const isPastWithPermission =
            currentDate < today && dsr.employeeEditAllowed;

          if (!isToday && !isPastWithPermission) {
            throw new ForbiddenException(
              'An HR or Admin must grant permission before you can update a previous DSR',
            );
          }

          if (
            isToday &&
            dsr.status !== DsrStatus.DRAFT &&
            dsr.status !== DsrStatus.SUBMITTED
          ) {
            throw new ForbiddenException(
              'Employees can update only draft or submitted DSRs for today',
            );
          }

          if (
            updateDsrDto.date &&
            this.normalizeDate(updateDsrDto.date) !== currentDate
          ) {
            throw new ForbiddenException(
              'Employees cannot change the date of an existing DSR',
            );
          }

          if (
            updateDsrDto.status &&
            updateDsrDto.status !== dsr.status &&
            updateDsrDto.status !== DsrStatus.DRAFT &&
            updateDsrDto.status !== DsrStatus.SUBMITTED
          ) {
            throw new ForbiddenException(
              'Employees cannot approve or reject a DSR',
            );
          }
        }

        const targetDate = updateDsrDto.date
          ? this.normalizeDate(updateDsrDto.date)
          : currentDate;
        const targetHours = updateDsrDto.hoursWorked ?? dsr.hoursWorked;

        await this.ensureDailyHoursLimit(
          manager,
          dsr.employee.id,
          targetDate,
          targetHours,
          dsr.id,
        );

        const previousStatus = dsr.status;
        Object.assign(dsr, updateDsrDto, { date: targetDate });
        const updatedDsr = await dsrRepository.save(dsr);

        return {
          updatedDsr,
          previousStatus,
          employee: dsr.employee,
        };
      },
    );

    const { updatedDsr, previousStatus, employee } = updateResult;

    // -------------------------------------------------------
    // If DSR changes to SUBMITTED, notify
    // -------------------------------------------------------

    if (
      previousStatus !== DsrStatus.SUBMITTED &&
      updatedDsr.status === DsrStatus.SUBMITTED
    ) {
      await this.sendDsrSubmittedNotification(updatedDsr, employee);
    }

    // -------------------------------------------------------
    // If DSR changes to APPROVED
    // -------------------------------------------------------

    if (
      previousStatus !== DsrStatus.APPROVED &&
      updatedDsr.status === DsrStatus.APPROVED
    ) {
      await this.sendDsrApprovedNotification(updatedDsr, employee);
    }

    // -------------------------------------------------------
    // If DSR changes to REJECTED
    // -------------------------------------------------------

    if (
      previousStatus !== DsrStatus.REJECTED &&
      updatedDsr.status === DsrStatus.REJECTED
    ) {
      await this.sendDsrRejectedNotification(updatedDsr, employee);
    }

    return updatedDsr;
  }

  async setEmployeeEditPermission(
    id: number,
    allowed: boolean,
    grantedByUserId: number,
  ) {
    const existing = await this.dsrRepository.findOne({
      where: { id },
      relations: { employee: true },
    });

    if (!existing) {
      throw new NotFoundException('DSR not found');
    }

    return this.dsrRepository.manager.transaction(async (manager) => {
      const lockedEmployee = await manager.getRepository(Employee).findOne({
        where: { id: existing.employee.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedEmployee) {
        throw new NotFoundException('Employee not found');
      }

      const dsrRepository = manager.getRepository(Dsr);
      const dsr = await dsrRepository.findOne({ where: { id } });

      if (!dsr) {
        throw new NotFoundException('DSR not found');
      }

      dsr.employeeEditAllowed = allowed;
      dsr.employeeEditGrantedByUserId = allowed ? grantedByUserId : null;
      dsr.employeeEditGrantedAt = allowed ? new Date() : null;

      return dsrRepository.save(dsr);
    });
  }

  // =========================================================
  // DELETE DSR
  // =========================================================

  async remove(id: number) {
    const dsr = await this.dsrRepository.findOne({
      where: {
        id,
      },
    });

    if (!dsr) {
      throw new NotFoundException('DSR not found');
    }

    await this.dsrRepository.remove(dsr);

    return {
      message: 'DSR deleted successfully',
    };
  }

  // =========================================================
  // APPROVE DSR
  // =========================================================

  async approve(id: number) {
    const dsr = await this.dsrRepository.findOne({
      where: {
        id,
      },
      relations: {
        employee: {
          user: true,
        },
      },
    });

    if (!dsr) {
      throw new NotFoundException('DSR not found');
    }

    dsr.status = DsrStatus.APPROVED;

    const savedDsr = await this.dsrRepository.save(dsr);

    await this.sendDsrApprovedNotification(savedDsr, dsr.employee);

    return savedDsr;
  }

  // =========================================================
  // REJECT DSR
  // =========================================================

  async reject(id: number, managerComment?: string) {
    const dsr = await this.dsrRepository.findOne({
      where: {
        id,
      },
      relations: {
        employee: {
          user: true,
        },
      },
    });

    if (!dsr) {
      throw new NotFoundException('DSR not found');
    }

    dsr.status = DsrStatus.REJECTED;

    if (managerComment) {
      dsr.managerComment = managerComment;
    }

    const savedDsr = await this.dsrRepository.save(dsr);

    await this.sendDsrRejectedNotification(savedDsr, dsr.employee);

    return savedDsr;
  }

  private async ensureDailyHoursLimit(
    manager: EntityManager,
    employeeId: number,
    date: string,
    requestedHours: number,
    excludeDsrId?: number,
  ): Promise<void> {
    const reports = await manager.getRepository(Dsr).find({
      where: {
        employee: { id: employeeId },
        date,
      },
      select: {
        id: true,
        hoursWorked: true,
      },
    });

    const excludedId =
      excludeDsrId === undefined ? undefined : Number(excludeDsrId);
    const usedMinutes = reports
      .filter(
        (report) =>
          excludedId === undefined || Number(report.id) !== excludedId,
      )
      .reduce(
        (total, report) => total + this.durationToMinutes(report.hoursWorked),
        0,
      );
    const resultingMinutes =
      usedMinutes + this.durationToMinutes(requestedHours);

    if (resultingMinutes > 24 * 60) {
      throw new BadRequestException(
        `This report would bring the daily total to ${this.formatDuration(resultingMinutes)}. The maximum is 24 hours.`,
      );
    }
  }

  private durationToMinutes(value: number | string): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 0;
    }

    const hours = Math.floor(numericValue);
    const minutePart = Math.round((numericValue - hours) * 100);
    const extraHours = Math.floor(minutePart / 60);
    const minutes = minutePart % 60;

    return (hours + extraHours) * 60 + minutes;
  }

  private formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  private normalizeDate(date: string): string {
    const normalizedDate = date.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new BadRequestException('DSR date must use YYYY-MM-DD format');
    }
    return normalizedDate;
  }

  private getTodayDate(): string {
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

  // =========================================================
  // DSR SUBMITTED NOTIFICATION
  // =========================================================

  private async sendDsrSubmittedNotification(dsr: Dsr, employee: Employee) {
    if (!employee.user) {
      return;
    }
    await this.notificationService.notifyDepartmentApprovers(
      employee.user.id,
      'DSR Submitted',
      `submitted a DSR for ${dsr.date}.`,
      NotificationType.DSR_SUBMITTED,
      `dsr-submitted:${dsr.id}`,
    );
  }

  // =========================================================
  // DSR APPROVED NOTIFICATION
  // =========================================================

  private async sendDsrApprovedNotification(dsr: Dsr, employee: Employee) {
    if (!employee.user) {
      return;
    }

    await this.notificationService.sendEmailAndInAppNotification({
      userId: employee.user.id,
      email: employee.user.email,
      title: 'DSR Approved',
      message: `Your DSR for ${dsr.date} has been approved.`,
      type: NotificationType.DSR,
      relatedEntityType: 'dsr',
      relatedEntityId: String(dsr.id),
      url: '/employee/dsr',
      dedupeKey: `dsr-approved:${dsr.id}`,
    });
  }

  // =========================================================
  // DSR REJECTED NOTIFICATION
  // =========================================================

  private async sendDsrRejectedNotification(dsr: Dsr, employee: Employee) {
    if (!employee.user) {
      return;
    }

    const comment = dsr.managerComment
      ? ` Manager comment: ${dsr.managerComment}`
      : '';

    await this.notificationService.sendEmailAndInAppNotification({
      userId: employee.user.id,
      email: employee.user.email,
      title: 'DSR Rejected',
      message: `Your DSR for ${dsr.date} has been rejected.${comment}`,
      type: NotificationType.DSR,
      relatedEntityType: 'dsr',
      relatedEntityId: String(dsr.id),
      url: '/employee/dsr',
      dedupeKey: `dsr-rejected:${dsr.id}`,
    });
  }
}
