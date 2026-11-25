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

import { LeavesService } from './leaves.service';

import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
  constructor(
    private readonly leavesService: LeavesService,
  ) {}

  // =========================================================
  // CREATE LEAVE
  // =========================================================

  @Post()
  create(
    @Body() createLeaveDto: CreateLeaveDto,
    @Req() req: any,
  ) {
    return this.leavesService.create(
      createLeaveDto,
      req.user,
    );
  }

  // =========================================================
  // GET ALL LEAVES
  // ADMIN + HR
  // =========================================================

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  findAll() {
    return this.leavesService.findAll();
  }

  // =========================================================
  // GET LEAVES BY EMPLOYEE
  // GET /api/leaves/employee/:employeeId
  // =========================================================

  @Get('employee/:employeeId')
  findByEmployee(
    @Param('employeeId', ParseIntPipe)
    employeeId: number,
  ) {
    return this.leavesService.findByEmployee(
      employeeId,
    );
  }

  // =========================================================
  // GET SINGLE LEAVE
  // GET /api/leaves/:id
  // =========================================================

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.leavesService.findOne(id);
  }

  // =========================================================
  // UPDATE LEAVE
  // PATCH /api/leaves/:id
  // =========================================================

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe)
    id: number,

    @Body() updateLeaveDto: UpdateLeaveDto,

    @Req() req: any,
  ) {
    return this.leavesService.update(
      id,
      updateLeaveDto,
      req.user,
    );
  }

  // =========================================================
  // APPROVE LEAVE
  // PATCH /api/leaves/:id/approve
  // ADMIN + HR ONLY
  // =========================================================

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  approve(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.leavesService.approve(id);
  }

  // =========================================================
  // REJECT LEAVE
  // PATCH /api/leaves/:id/reject
  // ADMIN + HR ONLY
  // =========================================================

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.HR)
  reject(
    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    body: {
      rejectionReason: string;
    },
  ) {
    return this.leavesService.reject(
      id,
      body.rejectionReason,
    );
  }

  // =========================================================
  // DELETE LEAVE
  // DELETE /api/leaves/:id
  // =========================================================

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe)
    id: number,

    @Req() req: any,
  ) {
    return this.leavesService.remove(
      id,
      req.user,
    );
  }
}

