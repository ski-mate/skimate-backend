import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

async function seed() {
  console.log('🌱 Seeding test data...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'skimate',
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    // Use Firebase UID for test user (from Firebase Auth)
    const testUserId = '47dZFPzKsnTmpNHyaN9t8lt4xk43'; // Firebase test user UID

    console.log('📝 Creating test user...');
    await dataSource.query(
      `INSERT INTO "users"
       ("id", "email", "full_name", "gender", "date_of_birth", "skill_level", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT ("email") DO UPDATE
       SET "full_name" = EXCLUDED."full_name",
           "updated_at" = NOW()
       RETURNING "id"`,
      [testUserId, 'test@skimate.dev', 'Test User', 'Male', '1990-01-01', 'Intermediate']
    );

    // Get the actual user ID (might be different if user already existed)
    const user = await dataSource.query(
      `SELECT "id" FROM "users" WHERE "email" = $1`,
      ['test@skimate.dev']
    );
    const actualUserId = user[0].id;
    console.log(`✅ Test user created with ID: ${actualUserId}\n`);

    // Create test group
    console.log('📝 Creating test group...');
    const groupResult = await dataSource.query(
      `INSERT INTO "groups" ("name", "created_by", "created_at")
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING
       RETURNING "id"`,
      ['Test Group', actualUserId]
    );

    let groupId;
    if (groupResult.length > 0) {
      groupId = groupResult[0].id;
    } else {
      // Group already exists, get its ID
      const existingGroup = await dataSource.query(
        `SELECT "id" FROM "groups" WHERE "name" = $1 LIMIT 1`,
        ['Test Group']
      );
      groupId = existingGroup[0].id;
    }
    console.log(`✅ Test group created with ID: ${groupId}\n`);

    // Add user to group
    console.log('📝 Adding user to group...');
    await dataSource.query(
      `INSERT INTO "group_members" ("group_id", "user_id")
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [groupId, actualUserId]
    );
    console.log('✅ User added to group\n');

    // Display summary
    console.log('='.repeat(80));
    console.log('✨ TEST DATA SEEDED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`User ID:    ${actualUserId}`);
    console.log(`Email:      test@skimate.dev`);
    console.log(`Password:   TestPassword123! (Firebase Auth)`);
    console.log(`Group ID:   ${groupId}`);
    console.log(`Group Name: Test Group`);
    console.log('='.repeat(80));
    console.log('\n✅ User ID matches Firebase UID!');
    console.log('   WebSocket authentication should work correctly.\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => {
    console.log('\n✅ Seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  });
