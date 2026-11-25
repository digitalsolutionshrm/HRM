import { IsNumber, Min } from 'class-validator';

export class UpdatePayrollBonusDto {
  @IsNumber()
  @Min(0)
  bonus!: number;
}
