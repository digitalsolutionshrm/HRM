import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { SettingsService } from './settings.service';
import {
  CreateHolidayDto,
  UpdateHolidayDto,
  UpdateWorkSettingsDto,
} from './dto/settings.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.HR)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ---------------- Work timing rules ----------------

  @Get('work')
  getWorkSettings() {
    return this.settingsService.getWorkSettings();
  }

  @Patch('work')
  updateWorkSettings(@Body() dto: UpdateWorkSettingsDto) {
    return this.settingsService.updateWorkSettings(dto);
  }

  // ---------------- Holidays ----------------

  @Get('holidays')
  listHolidays(@Query('year') year?: string) {
    const parsed = year ? Number(year) : undefined;
    return this.settingsService.listHolidays(
      parsed && Number.isInteger(parsed) ? parsed : undefined,
    );
  }

  @Post('holidays')
  createHoliday(@Body() dto: CreateHolidayDto) {
    return this.settingsService.createHoliday(dto);
  }

  @Patch('holidays/:id')
  updateHoliday(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.settingsService.updateHoliday(id, dto);
  }

  @Delete('holidays/:id')
  removeHoliday(@Param('id', ParseIntPipe) id: number) {
    return this.settingsService.removeHoliday(id);
  }
}
