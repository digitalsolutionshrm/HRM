import { IsEnum } from 'class-validator';

import { PayrollStatus } from '../entities/payroll.entity';

export class UpdatePayrollStatusDto {
  @IsEnum(PayrollStatus)
  status!: PayrollStatus;
}
