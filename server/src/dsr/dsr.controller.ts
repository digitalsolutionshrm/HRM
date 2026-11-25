import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DsrService } from './dsr.service';
import { CreateDsrDto } from './dto/create-dsr.dto';
import {
  SetDsrEmployeeEditPermissionDto,
  UpdateDsrDto,
} from './dto/update-dsr.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@Controller('dsr')
export class DsrController {
  constructor(
    private readonly dsrService: DsrService,
     private readonly notificationService: NotificationService,
  ) {}

  // =========================
  // CREATE DSR
  // =========================

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() req: any,
    @Body() createDsrDto: CreateDsrDto,
  ) {
    const userId = req.user.id;

    return this.dsrService.create(
      userId,
      createDsrDto,
    );
  }

  // =========================
  // MY DSR
  // =========================

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMyDsr(@Req() req: any) {
    const userId = req.user.id;

    return this.dsrService.findByUser(userId);
  }

  // =========================
  // ALL DSR
  // =========================

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
  )
  findAll() {
    return this.dsrService.findAll();
  }

  // =========================
  // EMPLOYEE DSR
  // =========================

  @Get('employee/:employeeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
  )
  findByEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.dsrService.findByEmployee(employeeId);
  }

  // =========================
  // SINGLE DSR
  // =========================

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dsrService.findOne(id);
  }

  // =========================
  // UPDATE DSR
  // =========================

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
    UserRole.EMPLOYEE,
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDsrDto: UpdateDsrDto,
    @Req() req: any,
  ) {
    return this.dsrService.update(
      id,
      updateDsrDto,
      req.user,
    );
  }

  @Patch(':id/employee-edit-permission')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  setEmployeeEditPermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() permissionDto: SetDsrEmployeeEditPermissionDto,
    @Req() req: any,
  ) {
    return this.dsrService.setEmployeeEditPermission(
      id,
      permissionDto.allowed,
      req.user.id,
    );
  }

  // =========================
  // DELETE DSR
  // =========================

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.EMPLOYEE,
  )
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dsrService.remove(id);
  }

  // =========================
  // APPROVE DSR
  // =========================

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
  )
  approve(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dsrService.approve(id);
  }

  // =========================
  // REJECT DSR
  // =========================

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.HR,
    UserRole.MANAGER,
  )
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body('managerComment') managerComment?: string,
  ) {
    return this.dsrService.reject(
      id,
      managerComment,
    );
  }
}
