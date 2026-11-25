import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmployeeCoverImage20261118000100 implements MigrationInterface {
  name = 'EmployeeCoverImage20261118000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "coverImage" character varying`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" DROP COLUMN IF EXISTS "coverImage"`,
    );
  }
}
