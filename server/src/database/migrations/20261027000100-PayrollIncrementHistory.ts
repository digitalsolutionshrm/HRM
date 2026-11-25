import { MigrationInterface, QueryRunner } from 'typeorm';

export class PayrollIncrementHistory20261027000100 implements MigrationInterface {
  name = 'PayrollIncrementHistory20261027000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_increment_history" (
        "id" SERIAL NOT NULL,
        "employeeId" integer NOT NULL,
        "employeeName" character varying(150) NOT NULL,
        "departmentName" character varying(150),
        "previousSalary" numeric(12,2) NOT NULL,
        "newSalary" numeric(12,2) NOT NULL,
        "increaseAmount" numeric(12,2) NOT NULL,
        "increasePercent" numeric(7,2) NOT NULL,
        "effectiveDate" date NOT NULL,
        "note" text,
        "createdByUserId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_increment_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payroll_increment_history_employee" FOREIGN KEY ("employeeId")
          REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payroll_increment_employee_date" ON "payroll_increment_history" ("employeeId", "effectiveDate" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payroll_increment_employee_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payroll_increment_history"`);
  }
}
