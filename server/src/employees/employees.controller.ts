import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';

import { EmployeesService } from './employees.service';

import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';

import { FileInterceptor } from '@nestjs/platform-express';

import { profileImageUploadConfig } from './config/profile-image-upload.config';
import { coverImageUploadConfig } from './config/cover-image-upload.config';
import { employeeDocumentUploadConfig } from './config/employee-document-upload.config';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';

@Controller('/employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
  ) {}

  // CREATE EMPLOYEE
  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role === UserRole.EMPLOYEE ||
      currentUser.role === UserRole.MANAGER
    ) {
      return this.employeesService.createMyProfile(
        currentUser.id,
        createEmployeeDto,
      );
    }

    return this.employeesService.create(
      createEmployeeDto,
    );
  }

  // GET ALL EMPLOYEES
  @Get()
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
  )
  async findAll(@CurrentUser() currentUser: AuthenticatedUser) {
    const employees = await this.employeesService.findAll();
    return employees.map((employee) => this.hideSalary(employee, currentUser));
  }

  // HR/ADMIN: document metadata for compliance dashboards (must stay above ':id')
  @Get('documents/overview')
  @Roles(UserRole.ADMIN, UserRole.HR)
  documentsOverview() {
    return this.employeesService.documentsOverview();
  }

  @Get('team')
  @Roles(UserRole.MANAGER)
  findMyTeam(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.employeesService.findMyTeam(currentUser.id);
  }

  // GET CURRENT LOGGED-IN EMPLOYEE PROFILE
  @Get('profile')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  getMyProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeesService.findMyProfile(
      currentUser.id,
    );
  }

  @Patch('profile')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  updateMyProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() updateMyProfileDto: UpdateMyProfileDto,
  ) {
    return this.employeesService.updateMyProfile(currentUser.id, updateMyProfileDto);
  }

  @Post('profile/cover-image')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  @UseInterceptors(FileInterceptor('file', coverImageUploadConfig))
  uploadMyCoverImage(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employeesService.updateMyCoverImage(currentUser.id, file);
  }

  @Delete('profile/cover-image')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  removeMyCoverImage(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.employeesService.removeMyCoverImage(currentUser.id);
  }

  @Post('profile/documents')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  @UseInterceptors(FileInterceptor('file', employeeDocumentUploadConfig))
  uploadMyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() documentDto: CreateEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employeesService.addMyDocument(currentUser.id, documentDto, file);
  }

  // HR/ADMIN: attach an ID proof (Aadhaar/PAN) to a specific employee.
  @Post(':id/documents')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @UseInterceptors(FileInterceptor('file', employeeDocumentUploadConfig))
  uploadEmployeeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() documentDto: CreateEmployeeDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.employeesService.addEmployeeDocument(id, documentDto, file);
  }

  @Get(':id/documents/:documentId/file')
  @Roles(UserRole.ADMIN, UserRole.HR)
  async downloadEmployeeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const file = await this.employeesService.getEmployeeDocumentFile(id, documentId);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType || 'application/octet-stream',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
    });
  }

  @Delete('profile/documents/:documentId')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  removeMyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.employeesService.removeMyDocument(currentUser.id, documentId);
  }

  @Get('profile/documents/:documentId/file')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE)
  async downloadMyDocument(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    const file = await this.employeesService.getMyDocumentFile(currentUser.id, documentId);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType || 'application/octet-stream',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFileName)}`,
    });
  }

  @Post(':id/profile-image')
@UseInterceptors(
  FileInterceptor(
    'file',
    profileImageUploadConfig,
  ),
)
async uploadProfileImage(
  @Param('id', ParseIntPipe) id: number,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.employeesService.updateProfileImage(
    id,
    file,
  );
}


  // Store a consented face template; raw camera frames are not uploaded or stored.
  @Post(':id/face-enrollment')
  @Roles(UserRole.ADMIN, UserRole.HR)
  enrollFace(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { descriptor: number[]; consent: boolean },
  ) {
    return this.employeesService.enrollFace(id, body?.descriptor, body?.consent);
  }

  @Delete(':id/face-enrollment')
  @Roles(UserRole.ADMIN, UserRole.HR)
  removeFaceEnrollment(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.removeFaceEnrollment(id);
  }

  // Return the private QR credential only to HR/Admin for printing.
  @Get(':id/attendance-qr')
  @Roles(UserRole.ADMIN, UserRole.HR)
  getAttendanceQr(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getAttendanceQr(id);
  }

  // GET EMPLOYEE BY ID
  @Get(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.hideSalary(await this.employeesService.findOne(id), currentUser);
  }

  // UPDATE EMPLOYEE
  @Patch(':id')
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      id,
      updateEmployeeDto,
    );
  }

  // DELETE EMPLOYEE
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.employeesService.remove(id);
  }

  /** Salary is payroll data: only Admin and HR may see it on employee records. */
  private hideSalary<T extends { salary?: number }>(employee: T, currentUser: AuthenticatedUser): T {
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.HR) return employee;
    const { salary, ...safe } = employee as T & { salary?: number };
    return safe as T;
  }
}
