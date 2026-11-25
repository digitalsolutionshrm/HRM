import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceLateCategories20261118000300 implements MigrationInterface {
  name = 'AttendanceLateCategories20261118000300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "attendance_status_enum" ADD VALUE IF NOT EXISTS 'SHORT_LEAVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_settings" ALTER COLUMN "graceMinutes" SET DEFAULT 30`,
    );
    await queryRunner.query(
      `UPDATE "work_settings" SET "graceMinutes" = 30 WHERE "graceMinutes" = 15`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ALTER COLUMN "graceMinutes" SET DEFAULT 30`,
    );
    await queryRunner.query(
      `UPDATE "shifts" SET "graceMinutes" = 30 WHERE "graceMinutes" = 15`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "attendance" SET "status" = 'LATE' WHERE "status" = 'SHORT_LEAVE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "work_settings" ALTER COLUMN "graceMinutes" SET DEFAULT 15`,
    );
    await queryRunner.query(
      `ALTER TABLE "shifts" ALTER COLUMN "graceMinutes" SET DEFAULT 15`,
    );
  }
}
