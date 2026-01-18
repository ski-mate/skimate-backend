import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateResortTables1737120004000 implements MigrationInterface {
  name = 'CreateResortTables1737120004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create resorts table with PostGIS geography columns
    await queryRunner.query(`
      CREATE TABLE "resorts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "location_name" character varying NOT NULL,
        "base_altitude" float NOT NULL,
        "summit_altitude" float NOT NULL,
        "vertical_drop" float,
        "boundary" geography(Polygon, 4326),
        "center_point" geography(Point, 4326),
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resorts" PRIMARY KEY ("id")
      )
    `);

    // Create trails table with PostGIS geography column
    await queryRunner.query(`
      CREATE TABLE "trails" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "resort_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "difficulty" "trail_difficulty_enum" NOT NULL DEFAULT 'Intermediate',
        "path" geography(LineString, 4326),
        "status" "trail_status_enum" NOT NULL DEFAULT 'Open',
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trails" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trails_resort" FOREIGN KEY ("resort_id") 
          REFERENCES "resorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create lifts table
    await queryRunner.query(`
      CREATE TABLE "lifts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "resort_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" "lift_type_enum" NOT NULL DEFAULT 'Chairlift',
        "status" "lift_status_enum" NOT NULL DEFAULT 'Closed',
        "path" geography(LineString, 4326),
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lifts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lifts_resort" FOREIGN KEY ("resort_id") 
          REFERENCES "resorts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create GIST spatial indexes for PostGIS columns
    await queryRunner.query(
      `CREATE INDEX "idx_resorts_spatial" ON "resorts" USING GIST ("boundary")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_resorts_center_spatial" ON "resorts" USING GIST ("center_point")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_trails_spatial" ON "trails" USING GIST ("path")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_lifts_spatial" ON "lifts" USING GIST ("path")`,
    );

    // Create regular indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_trails_resort" ON "trails" ("resort_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lifts_resort" ON "lifts" ("resort_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trails_status" ON "trails" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lifts_status" ON "lifts" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lifts_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trails_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lifts_resort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trails_resort"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lifts_spatial"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_trails_spatial"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_resorts_center_spatial"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_resorts_spatial"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lifts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trails"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "resorts"`);
  }
}
