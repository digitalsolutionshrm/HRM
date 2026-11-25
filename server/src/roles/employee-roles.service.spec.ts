import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeRolesService } from './employee-roles.service';
import { EmployeeRole } from './entities/employee-role.entity';

describe('EmployeeRolesService', () => {
  let service: EmployeeRolesService;
  const rolesRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const employeesRepository = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeRolesService,
        { provide: getRepositoryToken(EmployeeRole), useValue: rolesRepository },
        { provide: getRepositoryToken(Employee), useValue: employeesRepository },
      ],
    }).compile();

    service = module.get<EmployeeRolesService>(EmployeeRolesService);
  });

  it('rejects duplicate role names regardless of letter case', async () => {
    rolesRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 1, name: 'Engineer' }),
    });

    await expect(service.create({ name: 'engineer' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('prevents deleting a role assigned to an employee', async () => {
    rolesRepository.findOne.mockResolvedValue({ id: 3, name: 'Engineer' });
    employeesRepository.count.mockResolvedValue(1);

    await expect(service.remove(3)).rejects.toBeInstanceOf(ConflictException);
    expect(rolesRepository.remove).not.toHaveBeenCalled();
  });
});
