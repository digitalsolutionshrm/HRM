import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfileImageDatabaseStorage20261118000200 implements MigrationInterface {
  name = 'ProfileImageDatabaseStorage20261118000200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "profileImageData" bytea,
      ADD COLUMN IF NOT EXISTS "profile_image_mime_type" character varying(50)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      DROP COLUMN IF EXISTS "profileImageData",
      DROP COLUMN IF EXISTS "profile_image_mime_type"
    `);
  }
}
