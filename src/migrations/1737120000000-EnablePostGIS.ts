import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePostGIS1737120000000 implements MigrationInterface {
  name = 'EnablePostGIS1737120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable PostGIS extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis_topology`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP EXTENSION IF EXISTS postgis_topology CASCADE`,
    );
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis CASCADE`);
  }
}
