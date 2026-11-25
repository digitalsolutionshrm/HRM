import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollAttendanceLeaveFields20261027000000 implements MigrationInterface {
  name = 'PayrollAttendanceLeaveFields20261027000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "overtimeHours" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "attendanceDeductions" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "leaveDeductions" numeric(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "attendanceDays" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "absentDays" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "halfDays" numeric(5,1) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "payroll" ADD COLUMN IF NOT EXISTS "leaveDays" numeric(5,1) NOT NULL DEFAULT 0`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'leaveDays',
      'halfDays',
      'absentDays',
      'attendanceDays',
      'leaveDeductions',
      'attendanceDeductions',
      'overtimeHours',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "payroll" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }
}
