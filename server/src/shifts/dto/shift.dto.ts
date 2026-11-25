import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
export class SaveShiftDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @Matches(TIME) startTime!: string;
  @Matches(TIME) endTime!: string;
  @IsOptional() @IsInt() @Min(0) @Max(180) graceMinutes?: number;
  @IsOptional() @Min(1) @Max(24) standardWorkHours?: number;
  @IsOptional() @IsInt() @Min(0) @Max(600) breakMinutes?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class AssignShiftDto {
  @IsInt() employeeId!: number;
  @IsInt() shiftId!: number;
  @IsDateString() effectiveFrom!: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
  @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays!: number[];
  @IsOptional() @IsString() note?: string;
}

export class EndShiftAssignmentDto {
  @IsDateString() effectiveTo!: string;
}
