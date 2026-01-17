import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

// Entities
import { User, UserPreferences, Friendship } from './modules/users/entities/index.js';
import { Group, Message } from './modules/chat/entities/index.js';
import { Resort, Trail, Lift } from './modules/resort/entities/index.js';
import { SkiSession, LocationPing } from './modules/location/entities/index.js';

// Migrations
import {
  EnablePostGIS1737120000000,
  CreateEnums1737120001000,
  CreateUserTables1737120002000,
  CreateSocialTables1737120003000,
  CreateResortTables1737120004000,
  CreateTrackingTables1737120005000,
} from './migrations/index.js';

const entities = [
  User,
  UserPreferences,
  Friendship,
  Group,
  Message,
  Resort,
  Trail,
  Lift,
  SkiSession,
  LocationPing,
];

const migrations = [
  EnablePostGIS1737120000000,
  CreateEnums1737120001000,
  CreateUserTables1737120002000,
  CreateSocialTables1737120003000,
  CreateResortTables1737120004000,
  CreateTrackingTables1737120005000,
];

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'skimate',
  entities,
  migrations,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
