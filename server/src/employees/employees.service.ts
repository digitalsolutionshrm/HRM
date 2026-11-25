import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';

import { EmployeePersonalDetails } from './entities/employee-personal-details.entity';
import { EmployeeAddress } from './entities/employee-address.entity';
import { EmployeeDocument } from './entities/employee-document.entity';

import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthSession } from '../auth/entities/auth-session.entity';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { EmployeeRole } from '../roles/entities/employee-role.entity';

@Injectable()
export class EmployeesService {
 constructor(
  @InjectRepository(Employee)
  private readonly employeesRepository: Repository<Employee>,

  @InjectRepository(User)
  private readonly usersRepository: Repository<User>,

  @InjectRepository(Department)
  private readonly departmentsRepository: Repository<Department>,

  @InjectRepository(EmployeeRole)
  private readonly employeeRolesRepository: Repository<EmployeeRole>,

  @InjectRepository(EmployeePersonalDetails)
  private readonly personalDetailsRepository:
    Repository<EmployeePersonalDetails>,

  @InjectRepository(EmployeeAddress)
  private readonly addressesRepository:
    Repository<EmployeeAddress>,

  @InjectRepository(EmployeeDocument)
  private readonly documentsRepository:
    Repository<EmployeeDocument>,

  @InjectRepository(AuthSession)
  private readonly authSessionsRepository: Repository<AuthSession>,

  private readonly notificationService: NotificationService,
) {}

  private async notifyActiveStaff(title: string, message: string) {
    const users = await this.usersRepository.find({ where: { status: true } });
    const staff = users.filter(user => user.role === UserRole.EMPLOYEE || user.role === UserRole.MANAGER);
    const results = await Promise.allSettled(staff.map(user => this.notificationService.createInAppNotification({
      userId: user.id,
      email: user.email,
      title,
      message,
      type: NotificationType.SYSTEM,
    })));
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) console.error(`Could not create ${failed} staff notification(s).`);
  }

  /**
   * Maps an employee designation to a login role.
   * "HR", "HR Manager" or "Human Resources" get HR access, other managers get
   * Manager, and everyone else becomes an Employee.
   */
  private roleFromDesignation(designation?: string | null): UserRole {
    const value = designation ?? '';
    if (/\bhr\b/i.test(value) || /\bhuman\s+resources?\b/i.test(value)) {
      return UserRole.HR;
    }
    if (/\bmanager\b/i.test(value)) return UserRole.MANAGER;
    return UserRole.EMPLOYEE;
  }

  // Generate employee code
  private async generateEmployeeCode(): Promise<string> {
    const employees = await this.employeesRepository.find({
      order: {
        id: 'DESC',
      },
      take: 1,
    });

    const lastEmployee = employees[0];

    const nextNumber = lastEmployee
      ? lastEmployee.id + 1
      : 1;

    return `EMP-${String(nextNumber).padStart(4, '0')}`;
  }

  // CREATE EMPLOYEE
  async create(createEmployeeDto: CreateEmployeeDto) {
    const {
      officeEmail,
      personalEmail,
      password,
      employeeCode: requestedEmployeeCode,
      roleId,
      departmentId,
      departmentName,
      firstName,
      lastName,
      phone,
      designation,
      joiningDate,
      salary,
      profileImage,
      countryCode,
      performance,
      managerId,
      dateOfBirth,
      address,
      country,
      status,
    } = createEmployeeDto;

    if (!officeEmail || !password) {
      throw new BadRequestException('Office email and password are required to create an employee account');
    }

    const employeeCode = requestedEmployeeCode?.trim();
    if (!employeeCode) {
      throw new BadRequestException('Employee ID is required');
    }
    const existingEmployeeCode = await this.employeesRepository.findOne({
      where: { employeeCode },
    });
    if (existingEmployeeCode) {
      throw new ConflictException('Employee ID already exists');
    }

    const existingUser = await this.usersRepository.findOne({ where: { email: officeEmail.toLowerCase() } });
    if (existingUser) throw new ConflictException('Office email already exists');

    const employeeRole = roleId !== undefined
      ? await this.employeeRolesRepository.findOne({ where: { id: roleId } })
      : designation?.trim()
        ? await this.employeeRolesRepository
          .createQueryBuilder('role')
          .where('LOWER(role.name) = LOWER(:name)', { name: designation.trim() })
          .getOne()
        : null;
    if (!employeeRole) {
      throw new BadRequestException('Select a valid employee role');
    }
    if (!employeeRole.status) {
      throw new BadRequestException('Inactive roles cannot be assigned to new employees');
    }

    // Check Department
    let department: Department | undefined;

    if (departmentId !== undefined) {
      const foundDepartment =
        await this.departmentsRepository.findOne({
          where: {
            id: departmentId,
          },
        });

      if (!foundDepartment) {
        throw new NotFoundException(
          'Department not found',
        );
      }

      department = foundDepartment;
    } else if (departmentName?.trim()) {
      const normalizedName = departmentName.trim();
      department = await this.departmentsRepository.findOne({ where: { name: normalizedName } }) ?? undefined;
      if (!department) {
        department = await this.departmentsRepository.save(this.departmentsRepository.create({ name: normalizedName, status: true }));
      }
    }

    let manager: Employee | undefined;
    if (managerId !== undefined) {
      manager = await this.employeesRepository.findOne({ where: { id: managerId } }) ?? undefined;
      if (!manager) throw new NotFoundException('Manager not found');
    }

    // Account, profile, personal details, address and QR credential are created together.
    const queryRunner = this.employeesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let createdEmployeeId = 0;
    try {
      const user = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
        name: `${firstName} ${lastName}`.trim(),
        email: officeEmail.toLowerCase(),
        password: await bcrypt.hash(password, 10),
        role: this.roleFromDesignation(employeeRole.name),
        status: true,
        emailVerified: false,
        emailVerifiedAt: null,
      }));
      const employee = queryRunner.manager.create(Employee, {
        employeeCode,
        attendanceQrToken: randomBytes(32).toString('hex'),
        firstName,
        lastName,
        phone,
        designation: employeeRole.name,
        jobRole: employeeRole,
        profileImage,
        phoneCountryCode: countryCode,
        performance,
        joiningDate: joiningDate
          ? new Date(joiningDate)
          : undefined,
        salary,
        status: status ?? true,
        user,
        department,
        manager,
      });
      const savedEmployee = await queryRunner.manager.save(employee);
      const personalDetails = createEmployeeDto.personalDetails ?? {};
      await queryRunner.manager.save(EmployeePersonalDetails, queryRunner.manager.create(EmployeePersonalDetails, {
        ...personalDetails,
        personalEmail: personalEmail || personalDetails.personalEmail,
        dateOfBirth: dateOfBirth || personalDetails.dateOfBirth,
        employee: savedEmployee,
      }));
      if (!createEmployeeDto.addresses?.length && (address || country)) {
        await queryRunner.manager.save(EmployeeAddress, queryRunner.manager.create(EmployeeAddress, {
          addressType: 'CURRENT', addressLine1: address, country, isPrimary: true, employee: savedEmployee,
        }));
      }
      if (createEmployeeDto.addresses?.length) {
        const addresses = createEmployeeDto.addresses.map((item) => queryRunner.manager.create(EmployeeAddress, { ...item, employee: savedEmployee }));
        await queryRunner.manager.save(EmployeeAddress, addresses);
      }
      await queryRunner.commitTransaction();
      createdEmployeeId = savedEmployee.id;
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    const createdEmployee = await this.findOne(createdEmployeeId);
    const name = `${createdEmployee.firstName} ${createdEmployee.lastName}`.trim();
    const position = createdEmployee.designation || 'Employee';
    const team = createdEmployee.department?.name ? ` in ${createdEmployee.department.name}` : '';
    try {
      await this.notifyActiveStaff('New team member', `${name} has joined the company as ${position}${team}. Please welcome them to the team.`);
    } catch (notificationError) {
      console.error('Employee was created, but staff notifications could not be sent.', notificationError);
    }
    return createdEmployee;
  }

  async createMyProfile(userId: number, dto: CreateEmployeeDto) {
    if (!dto.firstName.trim() || !dto.lastName.trim()) {
      throw new BadRequestException('First name and last name are required');
    }

    await this.employeesRepository.manager.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const employees = manager.getRepository(Employee);
      const user = await users.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      const existing = await employees.findOne({
        where: { user: { id: userId } },
      });
      const employee = existing ?? employees.create({
        employeeCode: await this.generateEmployeeCode(),
        status: true,
        user,
      });
      employee.firstName = dto.firstName.trim();
      employee.lastName = dto.lastName.trim();
      employee.phone = dto.phone;
      employee.phoneCountryCode = dto.countryCode;
      const savedEmployee = await employees.save(employee);

      const detailsRepository = manager.getRepository(EmployeePersonalDetails);
      const oldDetails = await detailsRepository.findOne({
        where: { employee: { id: savedEmployee.id } },
      });
      const details = dto.personalDetails ?? {};
      await detailsRepository.save(detailsRepository.create({
        ...(oldDetails ?? {}),
        ...details,
        personalEmail: dto.personalEmail ?? details.personalEmail ?? oldDetails?.personalEmail,
        dateOfBirth: dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : details.dateOfBirth
            ? new Date(details.dateOfBirth)
            : oldDetails?.dateOfBirth,
        employee: savedEmployee,
      }));

      const addresses = dto.addresses?.length
        ? dto.addresses
        : dto.address || dto.country
          ? [{ addressType: 'CURRENT', addressLine1: dto.address, country: dto.country, isPrimary: true }]
          : [];
      if (addresses.length) {
        const addressRepository = manager.getRepository(EmployeeAddress);
        const existingAddress = await addressRepository.findOne({
          where: { employee: { id: savedEmployee.id }, isPrimary: true },
        });
        const firstAddress = addresses[0];
        await addressRepository.save(addressRepository.create({
          ...(existingAddress ?? {}),
          ...firstAddress,
          employee: savedEmployee,
          isPrimary: true,
        }));
      }

      user.name = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
      await users.save(user);
    });

    return this.findMyProfile(userId);
  }

  // GET ALL EMPLOYEES
  async findAll() {
    return this.employeesRepository.find({
      relations: {
        user: true,
        department: true,
        jobRole: true,
        personalDetails: true,
        addresses: true,
        manager: { department: true },
      },
      order: {
        id: 'DESC',
      },
    });
    
  }

  /**
   * HR/Admin compliance overview: document metadata only.
   * File paths and document numbers (e.g. Aadhaar/PAN) are deliberately not returned.
   */
  async documentsOverview() {
    const documents = await this.documentsRepository.find({
      relations: { employee: true },
      order: { expiryDate: 'ASC' },
    });
    return documents.map((document) => ({
      id: document.id,
      employeeId: document.employee?.id,
      employeeCode: document.employee?.employeeCode,
      employeeName: `${document.employee?.firstName ?? ''} ${document.employee?.lastName ?? ''}`.trim(),
      documentType: document.documentType,
      documentName: document.documentName,
      issueDate: document.issueDate ?? null,
      expiryDate: document.expiryDate ?? null,
      status: document.status,
    }));
  }

  async findMyTeam(userId: number) {
    const manager = await this.employeesRepository
      .createQueryBuilder('manager')
      .innerJoin('manager.user', 'managerUser')
      .where('managerUser.id = :userId', { userId })
      .select(['manager.id'])
      .getOne();
    if (!manager) throw new NotFoundException('Manager profile not found');

    return this.employeesRepository
      .createQueryBuilder('employee')
      .leftJoin('employee.user', 'user')
      .leftJoin('employee.department', 'department')
      .where('employee.manager_id = :managerId', { managerId: manager.id })
      .andWhere('employee.status = true')
      .andWhere('user.status = true')
      .select([
        'employee.id', 'employee.employeeCode', 'employee.firstName',
        'employee.lastName', 'employee.designation', 'employee.joiningDate',
        'employee.phone', 'employee.status', 'employee.profileImage',
        'department.id', 'department.name', 'user.id', 'user.email',
      ])
      .orderBy('employee.firstName', 'ASC')
      .addOrderBy('employee.lastName', 'ASC')
      .getMany();
  }

  async findMyProfile(userId: number) {
    const employee = await this.employeesRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.department', 'department')
      .leftJoinAndSelect('employee.personalDetails', 'personalDetails')
      .leftJoinAndSelect('employee.addresses', 'addresses')
      .leftJoinAndSelect('employee.documents', 'documents')
      .leftJoin('employee.manager', 'manager')
      .addSelect([
        'manager.id',
        'manager.firstName',
        'manager.lastName',
        'manager.designation',
      ])
      .where('user.id = :userId', { userId })
      .getOne();

  if (!employee) {
    throw new NotFoundException(
      'Employee profile not found',
    );
  }

  return employee;
}

  async updateMyProfile(userId: number, dto: UpdateMyProfileDto) {
    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const { dateOfBirth, ...detailsFields } = dto;
    const existingDetails = await this.personalDetailsRepository.findOne({
      where: { employee: { id: employee.id } },
    });
    const details = this.personalDetailsRepository.create({
      ...(existingDetails ?? {}),
      ...detailsFields,
      employee,
      ...(dateOfBirth !== undefined
        ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }
        : {}),
    });
    await this.personalDetailsRepository.save(details);

    const addressFields = {
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
    };
    const existingAddress = await this.addressesRepository.findOne({
      where: { employee: { id: employee.id }, isPrimary: true },
    });
    await this.addressesRepository.save(this.addressesRepository.create({
      ...(existingAddress ?? {}),
      ...Object.fromEntries(Object.entries(addressFields).filter(([, value]) => value !== undefined)),
      addressType: existingAddress?.addressType ?? 'CURRENT',
      isPrimary: true,
      employee,
    }));

    return this.findMyProfile(userId);
  }

  async addMyDocument(
    userId: number,
    dto: CreateEmployeeDocumentDto,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A document file is required');
    if (!dto.documentType?.trim()) throw new BadRequestException('Document type is required');
    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const document = this.documentsRepository.create({
      employee,
      documentType: dto.documentType.trim(),
      documentName: dto.documentName?.trim() || file.originalname,
      filePath: `private-uploads/employee-documents/${file.filename}`,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentNumber: dto.documentNumber?.trim() || undefined,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    });
    return this.documentsRepository.save(document);
  }

  async removeMyDocument(userId: number, documentId: number) {
    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, employee: { id: employee.id } },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.documentsRepository.remove(document);
    const filePath = join(process.cwd(), 'private-uploads', 'employee-documents', basename(document.filePath));
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return { message: 'Document deleted successfully' };
  }

  async getMyDocumentFile(userId: number, documentId: number) {
    const employee = await this.employeesRepository.findOne({ where: { user: { id: userId } } });
    if (!employee) throw new NotFoundException('Employee profile not found');
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, employee: { id: employee.id } },
    });
    if (!document) throw new NotFoundException('Document not found');
    return {
      path: join(process.cwd(), 'private-uploads', 'employee-documents', basename(document.filePath)),
      mimeType: document.mimeType,
      originalFileName: document.originalFileName || document.documentName,
    };
  }

  /** HR/Admin: attach an ID proof (Aadhaar/PAN) or other document to any employee. */
  async addEmployeeDocument(
    employeeId: number,
    dto: CreateEmployeeDocumentDto,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A document file is required');
    if (!dto.documentType?.trim()) throw new BadRequestException('Document type is required');
    const employee = await this.employeesRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const document = this.documentsRepository.create({
      employee,
      documentType: dto.documentType.trim(),
      documentName: dto.documentName?.trim() || file.originalname,
      filePath: `private-uploads/employee-documents/${file.filename}`,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      documentNumber: dto.documentNumber?.trim() || undefined,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    });
    return this.documentsRepository.save(document);
  }

  /** HR/Admin: download a document of a specific employee. */
  async getEmployeeDocumentFile(employeeId: number, documentId: number) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, employee: { id: employeeId } },
    });
    if (!document) throw new NotFoundException('Document not found');
    return {
      path: join(process.cwd(), 'private-uploads', 'employee-documents', basename(document.filePath)),
      mimeType: document.mimeType,
      originalFileName: document.originalFileName || document.documentName,
    };
  }
  // GET ONE EMPLOYEE
  async findOne(id: number) {
    const employee =
      await this.employeesRepository.findOne({
        where: {
          id,
        },
        relations: {
          user: true,
          department: true,
          jobRole: true,
          personalDetails: true,
          addresses: true,
          documents: true,
        },
      });

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${id} not found`,
      );
    }

    return employee;
  }

  // UPDATE EMPLOYEE
  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
  ) {
    const employee = await this.findOne(id);

    const { departmentId, departmentName, roleId, managerId, clearManager, officeEmail, password, personalEmail, personalDetails, addresses, dateOfBirth, address, country, countryCode, performance, status, designation, ...profile } = updateEmployeeDto;
    const user = employee.user;

    if (profile.employeeCode !== undefined) {
      const employeeCode = profile.employeeCode.trim();
      if (!employeeCode) {
        throw new BadRequestException('Employee ID is required');
      }

      if (employeeCode !== employee.employeeCode) {
        const duplicate = await this.employeesRepository.findOne({
          where: { employeeCode },
        });
        if (duplicate) {
          throw new ConflictException('Employee ID already exists');
        }
      }

      employee.employeeCode = employeeCode;
    }

    if (officeEmail && officeEmail.toLowerCase() !== user.email.toLowerCase()) {
      const duplicate = await this.usersRepository.findOne({ where: { email: officeEmail.toLowerCase() } });
      if (duplicate) throw new ConflictException('Office email already exists');
      user.email = officeEmail.toLowerCase();
      user.emailVerified = false;
      user.emailVerifiedAt = null;
    }
    if (password) user.password = await bcrypt.hash(password, 10);
    if (profile.firstName !== undefined) employee.firstName = profile.firstName;
    if (profile.lastName !== undefined) employee.lastName = profile.lastName;
    user.name = `${employee.firstName} ${employee.lastName}`.trim();
    if (profile.phone !== undefined) employee.phone = profile.phone;
    if (roleId !== undefined || designation !== undefined) {
      const selectedRole = roleId !== undefined
        ? await this.employeeRolesRepository.findOne({ where: { id: roleId } })
        : await this.employeeRolesRepository
          .createQueryBuilder('role')
          .where('LOWER(role.name) = LOWER(:name)', { name: designation!.trim() })
          .getOne();
      if (!selectedRole) throw new NotFoundException('Employee role not found');
      if (!selectedRole.status && selectedRole.id !== employee.jobRole?.id) {
        throw new BadRequestException('Inactive roles cannot be assigned to employees');
      }
      employee.jobRole = selectedRole;
      employee.designation = selectedRole.name;
      user.role = this.roleFromDesignation(selectedRole.name);
    }
    if (profile.joiningDate !== undefined) employee.joiningDate = new Date(profile.joiningDate);
    if (profile.salary !== undefined) employee.salary = profile.salary;
    if (profile.profileImage !== undefined) employee.profileImage = profile.profileImage;
    if (countryCode !== undefined) employee.phoneCountryCode = countryCode;
    if (performance !== undefined) employee.performance = performance;
    if (status !== undefined) employee.status = status;

    if (departmentId !== undefined) {
      const department = await this.departmentsRepository.findOne({ where: { id: departmentId } });
      if (!department) throw new NotFoundException('Department not found');
      employee.department = department;
    } else if (departmentName?.trim()) {
      const name = departmentName.trim();
      employee.department = await this.departmentsRepository.findOne({ where: { name } })
        ?? await this.departmentsRepository.save(this.departmentsRepository.create({ name, status: true }));
    }

    if (clearManager) employee.manager = null;
    else if (managerId !== undefined) {
      if (managerId === id) throw new BadRequestException('An employee cannot be their own manager');
      const manager = await this.employeesRepository.findOne({ where: { id: managerId } });
      if (!manager) throw new NotFoundException('Manager not found');
      employee.manager = manager;
    }

    await this.usersRepository.save(user);
    await this.employeesRepository.save(employee);
    if (dateOfBirth !== undefined || personalEmail !== undefined || personalDetails !== undefined) {
      const existing = await this.personalDetailsRepository.findOne({ where: { employee: { id } } });
      const details = this.personalDetailsRepository.create({
        ...(existing ?? {}), ...(personalDetails ?? {}),
        ...(personalEmail !== undefined ? { personalEmail } : {}),
        ...(dateOfBirth !== undefined ? { dateOfBirth: new Date(dateOfBirth) } : {}), employee,
      });
      await this.personalDetailsRepository.save(details);
    }
    if (addresses !== undefined) {
      const existing = await this.addressesRepository.find({ where: { employee: { id } } });
      if (existing.length) await this.addressesRepository.remove(existing);
      if (addresses.length) await this.addressesRepository.save(addresses.map((item) => this.addressesRepository.create({ ...item, employee })));
    } else if (address !== undefined || country !== undefined) {
      const existing = await this.addressesRepository.findOne({ where: { employee: { id }, isPrimary: true } });
      const primary = this.addressesRepository.create({ ...(existing ?? {}), addressType: existing?.addressType ?? 'CURRENT', employee, ...(address !== undefined ? { addressLine1: address } : {}), ...(country !== undefined ? { country } : {}) });
      await this.addressesRepository.save(primary);
    }
    return this.findOne(id);
  }


  private biometricKey(): Buffer {
    const value = process.env.BIOMETRIC_ENCRYPTION_KEY;
    if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new BadRequestException('Server biometric encryption is not configured. Set BIOMETRIC_ENCRYPTION_KEY to 64 hex characters.');
    }
    return Buffer.from(value, 'hex');
  }

  private encryptFaceDescriptor(descriptor: number[]): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.biometricKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(descriptor), 'utf8'), cipher.final()]);
    return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
  }

  decryptFaceDescriptor(value: string): number[] {
    try {
      const [ivHex, tagHex, dataHex] = value.split(':');
      const decipher = createDecipheriv('aes-256-gcm', this.biometricKey(), Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      const raw = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
      const descriptor = JSON.parse(raw);
      if (!Array.isArray(descriptor) || descriptor.length !== 128 || descriptor.some((n) => !Number.isFinite(n))) throw new Error('invalid template');
      return descriptor;
    } catch {
      throw new BadRequestException('Stored face template is invalid or cannot be decrypted.');
    }
  }

  async enrollFace(employeeId: number, descriptor: number[], consent: boolean) {
    if (consent !== true) throw new BadRequestException('Employee consent is required before face enrollment.');
    if (!Array.isArray(descriptor) || descriptor.length !== 128 || descriptor.some((n) => !Number.isFinite(n) || n < -10 || n > 10)) {
      throw new BadRequestException('A valid 128-value face descriptor is required.');
    }
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    employee.faceDescriptorEncrypted = this.encryptFaceDescriptor(descriptor);
    employee.faceConsentAt = new Date();
    await this.employeesRepository.save(employee);
    return { message: 'Face enrollment saved securely.', employeeId, enrolledAt: employee.faceConsentAt };
  }

  async removeFaceEnrollment(employeeId: number) {
    const employee = await this.employeesRepository.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    employee.faceDescriptorEncrypted = null;
    employee.faceConsentAt = null;
    await this.employeesRepository.save(employee);
    return { message: 'Face enrollment and consent record removed.', employeeId };
  }

  async getAttendanceQr(employeeId: number) {
    const employee = await this.employeesRepository
      .createQueryBuilder('employee')
      .addSelect('employee.attendanceQrToken')
      .leftJoinAndSelect('employee.user', 'user')
      .where('employee.id = :employeeId', { employeeId })
      .getOne();

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.attendanceQrToken) {
      employee.attendanceQrToken = randomBytes(32).toString('hex');
      await this.employeesRepository.save(employee);
    }

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      qrToken: employee.attendanceQrToken,
    };
  }

  async updateProfileImage(
  employeeId: number,
  file: Express.Multer.File,
) {
  if (!file) {
    throw new BadRequestException(
      'Profile image is required',
    );
  }

  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestException('The uploaded profile image could not be read');
  }

  const employee = await this.findOne(employeeId);

  const imageToken = randomUUID();
  employee.profileImage = `/api/media/profile-images/${employeeId}/${imageToken}`;
  employee.profileImageData = file.buffer;
  employee.profileImageMimeType = file.mimetype;

  const updatedEmployee =
    await this.employeesRepository.save(employee);

  return {
    message: 'Profile image uploaded successfully',
    profileImage: updatedEmployee.profileImage,
  };
}

  async getProfileImageData(employeeId: number, imageToken: string) {
    const employee = await this.employeesRepository
      .createQueryBuilder('employee')
      .addSelect([
        'employee.profileImageData',
        'employee.profileImageMimeType',
      ])
      .where('employee.id = :employeeId', { employeeId })
      .getOne();

    if (
      !employee?.profileImageData ||
      !employee.profileImageMimeType ||
      employee.profileImage !== `/api/media/profile-images/${employeeId}/${imageToken}`
    ) {
      throw new NotFoundException('Profile image not found');
    }

    return {
      buffer: employee.profileImageData,
      mimeType: employee.profileImageMimeType,
    };
  }

  async updateMyCoverImage(userId: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A cover photo is required');
    }

    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const previousCoverImage = employee.coverImage;
    employee.coverImage = `/uploads/cover-images/${file.filename}`;
    const updatedEmployee = await this.employeesRepository.save(employee);
    await this.removeStoredCoverImage(previousCoverImage);

    return {
      message: 'Cover photo uploaded successfully',
      coverImage: updatedEmployee.coverImage,
    };
  }

  async removeMyCoverImage(userId: number) {
    const employee = await this.employeesRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!employee) throw new NotFoundException('Employee profile not found');

    const previousCoverImage = employee.coverImage;
    employee.coverImage = null;
    await this.employeesRepository.save(employee);
    await this.removeStoredCoverImage(previousCoverImage);

    return { message: 'Cover photo deleted successfully' };
  }

  private async removeStoredCoverImage(imagePath?: string | null) {
    if (!imagePath?.startsWith('/uploads/cover-images/')) return;

    const fileName = basename(imagePath);
    if (!/^cover-[a-f0-9-]+\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) return;

    try {
      await unlink(join(process.cwd(), 'uploads', 'cover-images', fileName));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      console.warn('Could not remove a replaced cover photo file:', error);
    }
  }

  // DELETE EMPLOYEE
  async remove(id: number) {
    const employee = await this.findOne(id);
    const userId = employee.user.id;
    const queryRunner = this.employeesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(AuthSession, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      // Remove the employee profile first: payroll, leaves, DSR and documents
      // cascade with it, and it frees the user_id foreign key.
      await queryRunner.manager.remove(Employee, employee);
      // Then remove the linked login account so the user record is gone too.
      await queryRunner.manager.delete(User, userId);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
    const name = `${employee.firstName} ${employee.lastName}`.trim();
    const position = employee.designation || 'Employee';
    const team = employee.department?.name ? ` in ${employee.department.name}` : '';
    try {
      await this.notifyActiveStaff('Team member departure', `${name} has left the company. Their position was ${position}${team}. Their profile and login account were removed.`);
    } catch (notificationError) {
      console.error('Employee was deleted, but staff notifications could not be sent.', notificationError);
    }

    return {
      message: 'Employee profile and login account deleted successfully',
    };
  }
}
