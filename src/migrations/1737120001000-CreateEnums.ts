import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnums1737120001000 implements MigrationInterface {
  name = 'CreateEnums1737120001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create all enum types
    await queryRunner.query(`
      CREATE TYPE "gender_enum" AS ENUM (
        'Male', 'Female', 'Other', 'Prefer not to say'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "skill_level_enum" AS ENUM (
        'Beginner', 'Intermediate', 'Advanced', 'Expert'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "units_enum" AS ENUM (
        'Metric', 'Imperial'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "friendship_status_enum" AS ENUM (
        'Pending', 'Accepted', 'Blocked'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "trail_difficulty_enum" AS ENUM (
        'Easy', 'Intermediate', 'Difficult', 'Expert'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "trail_status_enum" AS ENUM (
        'Open', 'Closed', 'Grooming'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "lift_type_enum" AS ENUM (
        'Chairlift', 'Gondola', 'Tram', 'Surface'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "lift_status_enum" AS ENUM (
        'Open', 'Closed', 'On Hold'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE IF EXISTS "lift_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "lift_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trail_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trail_difficulty_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "friendship_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "units_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "skill_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "gender_enum"`);
  }
}
