import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSocialTables1737120003000 implements MigrationInterface {
  name = 'CreateSocialTables1737120003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create friendships table
    await queryRunner.query(`
      CREATE TABLE "friendships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id_1" uuid NOT NULL,
        "user_id_2" uuid NOT NULL,
        "status" "friendship_status_enum" NOT NULL DEFAULT 'Pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_friendships_users" UNIQUE ("user_id_1", "user_id_2"),
        CONSTRAINT "FK_friendships_user1" FOREIGN KEY ("user_id_1") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_friendships_user2" FOREIGN KEY ("user_id_2") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create groups table
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" character varying,
        "avatar_url" character varying,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_groups_creator" FOREIGN KEY ("created_by") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create group_members join table
    await queryRunner.query(`
      CREATE TABLE "group_members" (
        "group_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_group_members" PRIMARY KEY ("group_id", "user_id"),
        CONSTRAINT "FK_group_members_group" FOREIGN KEY ("group_id") 
          REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "FK_group_members_user" FOREIGN KEY ("user_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    // Create messages table
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sender_id" uuid NOT NULL,
        "group_id" uuid,
        "recipient_id" uuid,
        "content" text NOT NULL,
        "metadata" jsonb,
        "read_by" uuid[] NOT NULL DEFAULT '{}',
        "sent_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_messages_group" FOREIGN KEY ("group_id") 
          REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_messages_recipient" FOREIGN KEY ("recipient_id") 
          REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // Create indexes for friendships
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_user1_status" ON "friendships" ("user_id_1", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_friendships_user2_status" ON "friendships" ("user_id_2", "status")`,
    );

    // Create indexes for group_members
    await queryRunner.query(
      `CREATE INDEX "IDX_group_members_group" ON "group_members" ("group_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_group_members_user" ON "group_members" ("user_id")`,
    );

    // Create indexes for messages
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_group_sent" ON "messages" ("group_id", "sent_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_dm_sent" ON "messages" ("recipient_id", "sender_id", "sent_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_dm_sent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_group_sent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_members_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_group_members_group"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_friendships_user2_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_friendships_user1_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "group_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "friendships"`);
  }
}
