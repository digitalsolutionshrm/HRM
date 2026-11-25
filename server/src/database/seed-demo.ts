import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { getPostgresConnectionOptions } from './postgres-options';

import { User } from '../users/entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeePersonalDetails } from '../employees/entities/employee-personal-details.entity';
import { EmployeeAddress } from '../employees/entities/employee-address.entity';
import { EmployeeDocument } from '../employees/entities/employee-document.entity';
import { Department } from '../departments/entities/department.entity';

import { WorkSettings } from '../settings/entities/work-settings.entity';
import { Holiday } from '../settings/entities/holiday.entity';

import {
  Attendance,
  AttendanceStatus,
} from '../attendance/entities/attendance.entity';
import {
  Leave,
  LeaveDuration,
  LeaveStatus,
  LeaveType,
} from '../leaves/entities/leave.entity';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity';

import { UserRole } from '../auth/enums/user-role.enum';

/**
 * Demo data for full-project testing:
 *  - 6 employees (each with a login account)
 *  - attendance for Sep, Oct and Nov (up to today) covering
 *    present / late / half-day / absent / leave
 *  - a few holidays so the monthly report can compute working days
 *  - payroll for Sep + Oct marked PAID, and Nov left PENDING
 *
 * The demo login password is taken from the DEMO_EMPLOYEE_PASSWORD
 * environment variable. When it is not set, a random one is generated and
 * printed once at the end of the run.
 *
 * Run with:  npm run seed:demo
 */

const RANGE_START = '2026-09-01';
const RANGE_END = '2026-11-03';

const DEPARTMENTS: { name: string; description: string }[] = [
  { name: 'Engineering', description: 'Product and platform engineering' },
  { name: 'Sales', description: 'Field and inside sales' },
  { name: 'Marketing', description: 'Brand, growth and campaigns' },
  { name: 'Finance', description: 'Accounts, payroll and compliance' },
  { name: 'Operations', description: 'Day-to-day business operations' },
];

interface DemoEmployee {
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  department: string;
  salary: number;
  phone: string;
  gender: string;
  maritalStatus: string;
  bloodGroup: string;
  dateOfBirth: string;
  fatherName?: string;
  husbandName?: string;
  city: string;
  state: string;
  joiningDate: string;
}

const EMPLOYEES: DemoEmployee[] = [
  {
    firstName: 'Amit',
    lastName: 'Sharma',
    email: 'amit.sharma@hrm.com',
    designation: 'Software Engineer',
    department: 'Engineering',
    salary: 45000,
    phone: '9810011001',
    gender: 'Male',
    maritalStatus: 'Single',
    bloodGroup: 'B+',
    dateOfBirth: '1995-03-12',
    fatherName: 'Rajesh Sharma',
    city: 'Noida',
    state: 'Uttar Pradesh',
    joiningDate: '2025-04-01',
  },
  {
    firstName: 'Priya',
    lastName: 'Verma',
    email: 'priya.verma@hrm.com',
    designation: 'UI UX Designer',
    department: 'Engineering',
    salary: 40000,
    phone: '9810011002',
    gender: 'Female',
    maritalStatus: 'Married',
    bloodGroup: 'O+',
    dateOfBirth: '1996-07-25',
    husbandName: 'Karan Verma',
    city: 'Ghaziabad',
    state: 'Uttar Pradesh',
    joiningDate: '2025-06-15',
  },
  {
    firstName: 'Rahul',
    lastName: 'Singh',
    email: 'rahul.singh@hrm.com',
    designation: 'Sales Executive',
    department: 'Sales',
    salary: 35000,
    phone: '9810011003',
    gender: 'Male',
    maritalStatus: 'Single',
    bloodGroup: 'A+',
    dateOfBirth: '1997-01-09',
    fatherName: 'Mahesh Singh',
    city: 'Delhi',
    state: 'Delhi',
    joiningDate: '2025-02-10',
  },
  {
    firstName: 'Neha',
    lastName: 'Gupta',
    email: 'neha.gupta@hrm.com',
    designation: 'Marketing Specialist',
    department: 'Marketing',
    salary: 42000,
    phone: '9810011004',
    gender: 'Female',
    maritalStatus: 'Married',
    bloodGroup: 'AB+',
    dateOfBirth: '1994-11-30',
    husbandName: 'Saurabh Gupta',
    city: 'Gurugram',
    state: 'Haryana',
    joiningDate: '2024-11-05',
  },
  {
    firstName: 'Vikram',
    lastName: 'Patel',
    email: 'vikram.patel@hrm.com',
    designation: 'Accounts Executive',
    department: 'Finance',
    salary: 55000,
    phone: '9810011005',
    gender: 'Male',
    maritalStatus: 'Married',
    bloodGroup: 'B-',
    dateOfBirth: '1991-05-18',
    fatherName: 'Natwar Patel',
    city: 'Noida',
    state: 'Uttar Pradesh',
    joiningDate: '2024-08-20',
  },
  {
    firstName: 'Anjali',
    lastName: 'Nair',
    email: 'anjali.nair@hrm.com',
    designation: 'Operations Executive',
    department: 'Operations',
    salary: 33000,
    phone: '9810011006',
    gender: 'Female',
    maritalStatus: 'Single',
    bloodGroup: 'O-',
    dateOfBirth: '1998-09-02',
    fatherName: 'Suresh Nair',
    city: 'Faridabad',
    state: 'Haryana',
    joiningDate: '2025-09-01',
  },
];

const HOLIDAYS: { name: string; date: string; description: string }[] = [
  { name: 'Ganesh Chaturthi', date: '2026-09-14', description: 'Public holiday' },
  { name: 'Gandhi Jayanti', date: '2026-10-02', description: 'National holiday' },
  { name: 'Dussehra', date: '2026-10-20', description: 'Festival holiday' },
  { name: 'Diwali', date: '2026-11-08', description: 'Festival holiday' },
];

const LEAVES: {
  email: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  leaveDuration: LeaveDuration;
  status: LeaveStatus;
  reason: string;
  rejectionReason?: string;
}[] = [
  {
    email: 'rahul.singh@hrm.com',
    leaveType: LeaveType.CASUAL,
    startDate: '2026-09-21',
    endDate: '2026-09-23',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Personal work (3 days - exceeds the 2 paid leaves)',
  },
  {
    email: 'vikram.patel@hrm.com',
    leaveType: LeaveType.SICK,
    startDate: '2026-09-10',
    endDate: '2026-09-11',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Viral fever',
  },
  {
    email: 'anjali.nair@hrm.com',
    leaveType: LeaveType.SICK,
    startDate: '2026-09-22',
    endDate: '2026-09-22',
    leaveDuration: LeaveDuration.HALF_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Medical checkup (half day)',
  },
  {
    email: 'neha.gupta@hrm.com',
    leaveType: LeaveType.CASUAL,
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Family function (3 days - exceeds the 2 paid leaves)',
  },
  {
    email: 'priya.verma@hrm.com',
    leaveType: LeaveType.CASUAL,
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    leaveDuration: LeaveDuration.HALF_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Personal errand (half day)',
  },
  {
    email: 'anjali.nair@hrm.com',
    leaveType: LeaveType.CASUAL,
    startDate: '2026-11-02',
    endDate: '2026-11-02',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.APPROVED,
    reason: 'Personal work',
  },
  {
    email: 'rahul.singh@hrm.com',
    leaveType: LeaveType.UNPAID,
    startDate: '2026-10-08',
    endDate: '2026-10-09',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.REJECTED,
    reason: 'Rejected leave - no prior notice (counts as absent)',
    rejectionReason: 'Applied without notice; manager rejected the request',
  },
  {
    email: 'amit.sharma@hrm.com',
    leaveType: LeaveType.CASUAL,
    startDate: '2026-11-05',
    endDate: '2026-11-06',
    leaveDuration: LeaveDuration.FULL_DAY,
    status: LeaveStatus.PENDING,
    reason: 'Travel - awaiting HR approval',
  },
];

const dataSource = new DataSource({
  ...getPostgresConnectionOptions(),
  entities: [
    User,
    Employee,
    EmployeePersonalDetails,
    EmployeeAddress,
    EmployeeDocument,
    Department,
    WorkSettings,
    Holiday,
    Attendance,
    Leave,
    Payroll,
  ],
  synchronize: false,
});

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;
const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();
const weekdayOf = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day).getDay();
const round2 = (value: number) => Math.round(value * 100) / 100;
const toUtcDay = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic pseudo-random roll (0-99) so re-running gives the same data. */
function rollFor(employeeIndex: number, month: number, day: number): number {
  return (employeeIndex * 37 + day * 17 + month * 29 + day * day) % 100;
}

function statusFor(
  employeeIndex: number,
  month: number,
  day: number,
): AttendanceStatus {
  const roll = rollFor(employeeIndex, month, day);
  if (roll < 68) return AttendanceStatus.PRESENT;
  if (roll < 86) return AttendanceStatus.LATE;
  if (roll < 95) return AttendanceStatus.HALF_DAY;
  if (roll < 98) return AttendanceStatus.ABSENT;
  return AttendanceStatus.PRESENT;
}

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/** Builds the check-in / break / check-out timestamps for a status. */
function buildDay(
  status: AttendanceStatus,
  year: number,
  month: number,
  day: number,
  jitter: number,
) {
  if (status === AttendanceStatus.ABSENT) {
    return {
      checkIn: null,
      checkOut: null,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      workingHours: null,
      remarks: 'Unapproved absence',
    };
  }

  if (status === AttendanceStatus.HALF_DAY) {
    const checkIn = at(year, month, day, 9, 30 + (jitter % 10));
    const checkOut = at(year, month, day, 13, 0);
    return {
      checkIn,
      checkOut,
      breakStart: null,
      breakEnd: null,
      breakMinutes: 0,
      workingHours: round2((checkOut.getTime() - checkIn.getTime()) / 3_600_000),
      remarks: 'Half day - left early',
    };
  }

  const late = status === AttendanceStatus.LATE;
  const checkIn = late
    ? at(year, month, day, 10, 15 + (jitter % 20))
    : at(year, month, day, 9, 20 + (jitter % 10));
  const breakStart = at(year, month, day, 13, 5);
  const breakEnd = at(year, month, day, 13, 50);
  const checkOut = late
    ? at(year, month, day, 18, 45)
    : at(year, month, day, 18, 35);
  const breakMinutes = Math.round(
    (breakEnd.getTime() - breakStart.getTime()) / 60_000,
  );
  const worked =
    (checkOut.getTime() - checkIn.getTime() - breakMinutes * 60_000) / 3_600_000;

  return {
    checkIn,
    checkOut,
    breakStart,
    breakEnd,
    breakMinutes,
    workingHours: round2(worked),
    remarks: late ? 'Late arrival' : null,
  };
}

function resolveDemoPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.DEMO_EMPLOYEE_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 8) {
    return { password: fromEnv, generated: false };
  }
  return { password: `Demo-${randomBytes(5).toString('hex')}`, generated: true };
}

async function main() {
  await dataSource.initialize();
  console.log(
    `[seed:demo] Connected to ${String(dataSource.options.database)}`,
  );

  const userRepo = dataSource.getRepository(User);
  const employeeRepo = dataSource.getRepository(Employee);
  const personalRepo = dataSource.getRepository(EmployeePersonalDetails);
  const addressRepo = dataSource.getRepository(EmployeeAddress);
  const departmentRepo = dataSource.getRepository(Department);
  const settingsRepo = dataSource.getRepository(WorkSettings);
  const holidayRepo = dataSource.getRepository(Holiday);
  const attendanceRepo = dataSource.getRepository(Attendance);
  const leaveRepo = dataSource.getRepository(Leave);
  const payrollRepo = dataSource.getRepository(Payroll);

  // ---- work settings (create defaults; enforce a Monday-Friday work week) ----
  // Office hours stay 09:30 - 18:30 with a 15 minute grace period.
  const MON_FRI_WEEKLY_OFF = [0, 6]; // Sunday + Saturday off
  let settings = await settingsRepo.findOne({ where: {}, order: { id: 'ASC' } });
  if (!settings) {
    settings = await settingsRepo.save(
      settingsRepo.create({
        officeStartTime: '09:30:00',
        officeEndTime: '18:30:00',
        graceMinutes: 15,
        standardWorkHours: 8,
        paidLeavesPerMonth: 2,
        weeklyOffDays: MON_FRI_WEEKLY_OFF,
      }),
    );
    console.log('[seed:demo] Created default work settings (Mon-Fri week)');
  } else {
    const current = (settings.weeklyOffDays ?? []).map(Number).sort();
    const sameWeek =
      current.length === MON_FRI_WEEKLY_OFF.length &&
      current.every((day, i) => day === MON_FRI_WEEKLY_OFF[i]);
    if (!sameWeek) {
      settings.weeklyOffDays = MON_FRI_WEEKLY_OFF;
      settings = await settingsRepo.save(settings);
      console.log('[seed:demo] Work week set to Monday-Friday (Sat + Sun off)');
    }
  }
  const weeklyOffDays = (settings.weeklyOffDays ?? MON_FRI_WEEKLY_OFF).map(
    Number,
  );
  const paidLeavesPerMonth = Number(settings.paidLeavesPerMonth ?? 0);

  // ---- holidays ----
  for (const holiday of HOLIDAYS) {
    const exists = await holidayRepo.findOne({ where: { date: holiday.date } });
    if (exists) continue;
    await holidayRepo.save(holidayRepo.create(holiday));
    console.log(`[seed:demo] Holiday added: ${holiday.date} ${holiday.name}`);
  }
  const holidayDates = new Set(
    (await holidayRepo.find()).map((holiday) =>
      String(holiday.date).slice(0, 10),
    ),
  );

  // ---- departments ----
  const departmentByName = new Map<string, Department>();
  for (const department of DEPARTMENTS) {
    let row = await departmentRepo.findOne({ where: { name: department.name } });
    if (!row) {
      row = await departmentRepo.save(
        departmentRepo.create({ ...department, status: true }),
      );
      console.log(`[seed:demo] Department created: ${department.name}`);
    }
    departmentByName.set(department.name, row);
  }

  // ---- employees ----
  const demoPassword = resolveDemoPassword();
  const passwordHash = await bcrypt.hash(demoPassword.password, 10);
  const demoEmployees: {
    employee: Employee;
    definition: DemoEmployee;
    index: number;
  }[] = [];

  for (let index = 0; index < EMPLOYEES.length; index += 1) {
    const definition = EMPLOYEES[index];
    const email = definition.email.toLowerCase();

    let user = await userRepo.findOne({ where: { email } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          name: `${definition.firstName} ${definition.lastName}`.trim(),
          email,
          password: passwordHash,
          role: UserRole.EMPLOYEE,
          status: true,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        }),
      );
      console.log(`[seed:demo] Login created: ${email}`);
    } else {
      user.password = passwordHash;
      user.role = UserRole.EMPLOYEE;
      user.status = true;
      await userRepo.save(user);
    }

    let employee = await employeeRepo.findOne({
      where: { user: { id: user.id } },
      relations: { user: true, department: true },
    });

    if (!employee) {
      const lastEmployee = await employeeRepo.find({
        order: { id: 'DESC' },
        take: 1,
      });
      const nextNumber = lastEmployee[0] ? lastEmployee[0].id + 1 : 1;
      employee = await employeeRepo.save(
        employeeRepo.create({
          employeeCode: `EMP-${String(nextNumber).padStart(4, '0')}`,
          firstName: definition.firstName,
          lastName: definition.lastName,
          phone: definition.phone,
          phoneCountryCode: '+91',
          designation: definition.designation,
          joiningDate: new Date(definition.joiningDate),
          salary: definition.salary,
          status: true,
          performance: round2(70 + ((index * 5) % 30)),
          department: departmentByName.get(definition.department),
          user,
        }),
      );

      await personalRepo.save(
        personalRepo.create({
          employee,
          dateOfBirth: new Date(definition.dateOfBirth),
          gender: definition.gender,
          maritalStatus: definition.maritalStatus,
          nationality: 'Indian',
          bloodGroup: definition.bloodGroup,
          personalEmail: `personal.${email}`,
          alternatePhone: definition.phone,
          fatherName: definition.fatherName,
          husbandName: definition.husbandName,
          motherName: definition.husbandName ? 'Sunita Devi' : 'Kamla Devi',
          emergencyContactName:
            definition.husbandName ?? definition.fatherName ?? 'Family',
          emergencyContactPhone: definition.phone,
          emergencyContactRelation: definition.husbandName ? 'Spouse' : 'Parent',
        }),
      );

      await addressRepo.save([
        addressRepo.create({
          employee,
          addressType: 'CURRENT',
          addressLine1: 'House 12, Sector 4',
          city: definition.city,
          state: definition.state,
          country: 'India',
          postalCode: '201301',
          isPrimary: true,
        }),
        addressRepo.create({
          employee,
          addressType: 'PERMANENT',
          addressLine1: 'House 12, Sector 4',
          city: definition.city,
          state: definition.state,
          country: 'India',
          postalCode: '201301',
          isPrimary: false,
        }),
      ]);

      console.log(
        `[seed:demo] Employee created: ${definition.firstName} ${definition.lastName} (${definition.department})`,
      );
    } else {
      employee.designation = definition.designation;
      employee.salary = definition.salary;
      employee.status = true;
      employee.department = departmentByName.get(definition.department);
      await employeeRepo.save(employee);
    }

    demoEmployees.push({ employee, definition, index });
  }

  // Attach a few demo employees to the existing manager account (if any).
  const managerUser = await userRepo.findOne({
    where: { email: 'manager@hrm.com' },
  });
  const managerEmployee = managerUser
    ? await employeeRepo.findOne({ where: { user: { id: managerUser.id } } })
    : null;
  if (managerEmployee) {
    const team = demoEmployees.slice(0, 3);
    for (const member of team) {
      member.employee.manager = managerEmployee;
      await employeeRepo.save(member.employee);
    }
    console.log(
      `[seed:demo] Assigned ${team.length} employees to the manager account`,
    );
  } else {
    console.log(
      '[seed:demo] No employee profile for the manager account - skipping team assignment',
    );
  }

  const userIds = demoEmployees.map((entry) => entry.employee.user!.id ?? 0);
  const employeeIds = demoEmployees.map((entry) => entry.employee.id);

  // ---- clean previous demo data (idempotent re-runs) ----
  const demoDates: string[] = [];
  for (const month of [9, 10, 11]) {
    for (let day = 1; day <= daysInMonth(2026, month); day += 1) {
      const date = iso(2026, month, day);
      if (date >= RANGE_START && date <= RANGE_END) demoDates.push(date);
    }
  }
  await attendanceRepo.delete({ employeeId: In(userIds), date: In(demoDates) });
  await leaveRepo.delete({ employeeId: In(employeeIds) });
  await payrollRepo.delete({ employeeId: In(employeeIds) });

  // ---- leaves and the dates they occupy (any status) ----
  const leaveDatesByEmployee = new Map<number, Set<string>>();

  for (const leave of LEAVES) {
    const entry = demoEmployees.find(
      (item) => item.definition.email === leave.email,
    );
    if (!entry) continue;

    await leaveRepo.save(
      leaveRepo.create({
        employeeId: entry.employee.id,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
        leaveDuration: leave.leaveDuration,
        status: leave.status,
        startTime:
          leave.leaveDuration === LeaveDuration.HALF_DAY ? '09:30:00' : null,
        endTime:
          leave.leaveDuration === LeaveDuration.HALF_DAY ? '13:30:00' : null,
        rejectionReason: leave.rejectionReason ?? null,
      }),
    );

    // Every leave day (approved or not) has no attendance record. A day that
    // is not approved therefore shows up as an absence in the reports.
    const bucket =
      leaveDatesByEmployee.get(entry.employee.id) ?? new Set<string>();
    const from = toUtcDay(leave.startDate);
    const to = toUtcDay(leave.endDate);
    for (let time = from; time <= to; time += DAY_MS) {
      bucket.add(new Date(time).toISOString().slice(0, 10));
    }
    leaveDatesByEmployee.set(entry.employee.id, bucket);
  }

  // ---- attendance for Sep, Oct and Nov (up to RANGE_END) ----
  const attendanceRows: Partial<Attendance>[] = [];

  for (const entry of demoEmployees) {
    const leaveDates =
      leaveDatesByEmployee.get(entry.employee.id) ?? new Set<string>();
    const joining = entry.definition.joiningDate;

    for (const month of [9, 10, 11]) {
      const lastDay = daysInMonth(2026, month);
      for (let day = 1; day <= lastDay; day += 1) {
        const date = iso(2026, month, day);
        if (date < RANGE_START || date > RANGE_END) continue;
        if (date < joining) continue;
        if (holidayDates.has(date)) continue;
        if (weeklyOffDays.includes(weekdayOf(2026, month, day))) continue;
        if (leaveDates.has(date)) continue;

        const status = statusFor(entry.index, month, day);
        const times = buildDay(
          status,
          2026,
          month,
          day,
          rollFor(entry.index, month, day),
        );

        attendanceRows.push({
          employeeId: entry.employee.user!.id,
          date,
          status,
          ...times,
        });
      }
    }
  }

  for (let i = 0; i < attendanceRows.length; i += 200) {
    await attendanceRepo.save(
      attendanceRows.slice(i, i + 200).map((row) => attendanceRepo.create(row)),
    );
  }
  console.log(`[seed:demo] Attendance rows created: ${attendanceRows.length}`);

  // ---- payroll: Sep + Oct PAID, Nov PENDING ----
  const adminUser = await userRepo.findOne({ where: { email: 'digitalsolutionsit01@gmail.com' } });
  const adminUserId = adminUser?.id ?? null;

  for (const entry of demoEmployees) {
    const monthlyGross = round2(Number(entry.definition.salary));
    const basicSalary = round2(monthlyGross * 0.4);
    const hra = round2(monthlyGross * 0.16);
    const allowances = round2(monthlyGross - basicSalary - hra);

    for (const month of [9, 10, 11]) {
      const dim = daysInMonth(2026, month);
      const startDate = `${2026}-${pad(month)}-01`;
      const endDate = `${2026}-${pad(month)}-${pad(dim)}`;

      const monthAttendance = attendanceRows.filter(
        (row) =>
          row.employeeId === entry.employee.user!.id &&
          String(row.date) >= startDate &&
          String(row.date) <= endDate,
      );

      let attendanceDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let overtimeHours = 0;
      for (const row of monthAttendance) {
        if (
          row.status === AttendanceStatus.PRESENT ||
          row.status === AttendanceStatus.LATE ||
          row.status === AttendanceStatus.SHORT_LEAVE
        ) {
          attendanceDays += 1;
          overtimeHours += Math.max(0, Number(row.workingHours || 0) - 8);
        } else if (row.status === AttendanceStatus.ABSENT) {
          absentDays += 1;
        } else if (row.status === AttendanceStatus.HALF_DAY) {
          halfDays += 1;
        }
      }

      // Only leave days up to RANGE_END can affect the current month.
      const leaveWindowEnd = endDate > RANGE_END ? RANGE_END : endDate;
      // Only approved leave counts towards the paid allowance; leave that was
      // never approved is treated as an unpaid absence.
      const monthLeaves = LEAVES.filter(
        (leave) =>
          leave.email === entry.definition.email &&
          leave.startDate <= endDate &&
          leave.endDate >= startDate,
      );
      let leaveDays = 0;
      let unapprovedLeaveDays = 0;
      for (const leave of monthLeaves) {
        let days = 0;
        if (leave.leaveDuration === LeaveDuration.FULL_DAY) {
          const from = Math.max(toUtcDay(leave.startDate), toUtcDay(startDate));
          const to = Math.min(
            toUtcDay(leave.endDate),
            toUtcDay(leaveWindowEnd),
          );
          days = Math.max(0, Math.round((to - from) / DAY_MS) + 1);
        } else if (leave.leaveDuration === LeaveDuration.HALF_DAY) {
          days = leave.startDate <= leaveWindowEnd ? 0.5 : 0;
        }
        if (leave.status === LeaveStatus.APPROVED) leaveDays += days;
        else unapprovedLeaveDays += days;
      }

      const perHourSalary = basicSalary / dim / 8;
      const overtime = round2(overtimeHours * perHourSalary * 1.5);
      const perDaySalary = monthlyGross / dim;
      const chargeableLeaveDays = Math.max(0, leaveDays - paidLeavesPerMonth);
      const leaveDeductions = round2(chargeableLeaveDays * perDaySalary);
      // Absent attendance records + leave days that were never approved.
      const totalAbsentDays = round2(absentDays + unapprovedLeaveDays);
      const attendanceDeductions = round2(totalAbsentDays * perDaySalary);

      const grossSalary = round2(basicSalary + hra + allowances + overtime);
      const totalDeductions = round2(attendanceDeductions + leaveDeductions);
      const netSalary = round2(grossSalary - totalDeductions);

      const isPaidMonth = month <= 10;
      const settlementDate = new Date(2026, month - 1, dim, 12, 0, 0, 0);

      await payrollRepo.save(
        payrollRepo.create({
          employeeId: entry.employee.id,
          month,
          year: 2026,
          basicSalary,
          hra,
          allowances,
          bonus: 0,
          overtime,
          overtimeHours: round2(overtimeHours),
          attendanceDeductions,
          leaveDeductions,
          attendanceDays,
          // Raw absences plus leave days that were never approved.
          absentDays: totalAbsentDays,
          halfDays,
          leaveDays,
          grossSalary,
          tax: 0,
          pf: 0,
          esi: 0,
          otherDeductions: 0,
          totalDeductions,
          netSalary,
          status: isPaidMonth ? PayrollStatus.PAID : PayrollStatus.PENDING,
          isApproved: isPaidMonth,
          approvedAt: isPaidMonth ? settlementDate : null,
          approvedByUserId: isPaidMonth ? adminUserId : null,
          paymentDate: isPaidMonth ? settlementDate : null,
        }),
      );
    }
  }
  console.log(
    '[seed:demo] Payroll created for Sep (PAID), Oct (PAID) and Nov (PENDING)',
  );

  // ---- credentials summary ----
  console.log('\n================ DEMO LOGIN CREDENTIALS ================');
  console.log(
    `Password for every demo employee: ${demoPassword.password}` +
      (demoPassword.generated ? '  (randomly generated)' : '  (from DEMO_EMPLOYEE_PASSWORD)'),
  );
  console.log('\nEmployee accounts:');
  for (const entry of demoEmployees) {
    console.log(
      `  ${entry.definition.email.padEnd(28)} ${entry.definition.designation}`,
    );
  }
  console.log(
    '\nThe admin, HR, manager and employee accounts already exist with the' +
      '\npasswords set up during the initial database bootstrap.',
  );
  console.log('========================================================\n');

  await dataSource.destroy();
}

main().catch((error) => {
  console.error('Demo seed failed:', error);
  process.exit(1);
});
