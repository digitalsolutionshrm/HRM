import { MigrationInterface, QueryRunner } from 'typeorm';

export class AttendanceSettingsAndHusbandName20261103000000
  implements MigrationInterface
{
  name = 'AttendanceSettingsAndHusbandName20261103000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_settings" (
        "id" SERIAL NOT NULL,
        "officeStartTime" TIME NOT NULL DEFAULT '09:30:00',
        "officeEndTime" TIME NOT NULL DEFAULT '18:30:00',
        "graceMinutes" integer NOT NULL DEFAULT 15,
        "standardWorkHours" numeric(4,2) NOT NULL DEFAULT 8,
        "paidLeavesPerMonth" integer NOT NULL DEFAULT 2,
        "weeklyOffDays" integer[] NOT NULL DEFAULT '{0}',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_settings" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "holidays" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "date" date NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_holidays" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_holidays_date" UNIQUE ("date")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "employee_personal_details" ADD COLUMN IF NOT EXISTS "husbandName" character varying`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employee_personal_details" DROP COLUMN IF EXISTS "husbandName"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "holidays"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_settings"`);
  }
}
