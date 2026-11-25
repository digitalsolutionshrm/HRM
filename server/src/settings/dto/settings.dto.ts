import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export class UpdateWorkSettingsDto {
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'officeStartTime must be a valid HH:mm time' })
  officeStartTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'officeEndTime must be a valid HH:mm time' })
  officeEndTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  graceMinutes?: number;

  @IsOptional()
  @Min(1)
  @Max(24)
  standardWorkHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  paidLeavesPerMonth?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weeklyOffDays?: number[];
}

export class CreateHolidayDto {
  @IsString()
  name!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
