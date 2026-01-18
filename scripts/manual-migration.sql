-- ============================================================================
-- SkiMate Database Manual Migration Script
-- Run this in Cloud Console after creating the database
-- ============================================================================

-- Migration 1: Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Migration 2: Create Enums
CREATE TYPE "gender_enum" AS ENUM ('Male', 'Female', 'Other', 'PreferNotToSay');
CREATE TYPE "skill_level_enum" AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Expert');
CREATE TYPE "units_enum" AS ENUM ('Metric', 'Imperial');
CREATE TYPE "friendship_status_enum" AS ENUM ('Pending', 'Accepted', 'Blocked');

-- Migration 3: Create Users Tables
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
);

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
);

CREATE INDEX "IDX_users_email" ON "users" ("email");

-- Migration 4: Create Social Tables
CREATE TABLE "friendships" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id_1" varchar NOT NULL,
  "user_id_2" varchar NOT NULL,
  "status" "friendship_status_enum" NOT NULL DEFAULT 'Pending',
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_friendships" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_friendships_users" UNIQUE ("user_id_1", "user_id_2"),
  CONSTRAINT "FK_friendships_user1" FOREIGN KEY ("user_id_1")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_friendships_user2" FOREIGN KEY ("user_id_2")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying NOT NULL,
  "description" character varying,
  "avatar_url" character varying,
  "created_by" varchar NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_groups" PRIMARY KEY ("id"),
  CONSTRAINT "FK_groups_creator" FOREIGN KEY ("created_by")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "group_members" (
  "group_id" uuid NOT NULL,
  "user_id" varchar NOT NULL,
  CONSTRAINT "PK_group_members" PRIMARY KEY ("group_id", "user_id"),
  CONSTRAINT "FK_group_members_group" FOREIGN KEY ("group_id")
    REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FK_group_members_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "messages" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "sender_id" varchar NOT NULL,
  "group_id" uuid,
  "recipient_id" varchar,
  "content" text NOT NULL,
  "metadata" jsonb,
  "read_by" varchar[] NOT NULL DEFAULT '{}',
  "sent_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
  CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_messages_group" FOREIGN KEY ("group_id")
    REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_messages_recipient" FOREIGN KEY ("recipient_id")
    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "IDX_friendships_user1_status" ON "friendships" ("user_id_1", "status");
CREATE INDEX "IDX_friendships_user2_status" ON "friendships" ("user_id_2", "status");
CREATE INDEX "IDX_messages_group" ON "messages" ("group_id", "sent_at");
CREATE INDEX "IDX_messages_dm" ON "messages" ("sender_id", "recipient_id", "sent_at");

-- Migration 5: Create Resort Tables
CREATE TABLE "resorts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying NOT NULL,
  "location" geography(Point, 4326) NOT NULL,
  "country" character varying NOT NULL,
  "region" character varying,
  "vertical_drop" integer,
  "base_elevation" integer,
  "summit_elevation" integer,
  "trail_count" integer,
  "lift_count" integer,
  "terrain_parks" integer,
  "season_start" date,
  "season_end" date,
  "website_url" character varying,
  "logo_url" character varying,
  "metadata" jsonb,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_resorts" PRIMARY KEY ("id")
);

CREATE INDEX "IDX_resorts_location" ON "resorts" USING GIST ("location");

-- Migration 6: Create Tracking Tables
CREATE TABLE "ski_sessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
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
);

CREATE TABLE "location_pings" (
  "id" BIGSERIAL NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" varchar NOT NULL,
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
);

CREATE INDEX "IDX_location_pings_coords" ON "location_pings" USING GIST ("coords");
CREATE INDEX "IDX_location_pings_session" ON "location_pings" ("session_id", "created_at");
CREATE INDEX "IDX_ski_sessions_user" ON "ski_sessions" ("user_id", "start_time");
CREATE INDEX "IDX_ski_sessions_active" ON "ski_sessions" ("is_active", "user_id");

-- Seed Test Data
INSERT INTO "users" ("id", "email", "full_name", "gender", "date_of_birth", "skill_level", "created_at", "updated_at")
VALUES ('47dZFPzKsnTmpNHyaN9t8lt4xk43', 'test@skimate.dev', 'Test User', 'Male', '1990-01-01', 'Intermediate', NOW(), NOW())
ON CONFLICT ("email") DO UPDATE SET "full_name" = EXCLUDED."full_name", "updated_at" = NOW();

INSERT INTO "groups" ("id", "name", "created_by", "created_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Group', '47dZFPzKsnTmpNHyaN9t8lt4xk43', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO "group_members" ("group_id", "user_id")
VALUES ('00000000-0000-0000-0000-000000000001', '47dZFPzKsnTmpNHyaN9t8lt4xk43')
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Migration complete!' as status;
SELECT 'Test User ID: ' || id as info FROM "users" WHERE email = 'test@skimate.dev';
SELECT 'Test Group ID: ' || id as info FROM "groups" WHERE name = 'Test Group';
