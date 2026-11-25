import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentsRepository: Repository<Department>,
  ) {}

  // CREATE
  async create(createDepartmentDto: CreateDepartmentDto) {
    const existing =
      await this.departmentsRepository.findOne({
        where: {
          name: createDepartmentDto.name,
        },
      });

    if (existing) {
      throw new ConflictException(
        'Department already exists',
      );
    }

    const department =
      this.departmentsRepository.create({
        name: createDepartmentDto.name,
        description: createDepartmentDto.description,
        status: createDepartmentDto.status ?? true,
      });

    return this.departmentsRepository.save(department);
  }

  // GET ALL
  async findAll() {
    const departments = await this.departmentsRepository.find({
      order: { id: 'DESC' },
    });

    const counts = await this.departmentsRepository
      .createQueryBuilder('department')
      .leftJoin('department.employees', 'employee')
      .select('department.id', 'departmentId')
      .addSelect('COUNT(employee.id)', 'employeeCount')
      .groupBy('department.id')
      .getRawMany<{ departmentId: number; employeeCount: string }>();

    const countByDepartment = new Map(
      counts.map((row) => [Number(row.departmentId), Number(row.employeeCount)]),
    );

    return departments.map((department) => {
      department.employeeCount = countByDepartment.get(department.id) ?? 0;
      return department;
    });
  }

  // GET ONE
  async findOne(id: number) {
    const department =
      await this.departmentsRepository.findOne({
        where: {
          id,
        },
      });

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${id} not found`,
      );
    }

    return department;
  }

  // UPDATE
  async update(
    id: number,
    updateDepartmentDto: UpdateDepartmentDto,
  ) {
    const department = await this.findOne(id);

    if (
      updateDepartmentDto.name &&
      updateDepartmentDto.name !== department.name
    ) {
      const existing =
        await this.departmentsRepository.findOne({
          where: {
            name: updateDepartmentDto.name,
          },
        });

      if (existing) {
        throw new ConflictException(
          'Department already exists',
        );
      }
    }

    Object.assign(
      department,
      updateDepartmentDto,
    );

    return this.departmentsRepository.save(
      department,
    );
  }

  // DELETE
  async remove(id: number) {
    const department = await this.findOne(id);

    await this.departmentsRepository.remove(
      department,
    );

    return {
      message: 'Department deleted successfully',
    };
  }
}