import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportsTable1749400212991 implements MigrationInterface {
  name = 'CreateReportsTable1749400212991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."reports_status_enum" AS ENUM('pending', 'under_review', 'resolved', 'rejected')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."reports_type_enum" AS ENUM('post', 'user', 'job', 'comment', 'other')
        `);
    await queryRunner.query(`
            CREATE TABLE "reports" (
                "id" SERIAL PRIMARY KEY,
                "type" "public"."reports_type_enum" NOT NULL,
                "reportedId" integer NOT NULL,
                "reason" text NOT NULL,
                "status" "public"."reports_status_enum" NOT NULL DEFAULT 'pending',
                "resolvedBy" integer,
                "resolvedAt" timestamp,
                "resolutionNotes" text,
                "reporterId" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP
            )
        `);
    await queryRunner.query(`
            ALTER TABLE "reports" 
            ADD CONSTRAINT "FK_reports_reporter" 
            FOREIGN KEY ("reporterId") 
            REFERENCES "users"("id") 
            ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_reporter"`,
    );
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reports_type_enum"`);
  }
}
