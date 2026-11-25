import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShiftManagement20261103000100 implements MigrationInterface {
  name = 'ShiftManagement20261103000100';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "shifts" (
      "id" SERIAL NOT NULL, "code" character varying(40) NOT NULL, "name" character varying(100) NOT NULL,
      "startTime" TIME NOT NULL, "endTime" TIME NOT NULL, "graceMinutes" integer NOT NULL DEFAULT 15,
      "standardWorkHours" numeric(4,2) NOT NULL DEFAULT 8, "breakMinutes" integer NOT NULL DEFAULT 0,
      "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_shifts" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_shifts_code" UNIQUE ("code"))`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "shift_assignments" (
      "id" SERIAL NOT NULL, "employee_id" integer NOT NULL, "shift_id" integer NOT NULL,
      "effectiveFrom" date NOT NULL, "effectiveTo" date, "weekdays" integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}',
      "note" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_shift_assignments" PRIMARY KEY ("id"),
      CONSTRAINT "FK_shift_assignment_employee" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_shift_assignment_shift" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shift_assignments_employee_dates" ON "shift_assignments" ("employee_id", "effectiveFrom", "effectiveTo")`);
    await queryRunner.query(`INSERT INTO "shifts" ("code", "name", "startTime", "endTime", "graceMinutes", "standardWorkHours", "breakMinutes", "active")
      SELECT 'DEFAULT', 'Default shift',
        COALESCE((SELECT "officeStartTime" FROM "work_settings" ORDER BY "id" ASC LIMIT 1), '09:30:00'::time),
        COALESCE((SELECT "officeEndTime" FROM "work_settings" ORDER BY "id" ASC LIMIT 1), '18:30:00'::time),
        COALESCE((SELECT "graceMinutes" FROM "work_settings" ORDER BY "id" ASC LIMIT 1), 15),
        COALESCE((SELECT "standardWorkHours" FROM "work_settings" ORDER BY "id" ASC LIMIT 1), 8),
        0, true WHERE NOT EXISTS (SELECT 1 FROM "shifts" WHERE "active" = true)
      ON CONFLICT ("code") DO NOTHING`);
    await queryRunner.query(`INSERT INTO "shift_assignments" ("employee_id", "shift_id", "effectiveFrom", "effectiveTo", "weekdays", "note")
      SELECT e."id", s."id", CURRENT_DATE, NULL,
        ARRAY(SELECT days.weekday FROM generate_series(0, 6) AS days(weekday)
          WHERE NOT (days.weekday = ANY(COALESCE((SELECT "weeklyOffDays" FROM "work_settings" ORDER BY "id" ASC LIMIT 1), ARRAY[0]::integer[])))),
        'Initial assignment from company attendance settings'
      FROM "employees" e CROSS JOIN "shifts" s
      WHERE e."status" = true AND s."code" = 'DEFAULT'
        AND NOT EXISTS (SELECT 1 FROM "shift_assignments" a WHERE a."employee_id" = e."id" AND a."effectiveTo" IS NULL)`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_id" integer`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_name_snapshot" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_start_snapshot" TIME`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_end_snapshot" TIME`);
    await queryRunner.query(`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_work_hours_snapshot" numeric(4,2)`);
    await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_attendance_shift') THEN ALTER TABLE "attendance" ADD CONSTRAINT "FK_attendance_shift" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL; END IF; END $$`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_attendance_shift_date" ON "attendance" ("shift_id", "date")`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "FK_attendance_shift"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_attendance_shift_date"`);
    await queryRunner.query(`ALTER TABLE "attendance" DROP COLUMN IF EXISTS "shift_work_hours_snapshot", DROP COLUMN IF EXISTS "shift_end_snapshot", DROP COLUMN IF EXISTS "shift_start_snapshot", DROP COLUMN IF EXISTS "shift_name_snapshot", DROP COLUMN IF EXISTS "shift_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shift_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
  }
}
