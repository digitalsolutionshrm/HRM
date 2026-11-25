import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceOvertimeApproval20261118000000
  implements MigrationInterface
{
  name = 'AttendanceOvertimeApproval20261118000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "attendance"
        ADD COLUMN IF NOT EXISTS "overtime_approval_status" character varying(20) NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "overtime_requested_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "overtime_reviewed_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "overtime_reviewed_by_user_id" integer
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_attendance_overtime_pending"
      ON "attendance" ("overtime_approval_status", "checkOut")
      WHERE "overtime_approval_status" = 'PENDING' AND "checkOut" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_overtime_pending"`);
    await queryRunner.query(`
      ALTER TABLE "attendance"
        DROP COLUMN IF EXISTS "overtime_reviewed_by_user_id",
        DROP COLUMN IF EXISTS "overtime_reviewed_at",
        DROP COLUMN IF EXISTS "overtime_requested_at",
        DROP COLUMN IF EXISTS "overtime_approval_status"
    `);
  }
}
