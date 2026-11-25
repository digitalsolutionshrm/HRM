import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollPayslipApproval20261028000100 implements MigrationInterface {
  name = 'PayrollPayslipApproval20261028000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT false',
    );
    await queryRunner.query(
      'ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ',
    );
    await queryRunner.query(
      'ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "approvedByUserId" INTEGER',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "payroll" DROP COLUMN IF EXISTS "approvedByUserId"',
    );
    await queryRunner.query(
      'ALTER TABLE "payroll" DROP COLUMN IF EXISTS "approvedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "payroll" DROP COLUMN IF EXISTS "isApproved"',
    );
  }
}
