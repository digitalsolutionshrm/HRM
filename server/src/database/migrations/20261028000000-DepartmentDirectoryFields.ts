import { MigrationInterface, QueryRunner } from 'typeorm';

export class DepartmentDirectoryFields20261028000000 implements MigrationInterface {
  name = 'DepartmentDirectoryFields20261028000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "code" character varying(24)`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "location" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "costCenter" character varying(60)`);
    await queryRunner.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "headEmployeeId" integer`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_departments_code_unique" ON "departments" ("code") WHERE "code" IS NOT NULL`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_departments_head_employee') THEN
        ALTER TABLE "departments" ADD CONSTRAINT "FK_departments_head_employee"
          FOREIGN KEY ("headEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "FK_departments_head_employee"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_code_unique"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "headEmployeeId"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "costCenter"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "location"`);
    await queryRunner.query(`ALTER TABLE "departments" DROP COLUMN IF EXISTS "code"`);
  }
}
