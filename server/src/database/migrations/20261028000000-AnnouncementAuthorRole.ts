import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnnouncementAuthorRole20261028000000 implements MigrationInterface {
  name = 'AnnouncementAuthorRole20261028000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "announcementAuthorRole" VARCHAR(24)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notifications" DROP COLUMN IF EXISTS "announcementAuthorRole"',
    );
  }
}
