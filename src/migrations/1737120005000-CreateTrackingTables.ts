import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTrackingTables1737120005000 implements MigrationInterface {
  name = 'CreateTrackingTables1737120005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create ski_sessions table
    await queryRunner.query(`
      CREATE TABLE "ski_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "resort_id" uuid,
        "total_vertical" float NOT NULL DEFAULT 0,
        "total_distance" float NOT NULL DEFAULT 0,
        "max_speed" float NOT NULL DEFAULT 0,
        "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_time" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "stats" jsonb,
        "strava_activity_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ski_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ski_sessions_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_ski_sessions_resort" FOREIGN KEY ("resort_id") 
          REFERENCES "resorts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    // Create location_pings table
    await queryRunner.query(`
      CREATE TABLE "location_pings" (
        "id" BIGSERIAL NOT NULL,
        "session_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "coords" geography(Point, 4326) NOT NULL,
        "altitude" float NOT NULL,
        "speed" float NOT NULL,
        "accuracy" float NOT NULL,
        "heading" float,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_location_pings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_location_pings_session" FOREIGN KEY ("session_id") 
          REFERENCES "ski_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_location_pings_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create GIST spatial index for location_pings
    await queryRunner.query(
      `CREATE INDEX "idx_location_pings_spatial" ON "location_pings" USING GIST ("coords")`,
    );

    // Create indexes for ski_sessions
    await queryRunner.query(
      `CREATE INDEX "IDX_ski_sessions_user_start" ON "ski_sessions" ("user_id", "start_time")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ski_sessions_active" ON "ski_sessions" ("is_active") WHERE "is_active" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ski_sessions_resort" ON "ski_sessions" ("resort_id")`,
    );

    // Create indexes for location_pings (critical for performance)
    await queryRunner.query(
      `CREATE INDEX "IDX_location_pings_session_time" ON "location_pings" ("session_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_location_pings_user_time" ON "location_pings" ("user_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_pings_user_time"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_location_pings_session_time"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ski_sessions_resort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ski_sessions_active"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ski_sessions_user_start"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_location_pings_spatial"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "location_pings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ski_sessions"`);
  }
}
