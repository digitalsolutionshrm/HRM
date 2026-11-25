import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { Employee } from '../employees/entities/employee.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { UserRole } from '../auth/enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // =========================================================
  // CREATE USER
  // =========================================================
  async create(createUserDto: CreateUserDto) {
    const existingUser =
      await this.usersRepository.findOne({
        where: {
          email: createUserDto.email,
        },
      });

    if (existingUser) {
      throw new ConflictException(
        'Email already exists',
      );
    }

    // Hash password before saving
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      10,
    );

    const user = this.usersRepository.create({
      name: createUserDto.name,
      email: createUserDto.email,
      password: hashedPassword,
      role: UserRole.EMPLOYEE,
      // role:
      //   createUserDto.role ??
      //   UserRole.EMPLOYEE,

      status:
        createUserDto.status ??
        true,

      // New users must verify their email
      emailVerified: false,
      emailVerifiedAt: null,
    });

    // Save to PostgreSQL
    const savedUser =
      await this.usersRepository.save(user);

    // Remove password from response
    const {
      password: _password,
      ...result
    } = savedUser;

    return result;
  }

  // =========================================================
  // FIND USER BY EMAIL
  // =========================================================
  async findByEmail(email: string) {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where(
        'user.email = :email',
        { email },
      )
      .getOne();
  }

  // =========================================================
  // GET ALL USERS
  // =========================================================
  async findAll() {
    return this.usersRepository.find({
      order: {
        id: 'DESC',
      },
    });
  }

  // =========================================================
  // GET USER BY ID
  // =========================================================
  async findOne(id: number) {
    const user =
      await this.usersRepository.findOne({
        where: {
          id,
        },
      });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${id} not found`,
      );
    }

    return user;
  }

  async changeOwnPassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException('User account not found.');
    }
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can change a password here.');
    }
    if (!user.status) {
      throw new ForbiddenException('Inactive accounts cannot change their password.');
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Password changed successfully.' };
  }

  // =========================================================
  // UPDATE USER
  // =========================================================
  async update(
    id: number,
    updateUserDto: UpdateUserDto,
  ) {
    const user =
      await this.findOne(id);

    // -------------------------------------------------------
    // Check duplicate email
    // -------------------------------------------------------
    if (
      updateUserDto.email &&
      updateUserDto.email !== user.email
    ) {
      const existingUser =
        await this.usersRepository.findOne({
          where: {
            email: updateUserDto.email,
          },
        });

      if (existingUser) {
        throw new ConflictException(
          'Email already exists',
        );
      }

      // If email changes, require verification again
      user.emailVerified = false;
      user.emailVerifiedAt = null;
    }

    // -------------------------------------------------------
    // Hash password if password is being updated
    // -------------------------------------------------------
    if (updateUserDto.password) {
      updateUserDto.password =
        await bcrypt.hash(
          updateUserDto.password,
          10,
        );
    }

    // -------------------------------------------------------
    // Apply updates
    // -------------------------------------------------------
    Object.assign(
      user,
      updateUserDto,
    );

    const updatedUser =
      await this.usersRepository.save(user);

    // Don't return password
    const {
      password: _password,
      ...result
    } = updatedUser;

    return result;
  }

  // =========================================================
  // DELETE USER
  // =========================================================
  async remove(id: number) {
    // Throws when the user does not exist, so this also validates the id.
    await this.findOne(id);

    const manager =
      this.usersRepository.manager;

    await manager.transaction(
      async (transactionManager) => {
        // A user may still own an employee/manager profile. Removing the
        // profile first keeps the user_id foreign key valid.
        const employee =
          await transactionManager.findOne(
            Employee,
            {
              where: {
                user: { id },
              },
            },
          );

        if (employee) {
          await transactionManager.remove(
            Employee,
            employee,
          );
        }

        await transactionManager.delete(
          User,
          id,
        );
      },
    );

    return {
      message:
        'User deleted successfully',
    };
  }
}
