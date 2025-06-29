import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToJobs1717869814000 implements MigrationInterface {
  name = 'AddSoftDeleteToJobs1717869814000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job" ADD "isDeleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "job" ADD "deletedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "deletedAt"`);
    await queryRunner.query(`ALTER TABLE "job" DROP COLUMN "isDeleted"`);
  }
}
