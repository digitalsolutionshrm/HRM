import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service';
import { Payroll } from './entities/payroll.entity';
import { PayrollIncrementHistory } from './entities/payroll-increment-history.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Leave } from '../leaves/entities/leave.entity';
import { NotificationService } from '../notifications/notifications.service';

describe('PayrollService', () => {
  let service: PayrollService;

  beforeEach(async () => {
    const employeeRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        salary: 30_000,
        user: { id: 10 },
      }),
    };
    const payrollRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payroll) => payroll),
      save: jest.fn(async (payroll) => payroll),
    };
    const attendanceRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    const leaveRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        {
          provide: getRepositoryToken(Payroll),
          useValue: payrollRepository,
        },
        {
          provide: getRepositoryToken(Employee),
          useValue: employeeRepository,
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: attendanceRepository,
        },
        {
          provide: getRepositoryToken(Leave),
          useValue: leaveRepository,
        },
        {
          provide: getRepositoryToken(PayrollIncrementHistory),
          useValue: {},
        },
        {
          provide: NotificationService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('splits monthly salary into basic, HRA and allowances without deducting tax', async () => {
    const payroll = await service.create({
      employeeId: 1,
      month: 1,
      year: 2026,
    });

    expect(payroll.basicSalary).toBe(12_000);
    expect(payroll.hra).toBe(4_800);
    expect(payroll.bonus).toBe(0);
    expect(payroll.allowances).toBe(13_200);
    expect(payroll.grossSalary).toBe(30_000);
    expect(payroll.tax).toBe(0);
    expect(payroll.pf).toBe(0);
    expect(payroll.esi).toBe(0);
    expect(payroll.attendanceDeductions).toBe(0);
    expect(payroll.leaveDeductions).toBe(0);
    expect(payroll.totalDeductions).toBe(0);
    expect(payroll.netSalary).toBe(30_000);
  });
});
