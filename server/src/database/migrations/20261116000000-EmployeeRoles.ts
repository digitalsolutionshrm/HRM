import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmployeeRoles20261116000000 implements MigrationInterface {
  name = 'EmployeeRoles20261116000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_roles" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "status" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employee_roles_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "role_id" integer`,
    );
    await queryRunner.query(`
      INSERT INTO "employee_roles" ("name")
      SELECT DISTINCT ON (LOWER(BTRIM("designation"))) BTRIM("designation")
      FROM "employees"
      WHERE "designation" IS NOT NULL AND BTRIM("designation") <> ''
      ORDER BY LOWER(BTRIM("designation")), BTRIM("designation")
      ON CONFLICT DO NOTHING
    `);

    const defaultRoles = [
      'Senior Engineer',
      'Product Manager',
      'UX Designer',
      'DevOps Lead',
      'HR Manager',
      'Data Scientist',
      'Frontend Developer',
      'Marketing Director',
      'Finance Analyst',
      'Backend Developer',
      'QA Engineer',
      'Sales Manager',
      'Project Manager',
      'Intern',
    ];
    for (const name of defaultRoles) {
      await queryRunner.query(
        `INSERT INTO "employee_roles" ("name")
         SELECT $1::varchar WHERE NOT EXISTS (
           SELECT 1 FROM "employee_roles" WHERE LOWER("name") = LOWER($1::varchar)
         )`,
        [name],
      );
    }

    await queryRunner.query(`
      UPDATE "employees" AS employee
      SET "role_id" = role."id"
      FROM "employee_roles" AS role
      WHERE employee."role_id" IS NULL
        AND employee."designation" IS NOT NULL
        AND LOWER(BTRIM(employee."designation")) = LOWER(role."name")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_employee_roles_name_lower"
      ON "employee_roles" (LOWER("name"))
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_employees_role'
        ) THEN
          ALTER TABLE "employees" ADD CONSTRAINT "FK_employees_role"
            FOREIGN KEY ("role_id") REFERENCES "employee_roles"("id")
            ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "FK_employees_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN IF EXISTS "role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employee_roles_name_lower"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_roles"`);
  }
}
