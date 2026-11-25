import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { EmployeePersonalDetails } from './entities/employee-personal-details.entity';
import { EmployeeAddress } from './entities/employee-address.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { EmployeeRole } from '../roles/entities/employee-role.entity';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { NotificationService } from '../notifications/notifications.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let employeeRepository: { findOne: jest.Mock; save: jest.Mock };
  let userRepository: { save: jest.Mock };

  beforeEach(async () => {
    employeeRepository = { findOne: jest.fn(), save: jest.fn() };
    userRepository = { save: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        ...[
          Employee,
          User,
          Department,
          EmployeeRole,
          EmployeePersonalDetails,
          EmployeeAddress,
          EmployeeDocument,
          AuthSession,
        ].map(entity => ({
          provide: getRepositoryToken(entity),
          useValue:
            entity === Employee
              ? employeeRepository
              : entity === User
                ? userRepository
                : {},
        })),
        { provide: NotificationService, useValue: {} },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('requires an employee ID for HR/admin employee creation', async () => {
    await expect(service.create({
      officeEmail: 'person@example.com',
      password: 'valid-password',
      firstName: 'Test',
      lastName: 'Employee',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates an employee ID and rejects an ID already assigned to someone else', async () => {
    const employee = {
      id: 1,
      employeeCode: 'EMP-001',
      firstName: 'Test',
      lastName: 'Employee',
      user: { email: 'person@example.com', name: 'Test Employee' },
    } as Employee;
    jest.spyOn(service, 'findOne').mockResolvedValue(employee);
    employeeRepository.findOne.mockResolvedValue(null);
    employeeRepository.save.mockResolvedValue(employee);
    userRepository.save.mockResolvedValue(employee.user);

    await service.update(1, { employeeCode: ' EMP-002 ' });

    expect(employee.employeeCode).toBe('EMP-002');

    employee.employeeCode = 'EMP-001';
    employeeRepository.findOne.mockResolvedValue({ id: 2 } as Employee);
    await expect(
      service.update(1, { employeeCode: 'EMP-002' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates the cover photo of the authenticated employee profile', async () => {
    const employee = { id: 1, coverImage: null } as Employee;
    employeeRepository.findOne.mockResolvedValue(employee);
    employeeRepository.save.mockImplementation(async value => value);
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'cover.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 4,
      destination: './uploads/cover-images',
      filename: 'cover-abcd1234.png',
      path: './uploads/cover-images/cover-abcd1234.png',
      buffer: Buffer.from('test'),
    };

    await expect(service.updateMyCoverImage(12, file)).resolves.toEqual({
      message: 'Cover photo uploaded successfully',
      coverImage: '/uploads/cover-images/cover-abcd1234.png',
    });
    expect(employeeRepository.findOne).toHaveBeenCalledWith({
      where: { user: { id: 12 } },
    });
    expect(employee.coverImage).toBe('/uploads/cover-images/cover-abcd1234.png');
  });

  it('removes the cover photo from the authenticated employee profile', async () => {
    const employee = { id: 1, coverImage: null } as Employee;
    employeeRepository.findOne.mockResolvedValue(employee);
    employeeRepository.save.mockImplementation(async value => value);

    await expect(service.removeMyCoverImage(12)).resolves.toEqual({
      message: 'Cover photo deleted successfully',
    });
    expect(employeeRepository.findOne).toHaveBeenCalledWith({
      where: { user: { id: 12 } },
    });
    expect(employee.coverImage).toBeNull();
  });

  it('stores the profile photo data in the database with a cache-busted URL', async () => {
    const employee = { id: 7 } as Employee;
    jest.spyOn(service, 'findOne').mockResolvedValue(employee);
    employeeRepository.save.mockImplementation(async value => value);
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'profile.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 4,
      destination: '',
      filename: '',
      path: '',
      buffer: Buffer.from('test'),
    };

    const result = await service.updateProfileImage(7, file);

    expect(employee.profileImage).toMatch(
      /^\/api\/media\/profile-images\/7\/[0-9a-f-]+$/,
    );
    expect(employee.profileImageData).toEqual(file.buffer);
    expect(employee.profileImageMimeType).toBe('image/png');
    expect(result.profileImage).toBe(employee.profileImage);
  });
});
