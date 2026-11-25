import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreatePayrollDto {
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  year!: number;

  /**
   * Optional manual basic salary. When omitted, fixed salary components are
   * allocated from the employee's monthly salary and adjusted for attendance and
   * approved leaves for the selected month.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  basicSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hra?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  allowances?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pf?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  esi?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  attendanceDeductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leaveDeductions?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherDeductions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  attendanceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  absentDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  halfDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  leaveDays?: number;

  /**
   * Update only: re-run the attendance/leave based calculation
   * (any value sent in the same request still wins).
   */
  @IsOptional()
  @IsBoolean()
  recalculate?: boolean;
}
