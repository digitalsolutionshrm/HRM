import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

import { LeaveStatus, LeaveType,  LeaveDuration } from '../entities/leave.entity';

export class UpdateLeaveDto {
  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @IsEnum(LeaveDuration)
  leaveDuration!: LeaveDuration;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}