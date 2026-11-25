import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DsrStatus } from '../entities/dsr.entity';

export class CreateDsrDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  tasksCompleted?: string;

  @IsOptional()
  @IsString()
  tasksStatus?: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  hoursWorked!: number;

  @IsOptional()
  @IsEnum(DsrStatus)
  status?: DsrStatus;
}