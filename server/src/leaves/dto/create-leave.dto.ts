import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

import { LeaveType, LeaveDuration } from '../entities/leave.entity';

export class CreateLeaveDto {
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsEnum(LeaveType)
  leaveType!: LeaveType;

  @IsEnum(LeaveDuration)
  leaveDuration!: LeaveDuration;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
  
}