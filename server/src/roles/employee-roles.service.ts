import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Employee } from '../employees/entities/employee.entity';
import { CreateEmployeeRoleDto } from './dto/create-employee-role.dto';
import { UpdateEmployeeRoleDto } from './dto/update-employee-role.dto';
import { EmployeeRole } from './entities/employee-role.entity';

@Injectable()
export class EmployeeRolesService {
  constructor(
    @InjectRepository(EmployeeRole)
    private readonly rolesRepository: Repository<EmployeeRole>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
  ) {}

  async create(dto: CreateEmployeeRoleDto) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Role name must be at least 2 characters');
    const existing = await this.rolesRepository
      .createQueryBuilder('role')
      .where('LOWER(role.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) throw new ConflictException('Role already exists');

    return this.rolesRepository.save(
      this.rolesRepository.create({
        ...dto,
        name,
        description: dto.description?.trim() || null,
        status: dto.status ?? true,
      }),
    );
  }

  async findAll() {
    const roles = await this.rolesRepository.find({ order: { id: 'DESC' } });
    const counts = await this.employeesRepository
      .createQueryBuilder('employee')
      .leftJoin('employee.jobRole', 'role')
      .select('role.id', 'roleId')
      .addSelect('COUNT(employee.id)', 'employeeCount')
      .where('role.id IS NOT NULL')
      .groupBy('role.id')
      .getRawMany<{ roleId: number; employeeCount: string }>();
    const countByRole = new Map(
      counts.map((row) => [Number(row.roleId), Number(row.employeeCount)]),
    );

    return roles.map((role) => ({
      ...role,
      employeeCount: countByRole.get(role.id) ?? 0,
    }));
  }

  async findOne(id: number) {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException(`Role with ID ${id} not found`);
    return role;
  }

  async update(id: number, dto: UpdateEmployeeRoleDto) {
    const role = await this.findOne(id);
    const previousName = role.name;
    const name = dto.name?.trim();
    if (dto.name !== undefined && (name?.length ?? 0) < 2) {
      throw new BadRequestException('Role name must be at least 2 characters');
    }
    if (name && name.toLowerCase() !== previousName.toLowerCase()) {
      const existing = await this.rolesRepository
        .createQueryBuilder('role')
        .where('LOWER(role.name) = LOWER(:name)', { name })
        .andWhere('role.id != :id', { id })
        .getOne();
      if (existing) throw new ConflictException('Role already exists');
    }

    Object.assign(role, dto, {
      ...(name ? { name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
    });
    const saved = await this.rolesRepository.save(role);
    if (name && name !== previousName) {
      await this.employeesRepository
        .createQueryBuilder()
        .update(Employee)
        .set({ designation: name })
        .where('"role_id" = :id', { id })
        .execute();
    }
    return saved;
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    const employeeCount = await this.employeesRepository.count({
      where: { jobRole: { id } },
    });
    if (employeeCount > 0) {
      throw new ConflictException(
        'This role is assigned to employees and cannot be deleted',
      );
    }

    await this.rolesRepository.remove(role);
    return { message: 'Role deleted successfully' };
  }
}
