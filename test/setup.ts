/**
 * Jest global test setup
 */

// Set test timeout
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.DB_NAME = 'skimate_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.FIREBASE_PROJECT_ID = 'skimate-307c2';
process.env.WEATHER_UNLOCKED_APP_ID = 'test-app-id';
process.env.WEATHER_UNLOCKED_API_KEY = 'test-api-key';
process.env.STRAVA_CLIENT_ID = 'test-client-id';
process.env.STRAVA_CLIENT_SECRET = 'test-client-secret';
process.env.STRAVA_VERIFY_TOKEN = 'test-verify-token';
process.env.MAPBOX_PUBLIC_TOKEN = 'test-mapbox-public';
process.env.MAPBOX_SECRET_TOKEN = 'test-mapbox-secret';

// Suppress console output during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
