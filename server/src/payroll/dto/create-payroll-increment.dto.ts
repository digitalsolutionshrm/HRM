import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePayrollIncrementDto {
  @IsInt()
  @Min(1)
  employeeId!: number;

  @IsNumber()
  @Min(0.01)
  increaseAmount!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
