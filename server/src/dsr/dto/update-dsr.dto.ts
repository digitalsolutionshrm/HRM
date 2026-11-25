import {
  IsDateString,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DsrStatus } from '../entities/dsr.entity';

export class UpdateDsrDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  tasksCompleted?: string;

  @IsOptional()
  @IsString()
  tasksStatus?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hoursWorked?: number;

  @IsOptional()
  @IsEnum(DsrStatus)
  status?: DsrStatus;
}

export class SetDsrEmployeeEditPermissionDto {
  @IsBoolean()
  allowed!: boolean;
}
