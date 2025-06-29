import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1717692150000 implements MigrationInterface {
  name = 'AddEmailVerification1717692150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_email_verified column to users table
    await queryRunner.query(`
            ALTER TABLE "user" 
            ADD COLUMN "is_email_verified" boolean NOT NULL DEFAULT false,
            ADD COLUMN "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        `);

    // Create email_tokens table
    await queryRunner.query(`
            CREATE TABLE "email_token" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "token" character varying NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "used" boolean NOT NULL DEFAULT false,
                "user_id" uuid NOT NULL,
                CONSTRAINT "PK_email_token_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_email_token_user_id" FOREIGN KEY ("user_id") 
                    REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);

    // Create index for faster lookups
    await queryRunner.query(`
            CREATE INDEX "IDX_email_token_token" ON "email_token" ("token")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index
    await queryRunner.query(`DROP INDEX "IDX_email_token_token"`);

    // Drop the email_tokens table
    await queryRunner.query(`DROP TABLE "email_token"`);

    // Drop the columns from users table
    await queryRunner.query(`
            ALTER TABLE "user" 
            DROP COLUMN "is_email_verified",
            DROP COLUMN "created_at"
        `);
  }
}
