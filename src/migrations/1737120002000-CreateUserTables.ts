import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTables1737120002000 implements MigrationInterface {
  name = 'CreateUserTables1737120002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" varchar NOT NULL,
        "email" character varying NOT NULL,
        "full_name" character varying NOT NULL,
        "phone_number" character varying,
        "gender" "gender_enum" NOT NULL,
        "date_of_birth" date NOT NULL,
        "skill_level" "skill_level_enum" NOT NULL DEFAULT 'Beginner',
        "avatar_url" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create user_preferences table
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "user_id" varchar NOT NULL,
        "location_sharing_enabled" boolean NOT NULL DEFAULT true,
        "units" "units_enum" NOT NULL DEFAULT 'Metric',
        "notification_settings" jsonb NOT NULL DEFAULT '{}',
        "default_proximity_radius" integer NOT NULL DEFAULT 500,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_preferences" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_user_preferences_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create index on email for fast lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
