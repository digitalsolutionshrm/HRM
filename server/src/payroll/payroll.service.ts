import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { Payroll, PayrollStatus } from './entities/payroll.entity';
import { PayrollIncrementHistory } from './entities/payroll-increment-history.entity';

import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { ProcessPayrollDto } from './dto/process-payroll.dto';
import { CreatePayrollIncrementDto } from './dto/create-payroll-increment.dto';

import { Employee } from '../employees/entities/employee.entity';
import {
  Attendance,
  AttendanceStatus,
} from '../attendance/entities/attendance.entity';
import {
  Leave,
  LeaveDuration,
  LeaveStatus,
} from '../leaves/entities/leave.entity';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';
import { SettingsService } from '../settings/settings.service';

/**
 * Salary rules:
 *  - employee salary is the monthly gross amount
 *  - basic         = 40% of monthly gross
 *  - HRA           = 16% of monthly gross
 *  - allowances    = remaining 44% of monthly gross
 *  - bonus         = 0 unless separately entered
 *  - overtime      = hours beyond 8h/day, paid at 1.5x hourly rate
 *  - deductions    = only APPROVED leaves count towards the paid allowance
 *                    (`paidLeavesPerMonth`, default 2); every extra leave day
 *                    is cut at the per-day rate (monthly gross / days in
 *                    month). Absent days and leave that was never approved are
 *                    also cut at that same per-day rate.
 *                    PF, ESI, tax and other deductions stay zero.
 */
const BASIC_RATE = 0.4;
const HRA_RATE = 0.16;
const OVERTIME_MULTIPLIER = 1.5;
const WORKDAY_HOURS = 8;

type SalaryInput = {
  basicSalary: number;
  hra?: number;
  allowances?: number;
  bonus?: number;
  overtime?: number;
  overtimeHours?: number;
  pf?: number;
  esi?: number;
  attendanceDeductions?: number;
  leaveDeductions?: number;
  otherDeductions?: number;
  attendanceDays?: number;
  absentDays?: number;
  halfDays?: number;
  leaveDays?: number;
};

const SALARY_KEYS: (keyof SalaryInput)[] = [
  'basicSalary',
  'hra',
  'allowances',
  'bonus',
  'overtime',
  'overtimeHours',
  'pf',
  'esi',
  'attendanceDeductions',
  'leaveDeductions',
  'otherDeductions',
  'attendanceDays',
  'absentDays',
  'halfDays',
  'leaveDays',
];

const round2 = (value: number) => Math.round(value * 100) / 100;

const pad = (value: number) => String(value).padStart(2, '0');

const toUtcDay = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payroll)
    private readonly payrollRepository: Repository<Payroll>,

    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,

    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    @InjectRepository(Leave)
    private readonly leaveRepository: Repository<Leave>,

    @InjectRepository(PayrollIncrementHistory)
    private readonly incrementRepository: Repository<PayrollIncrementHistory>,

    private readonly notificationService: NotificationService,

    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Calculate gross / deductions / net from the individual components.
   */
  private calculateSalary(data: SalaryInput) {
    const basicSalary = Number(data.basicSalary || 0);
    const hra = Number(data.hra || 0);
    const allowances = Number(data.allowances || 0);
    const bonus = Number(data.bonus || 0);
    const overtime = Number(data.overtime || 0);
    const overtimeHours = Number(data.overtimeHours || 0);

    // Keep the legacy database/API fields at zero; tax is no longer part of payroll.
    const tax = 0;
    const pf = 0;
    const esi = 0;
    // Every absent day is charged at the per-day rate (gross / days in month).
    const attendanceDeductions = round2(Number(data.attendanceDeductions || 0));
    // Only leaves beyond the monthly paid allowance are charged.
    const leaveDeductions = round2(Number(data.leaveDeductions || 0));
    const otherDeductions = 0;

    const attendanceDays = Number(data.attendanceDays || 0);
    const absentDays = Number(data.absentDays || 0);
    const halfDays = Number(data.halfDays || 0);
    const leaveDays = Number(data.leaveDays || 0);

    const grossSalary = round2(basicSalary + hra + allowances + bonus + overtime);

    const totalDeductions = round2(
      attendanceDeductions + leaveDeductions + otherDeductions,
    );
    const netSalary = round2(grossSalary - totalDeductions);

    return {
      basicSalary,
      hra,
      allowances,
      bonus,
      overtime,
      overtimeHours,
      grossSalary,
      tax,
      pf,
      esi,
      attendanceDeductions,
      leaveDeductions,
      otherDeductions,
      totalDeductions,
      netSalary,
      attendanceDays,
      absentDays,
      halfDays,
      leaveDays,
    };
  }

  /**
   * Auto calculate salary of an employee for a month from the employee's
   * monthly salary, the attendance records and the approved leaves.
   */
  private async computeFromEmployee(
    employee: Employee,
    month: number,
    year: number,
  ): Promise<SalaryInput> {
    const monthlyGross = round2(Number(employee.salary || 0));
    const basicSalary = round2(monthlyGross * BASIC_RATE);
    const hra = round2(monthlyGross * HRA_RATE);
    const bonus = 0;
    // Use the remainder so rounded components always add up to monthly salary.
    const allowances = round2(monthlyGross - basicSalary - hra);

    const daysInMonth = new Date(year, month, 0).getDate();
    // Overtime remains based on the basic component's hourly rate.
    const perHourSalary = (basicSalary / daysInMonth) / WORKDAY_HOURS;

    const startDate = `${year}-${pad(month)}-01`;
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    // Attendance rows are stored against the user account of the employee.
    const userId = employee.user?.id;

    const attendanceRecords = userId
      ? await this.attendanceRepository.find({
          where: {
            employeeId: userId,
            date: Between(startDate, endDate),
          },
        })
      : [];

    let attendanceDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    for (const record of attendanceRecords) {
      if (
        record.status === AttendanceStatus.PRESENT ||
        record.status === AttendanceStatus.LATE ||
        record.status === AttendanceStatus.SHORT_LEAVE
      ) {
        attendanceDays += 1;
        overtimeHours += Math.max(
          0,
          Number(record.workingHours || 0) - WORKDAY_HOURS,
        );
      } else if (record.status === AttendanceStatus.ABSENT) {
        absentDays += 1;
      } else if (record.status === AttendanceStatus.HALF_DAY) {
        halfDays += 1;
      }
    }

    // Every leave that overlaps this month, whatever its status.
    // Only APPROVED leave days count towards the paid-leave allowance;
    // a pending / rejected / cancelled leave counts as an unpaid absence.
    const leaves = await this.leaveRepository.find({
      where: {
        employeeId: employee.id,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    // For the current month only days up to today can affect payroll.
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const leaveWindowEnd = endDate > todayKey ? todayKey : endDate;

    let leaveDays = 0;
    let unapprovedLeaveDays = 0;
    for (const leave of leaves) {
      let days = 0;

      if (leave.leaveDuration === LeaveDuration.FULL_DAY) {
        const from = Math.max(toUtcDay(leave.startDate), toUtcDay(startDate));
        const to = Math.min(toUtcDay(leave.endDate), toUtcDay(leaveWindowEnd));
        days = Math.max(0, Math.round((to - from) / DAY_MS) + 1);
      } else if (leave.leaveDuration === LeaveDuration.HALF_DAY) {
        days = leave.startDate <= leaveWindowEnd ? 0.5 : 0;
      }
      // SHORT_LEAVE is part of a working day and does not reduce salary.

      if (leave.status === LeaveStatus.APPROVED) {
        leaveDays += days;
      } else {
        unapprovedLeaveDays += days;
      }
    }

    const overtime = round2(
      overtimeHours * perHourSalary * OVERTIME_MULTIPLIER,
    );

    // The first `paidLeavesPerMonth` APPROVED leave days each month are paid;
    // every extra leave day is deducted at the per-day rate of the monthly
    // gross salary. Leave that was never approved becomes an unpaid absence.
    const settings = await this.settingsService.getWorkSettings();
    const paidLeavesPerMonth = Number(settings.paidLeavesPerMonth ?? 0);
    const perDaySalary = monthlyGross / daysInMonth;
    const chargeableLeaveDays = Math.max(0, leaveDays - paidLeavesPerMonth);
    const leaveDeductions = round2(chargeableLeaveDays * perDaySalary);
    // Absent attendance records + leave days that were never approved.
    const totalAbsentDays = round2(absentDays + unapprovedLeaveDays);
    const attendanceDeductions = round2(totalAbsentDays * perDaySalary);

    return {
      basicSalary,
      hra,
      allowances,
      bonus,
      overtime,
      overtimeHours: round2(overtimeHours),
      // tax: 0,
      pf: 0,
      esi: 0,
      attendanceDeductions,
      leaveDeductions,
      otherDeductions: 0,
      attendanceDays,
      absentDays: totalAbsentDays,
      halfDays,
      leaveDays,
    };
  }

  private async findEmployeeWithUser(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: { user: true },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    return employee;
  }

  /**
   * Create payroll.
   *
   * If basicSalary is sent the payroll is created from the sent values;
   * otherwise salary components are derived from employee's monthly salary
   * and adjusted for attendance and approved leaves.
   */
  async create(createPayrollDto: CreatePayrollDto) {
    const { employeeId, month, year, recalculate, ...salaryData } =
      createPayrollDto;

    const employee = await this.findEmployeeWithUser(employeeId);

    const existingPayroll = await this.payrollRepository.findOne({
      where: { employeeId, month, year },
    });

    if (existingPayroll) {
      throw new BadRequestException(
        `Payroll already exists for employee ${employeeId} for ${month}/${year}`,
      );
    }

    let salaryInput: SalaryInput;

    if (salaryData.basicSalary === undefined) {
      if (!employee.salary) {
        throw new BadRequestException(
          'Employee has no salary set. Set the salary first or enter the payroll manually.',
        );
      }
      salaryInput = {
        ...(await this.computeFromEmployee(employee, month, year)),
        ...this.definedOnly(salaryData),
      };
    } else {
      salaryInput = salaryData as SalaryInput;
    }

    const payroll = this.payrollRepository.create({
      employeeId,
      month,
      year,
      ...this.calculateSalary(salaryInput),
      status: PayrollStatus.PENDING,
      paymentDate: null,
    });

    const savedPayroll = await this.payrollRepository.save(payroll);

    return this.formatPayroll(savedPayroll);
  }

  /**
   * Generate payroll for every active employee (with a salary) for a month.
   * Employees that already have a payroll for the month are left untouched.
   */
  async processAll({ month, year }: ProcessPayrollDto) {
    const employees = await this.employeeRepository.find({
      where: { status: true },
      relations: { user: true },
      order: { id: 'ASC' },
    });

    let created = 0;
    let existing = 0;
    let skipped = 0;

    for (const employee of employees) {
      const already = await this.payrollRepository.findOne({
        where: { employeeId: employee.id, month, year },
      });

      if (already) {
        existing += 1;
        continue;
      }

      if (!employee.salary || Number(employee.salary) <= 0) {
        skipped += 1;
        continue;
      }

      const salaryInput = await this.computeFromEmployee(
        employee,
        month,
        year,
      );

      await this.payrollRepository.save(
        this.payrollRepository.create({
          employeeId: employee.id,
          month,
          year,
          ...this.calculateSalary(salaryInput),
          status: PayrollStatus.PENDING,
          paymentDate: null,
        }),
      );

      created += 1;
    }

    return {
      month,
      year,
      created,
      existing,
      skipped,
      payrolls: await this.findByMonth(year, month),
    };
  }

  /**
   * Get all payroll records.
   */
  async findAll() {
    const payrolls = await this.payrollRepository.find({
      relations: {
        employee: { department: true },
      },
      order: {
        year: 'DESC',
        month: 'DESC',
        id: 'DESC',
      },
    });

    return payrolls.map((payroll) => this.formatPayroll(payroll));
  }

  /**
   * Get one payroll.
   */
  async findOne(id: number) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
      relations: {
        employee: { department: true },
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    return this.formatPayroll(payroll);
  }

  /**
   * Get payroll by employee.
   */
  async findByEmployee(employeeId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const payrolls = await this.payrollRepository.find({
      where: { employeeId },
      relations: {
        employee: { department: true },
      },
      order: {
        year: 'DESC',
        month: 'DESC',
      },
    });

    return payrolls.map((payroll) => this.formatPayroll(payroll));
  }

  /** Set an employee's bonus for this payroll month and recompute gross/net. */
  async updateBonus(id: number, bonusAmount: number, actor: AuthenticatedUser) {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException(`Payroll with ID ${id} not found`);
    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Paid payroll cannot be modified');
    }

    if (actor.role === UserRole.MANAGER) {
      const employee = await this.employeeRepository.findOne({
        where: { id: payroll.employeeId },
        relations: { manager: { user: true } },
      });
      if (employee?.manager?.user?.id !== actor.id) {
        throw new BadRequestException('You can only add bonuses for your direct reports');
      }
    }

    const previousBonus = round2(Number(payroll.bonus || 0));
    const bonus = round2(Number(bonusAmount));
    const grossSalary = round2(
      Number(payroll.basicSalary || 0) +
        Number(payroll.hra || 0) +
        Number(payroll.allowances || 0) +
        bonus +
        Number(payroll.overtime || 0),
    );
    const attendanceDeductions = round2(Number(payroll.attendanceDeductions || 0));
    const leaveDeductions = round2(Number(payroll.leaveDeductions || 0));
    const otherDeductions = round2(Number(payroll.otherDeductions || 0));
    const totalDeductions = round2(
      attendanceDeductions + leaveDeductions + otherDeductions,
    );

    Object.assign(payroll, {
      bonus,
      isApproved: false,
      approvedAt: null,
      approvedByUserId: null,
      tax: 0,
      grossSalary,
      pf: 0,
      esi: 0,
      totalDeductions,
      attendanceDeductions,
      leaveDeductions,
      otherDeductions,
      netSalary: round2(grossSalary - totalDeductions),
    });
    const saved = await this.payrollRepository.save(payroll);
    if (bonus > previousBonus) {
      const employee = await this.employeeRepository.findOne({
        where: { id: saved.employeeId },
        relations: { user: true },
      });
      if (employee?.user?.status) {
        const monthName = new Date(2000, saved.month - 1, 1).toLocaleString('en-IN', { month: 'long' });
        try {
          await this.notificationService.createInAppNotification({
            userId: employee.user.id,
            title: 'Bonus received',
            message: `You received a bonus of ₹${bonus.toFixed(2)} for ${monthName} ${saved.year}.`,
            type: NotificationType.PAYROLL,
            relatedEntityType: 'payroll_bonus',
            relatedEntityId: String(saved.id),
            dedupeKey: `payroll-bonus:${saved.id}:${bonus.toFixed(2)}`,
          });
        } catch {
          // Keep the payroll update successful if notification delivery is unavailable.
        }
      }
    }
    return this.formatPayroll(saved);
  }

  /** Active employees HR/Admin can update; managers only receive direct reports. */
  async findIncrementEmployees(actor: AuthenticatedUser) {
    const where = actor.role === UserRole.MANAGER
      ? { status: true, manager: { user: { id: actor.id } } }
      : { status: true };
    const employees = await this.employeeRepository.find({
      where,
      relations: { department: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      department: employee.department?.name ?? null,
      salary: Number(employee.salary || 0),
    }));
  }

  async createIncrement(dto: CreatePayrollIncrementDto, actor: AuthenticatedUser) {
    const created = await this.incrementRepository.manager.transaction(async (manager) => {
      const employeeRepository = manager.getRepository(Employee);
      const historyRepository = manager.getRepository(PayrollIncrementHistory);
      const employee = await employeeRepository.findOne({
        where: { id: dto.employeeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!employee) throw new NotFoundException(`Employee with ID ${dto.employeeId} not found`);
      const profile = await employeeRepository.findOne({
        where: { id: dto.employeeId },
        relations: { department: true, user: true, manager: { user: true } },
      });
      if (actor.role === UserRole.MANAGER && profile?.manager?.user?.id !== actor.id) {
        throw new BadRequestException('You can only increment your direct reports');
      }

      const previousSalary = round2(Number(employee.salary || 0));
      if (previousSalary <= 0) {
        throw new BadRequestException('Set the employee monthly salary before adding an increment');
      }
      const increaseAmount = round2(Number(dto.increaseAmount));
      if (increaseAmount <= 0) throw new BadRequestException('Increment amount must be greater than zero');
      const newSalary = round2(previousSalary + increaseAmount);
      const increasePercent = round2((increaseAmount / previousSalary) * 100);

      employee.salary = newSalary;
      await employeeRepository.save(employee);
      const history = historyRepository.create({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        departmentName: profile?.department?.name ?? null,
        previousSalary,
        newSalary,
        increaseAmount,
        increasePercent,
        effectiveDate: dto.effectiveDate,
        note: dto.note?.trim() || null,
        createdByUserId: actor.id,
      });
      return {
        record: await historyRepository.save(history),
        userId: profile?.user?.id,
      };
    });
    if (created.userId) {
      try {
        await this.notificationService.createInAppNotification({
          userId: created.userId,
          title: 'Salary increment received',
          message: `Your monthly salary increased by ₹${Number(created.record.increaseAmount).toFixed(2)} (${Number(created.record.increasePercent).toFixed(2)}%) to ₹${Number(created.record.newSalary).toFixed(2)}, effective ${created.record.effectiveDate}.`,
          type: NotificationType.PAYROLL,
          relatedEntityType: 'payroll_increment',
          relatedEntityId: String(created.record.id),
          dedupeKey: `payroll-increment:${created.record.id}`,
        });
      } catch {
        // Keep the salary update successful if notification delivery is unavailable.
      }
    }
    return this.formatIncrement(created.record);
  }

  async findIncrementHistory(actor: AuthenticatedUser) {
    let where: any = {};
    if (actor.role === UserRole.MANAGER) {
      const employees = await this.employeeRepository.find({
        where: { manager: { user: { id: actor.id } } },
        select: { id: true },
      });
      const employeeIds = employees.map(({ id }) => id);
      if (employeeIds.length === 0) return [];
      where = { employeeId: In(employeeIds) };
    }
    const history = await this.incrementRepository.find({
      where,
      order: { effectiveDate: 'DESC', id: 'DESC' },
    });
    return history.map((record) => this.formatIncrement(record));
  }

  async findEmployeeIncrementHistory(employeeId: number, actor: AuthenticatedUser) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: { manager: { user: true } },
    });
    if (!employee) throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    if (actor.role === UserRole.MANAGER && employee.manager?.user?.id !== actor.id) {
      throw new BadRequestException('You can only view increment history for your direct reports');
    }
    const history = await this.incrementRepository.find({
      where: { employeeId },
      order: { effectiveDate: 'DESC', id: 'DESC' },
    });
    return history.map((record) => this.formatIncrement(record));
  }

  private formatIncrement(record: PayrollIncrementHistory) {
    return {
      id: record.id,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      department: record.departmentName,
      previousSalary: Number(record.previousSalary),
      newSalary: Number(record.newSalary),
      increaseAmount: Number(record.increaseAmount),
      increasePercent: Number(record.increasePercent),
      effectiveDate: String(record.effectiveDate).slice(0, 10),
      note: record.note,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
    };
  }

  /**
   * Payroll of the logged in user (used by "My Payroll").
   * Returns every payroll record of the signed-in employee so they can view
   * their salary; only downloading a payslip requires HR/Admin approval.
   * Returns an empty list when the user has no employee profile yet.
   */
  async findMine(userId: number) {
    const employee = await this.employeeRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!employee) {
      return [];
    }

    const payrolls = await this.payrollRepository.find({
      where: { employeeId: employee.id },
      relations: { employee: { department: true } },
      order: { year: 'DESC', month: 'DESC', id: 'DESC' },
    });
    return payrolls.map((payroll) => this.formatPayroll(payroll));
  }

  /**
   * Get payroll by month and year.
   */
  async findByMonth(year: number, month: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    const payrolls = await this.payrollRepository.find({
      where: { year, month },
      relations: {
        employee: { department: true },
      },
      order: { id: 'DESC' },
    });

    return payrolls.map((payroll) => this.formatPayroll(payroll));
  }

  /**
   * Update payroll.
   *
   * Send `recalculate: true` to rebuild the values from the latest
   * salary, attendance and leave data. Values sent in the same request win.
   */
  async update(id: number, updatePayrollDto: UpdatePayrollDto) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Paid payroll cannot be modified');
    }

    const employeeId = updatePayrollDto.employeeId ?? payroll.employeeId;
    const month = updatePayrollDto.month ?? payroll.month;
    const year = updatePayrollDto.year ?? payroll.year;

    const employee = await this.findEmployeeWithUser(employeeId);

    const duplicate = await this.payrollRepository.findOne({
      where: { employeeId, month, year },
    });

    if (duplicate && duplicate.id !== payroll.id) {
      throw new BadRequestException(
        'Payroll already exists for this employee and month',
      );
    }

    const employeeOrPeriodChanged =
      employeeId !== payroll.employeeId ||
      month !== payroll.month ||
      year !== payroll.year;

    const existingValues = Object.fromEntries(
      SALARY_KEYS.map((key) => [key, Number(payroll[key] ?? 0)]),
    ) as unknown as SalaryInput;

    const baseValues =
      updatePayrollDto.recalculate || employeeOrPeriodChanged
        ? await this.computeFromEmployee(employee, month, year)
        : existingValues;

    const salaryData: SalaryInput = {
      ...baseValues,
      ...this.definedOnly(updatePayrollDto),
    };

    Object.assign(payroll, {
      employeeId,
      month,
      year,
      isApproved: false,
      approvedAt: null,
      approvedByUserId: null,
      ...this.calculateSalary(salaryData),
    });

    const updatedPayroll = await this.payrollRepository.save(payroll);

    return this.formatPayroll(updatedPayroll);
  }

  /**
   * Set status (pending -> processed -> paid). Paid is final.
   */
  async updateStatus(id: number, status: PayrollStatus) {
    if (status === PayrollStatus.PAID) {
      return this.markAsPaid(id);
    }

    if (status === PayrollStatus.PROCESSED) {
      return this.process(id);
    }

    const payroll = await this.payrollRepository.findOne({ where: { id } });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Paid payroll cannot be modified');
    }

    payroll.status = PayrollStatus.PENDING;
    payroll.paymentDate = null;

    return this.formatPayroll(await this.payrollRepository.save(payroll));
  }

  async approvePayslip(id: number, actor: AuthenticatedUser) {
    const payroll = await this.payrollRepository.findOne({ where: { id } });
    if (!payroll) throw new NotFoundException(`Payroll with ID ${id} not found`);
    if (payroll.isApproved) return this.formatPayroll(payroll);

    payroll.isApproved = true;
    payroll.approvedAt = new Date();
    payroll.approvedByUserId = actor.id;
    const saved = await this.payrollRepository.save(payroll);
    const employee = await this.employeeRepository.findOne({
      where: { id: saved.employeeId },
      relations: { user: true },
    });
    if (employee?.user?.status) {
      try {
        await this.notificationService.createInAppNotification({
          userId: employee.user.id,
          title: 'Payslip approved',
          message: `Your payslip for ${saved.month}/${saved.year} has been approved and is ready to download.`,
          type: NotificationType.PAYROLL,
          relatedEntityType: 'payroll_payslip_approved',
          relatedEntityId: String(saved.id),
          url: '/employee/payslips',
          dedupeKey: `payslip-approved:${saved.id}:${saved.updatedAt.getTime()}`,
        });
      } catch {
        // Keep payroll approval successful if notification delivery is unavailable.
      }
    }
    return this.formatPayroll(saved);
  }

  /**
   * Process payroll.
   */
  async process(id: number) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Payroll is already paid');
    }

    const wasProcessed = payroll.status === PayrollStatus.PROCESSED;

    payroll.status = PayrollStatus.PROCESSED;

    const updatedPayroll = await this.payrollRepository.save(payroll);

    if (!wasProcessed) {
      const employee = await this.employeeRepository.findOne({
        where: { id: payroll.employeeId },
        relations: { user: true },
      });
      if (employee?.user) {
        await this.notificationService.createInAppNotification({
          userId: employee.user.id,
          title: 'Payroll processed',
          message: `Your payroll for ${payroll.month}/${payroll.year} has been processed.`,
          type: NotificationType.PAYROLL,
          relatedEntityType: 'payroll',
          relatedEntityId: String(payroll.id),
          dedupeKey: `payroll-processed:${payroll.id}`,
        });
      }
    }

    return this.formatPayroll(updatedPayroll);
  }

  /**
   * Mark payroll as paid.
   */
  async markAsPaid(id: number) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Payroll is already marked as paid');
    }

    payroll.status = PayrollStatus.PAID;
    payroll.paymentDate = new Date();

    const updatedPayroll = await this.payrollRepository.save(payroll);

    return this.formatPayroll(updatedPayroll);
  }

  /**
   * Delete payroll.
   */
  async remove(id: number) {
    const payroll = await this.payrollRepository.findOne({
      where: { id },
    });

    if (!payroll) {
      throw new NotFoundException(`Payroll with ID ${id} not found`);
    }

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException('Paid payroll cannot be deleted');
    }

    await this.payrollRepository.remove(payroll);

    return {
      message: 'Payroll deleted successfully',
    };
  }

  private definedOnly(source: Record<string, any>): Partial<SalaryInput> {
    const result: Record<string, number> = {};
    for (const key of SALARY_KEYS) {
      if (source[key] !== undefined && source[key] !== null) {
        result[key] = source[key];
      }
    }
    return result as Partial<SalaryInput>;
  }

  /**
   * Format decimal values returned by PostgreSQL.
   *
   * PostgreSQL DECIMAL columns are often returned
   * by TypeORM as strings.
   */
  private formatPayroll(payroll: Payroll) {
    const employee = payroll.employee;
    const grossSalary = Number(payroll.grossSalary || 0);

    return {
      id: payroll.id,

      employeeId: payroll.employeeId,

      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            firstName: employee.firstName,
            lastName: employee.lastName,
            designation: employee.designation,
            department: employee.department?.name ?? null,
          }
        : undefined,

      month: payroll.month,
      year: payroll.year,

      basicSalary: Number(payroll.basicSalary),
      hra: Number(payroll.hra),
      allowances: Number(payroll.allowances),
      bonus: Number(payroll.bonus),
      overtime: Number(payroll.overtime),
      overtimeHours: Number(payroll.overtimeHours),

      grossSalary,

      tax: 0,
      pf: 0,
      esi: 0,
      attendanceDeductions: Number(payroll.attendanceDeductions || 0),
      leaveDeductions: Number(payroll.leaveDeductions || 0),
      otherDeductions: Number(payroll.otherDeductions || 0),

      totalDeductions: Number(payroll.totalDeductions || 0),

      netSalary: Number(payroll.netSalary || 0),

      attendanceDays: Number(payroll.attendanceDays),
      absentDays: Number(payroll.absentDays),
      halfDays: Number(payroll.halfDays),
      leaveDays: Number(payroll.leaveDays),

      status: payroll.status,
      paymentDate: payroll.paymentDate,
      isApproved: Boolean(payroll.isApproved),
      approvedAt: payroll.approvedAt ?? null,
      approvedByUserId: payroll.approvedByUserId ?? null,

      createdAt: payroll.createdAt,
      updatedAt: payroll.updatedAt,
    };
  }
}
