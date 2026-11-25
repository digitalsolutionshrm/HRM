import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../auth/enums/user-role.enum';
import { ShiftsService } from './shifts.service';
import { AssignShiftDto, EndShiftAssignmentDto, SaveShiftDto } from './dto/shift.dto';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}
  @Get('my-assignment') myAssignment(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) { return this.service.activeForEmployee(user.id, date ?? new Date().toISOString().slice(0,10)); }
  @Get() @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) list() { return this.service.list(); }
  @Post() @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) create(@Body() dto: SaveShiftDto) { return this.service.create(dto); }
  @Patch(':id') @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) update(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<SaveShiftDto>) { return this.service.update(id, dto); }
  @Get('assignments') @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) listAssignments() { return this.service.listAssignments(); }
  @Post('assignments') @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) assign(@Body() dto: AssignShiftDto) { return this.service.assign(dto); }
  @Patch('assignments/:id/end') @UseGuards(RolesGuard) @Roles(UserRole.ADMIN, UserRole.HR) end(@Param('id', ParseIntPipe) id: number, @Body() dto: EndShiftAssignmentDto) { return this.service.endAssignment(id, dto.effectiveTo); }
}
